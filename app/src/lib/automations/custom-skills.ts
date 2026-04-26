/**
 * Project-scoped custom skill storage.
 *
 * Custom skills are user-uploaded automation skills (SKILL.md + optional
 * frontmatter). They live in two places:
 *
 * - Metadata row in `custom_skills` (Postgres): id, frontmatter snapshot,
 *   blob_path. Used for fast catalog rendering and trigger validation
 *   without round-tripping the blob on every list.
 * - The SKILL.md content itself in blob storage (FileStorageProvider -
 *   `local`, `vercel-blob`, or `s3` per STORAGE_PROVIDER), under
 *   `automations/<projectId>/<skillId>/SKILL.md`.
 *
 * This module owns the round-trip: parse + validate, write the blob, upsert
 * the row. Read paths (skill catalog, runner) load both pieces back.
 */

import { parse as parseYaml } from 'yaml'
import { getStorageProvider } from '@/lib/storage'
import {
  deleteCustomSkill as deleteCustomSkillRow,
  getCustomSkill as getCustomSkillRow,
  listCustomSkills as listCustomSkillRows,
  upsertCustomSkill,
  type CustomSkillRow,
} from '@/lib/db/queries/custom-skills'
import type { SkillDescriptor, SkillFrontmatter } from './types'

const AUTOMATIONS_BUCKET = 'automations'
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/

function blobPath(projectId: string, skillId: string): string {
  return `${projectId}/${skillId}/SKILL.md`
}

export type CustomSkillSaveInput = {
  projectId: string
  /** Stable kebab-case id (matches frontmatter.name). */
  skillId: string
  /** Raw SKILL.md content (frontmatter + markdown body). */
  content: string
  /**
   * Optional supporting files keyed by path relative to the skill root.
   * Allowed prefixes: `references/` and `scripts/`. UTF-8 only.
   */
  references?: Record<string, string>
  createdByUserId?: string | null
}

export type CustomSkillFile = {
  path: string
  size: number
  contentType: string
}

const ALLOWED_PREFIXES = ['references/', 'scripts/'] as const
const PER_FILE_MAX_BYTES = 200_000
const MAX_FILES = 50

export class CustomSkillValidationError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) {
    super(`Invalid skill content: ${issues.join('; ')}`)
    this.issues = issues
  }
}

function parseFrontmatter(content: string): SkillFrontmatter {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    throw new CustomSkillValidationError(['Missing YAML frontmatter (--- ... ---).'])
  }
  let parsed: Partial<SkillFrontmatter>
  try {
    parsed = parseYaml(match[1]) as Partial<SkillFrontmatter>
  } catch (err) {
    throw new CustomSkillValidationError([
      `Frontmatter YAML did not parse: ${(err as Error).message}`,
    ])
  }
  const issues: string[] = []
  if (!parsed?.name) issues.push('Missing required `name`.')
  if (!parsed?.description) issues.push('Missing required `description`.')
  if (parsed?.name && !/^[a-z0-9][a-z0-9-]*$/.test(parsed.name)) {
    issues.push('`name` must be kebab-case (a-z 0-9 -).')
  }
  if (issues.length > 0) throw new CustomSkillValidationError(issues)
  return parsed as SkillFrontmatter
}

/**
 * Upload or replace a custom skill. Validates frontmatter, writes the blob,
 * upserts the metadata row.
 */
export async function saveCustomSkill(input: CustomSkillSaveInput): Promise<CustomSkillRow> {
  const frontmatter = parseFrontmatter(input.content)
  if (frontmatter.name !== input.skillId) {
    throw new CustomSkillValidationError([
      `frontmatter.name "${frontmatter.name}" must match the skill id "${input.skillId}".`,
    ])
  }

  const refs = input.references ?? {}
  const fileEntries = Object.entries(refs)
  if (fileEntries.length > MAX_FILES) {
    throw new CustomSkillValidationError([`Too many files (max ${MAX_FILES}).`])
  }

  const fileIssues: string[] = []
  for (const [path, content] of fileEntries) {
    if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
      fileIssues.push(`Path "${path}" must start with references/ or scripts/.`)
    }
    if (path.includes('..') || path.startsWith('/')) {
      fileIssues.push(`Path "${path}" must be relative without "..".`)
    }
    if (Buffer.byteLength(content, 'utf8') > PER_FILE_MAX_BYTES) {
      fileIssues.push(`File "${path}" exceeds ${PER_FILE_MAX_BYTES} bytes.`)
    }
  }
  if (fileIssues.length > 0) throw new CustomSkillValidationError(fileIssues)

  const storage = getStorageProvider()
  const skillPath = blobPath(input.projectId, input.skillId)
  const skillUpload = await storage.upload(AUTOMATIONS_BUCKET, skillPath, input.content, {
    upsert: true,
    contentType: 'text/markdown; charset=utf-8',
  })
  if (skillUpload.error) {
    throw new Error(`Failed to upload skill content: ${skillUpload.error.message}`)
  }

  const fileManifest = await Promise.all(
    fileEntries.map(async ([relPath, content]) => {
      const fullPath = `${input.projectId}/${input.skillId}/${relPath}`
      const contentType = guessContentType(relPath)
      const result = await storage.upload(AUTOMATIONS_BUCKET, fullPath, content, {
        upsert: true,
        contentType,
      })
      if (result.error) {
        throw new Error(`Failed to upload "${relPath}": ${result.error.message}`)
      }
      return {
        path: relPath,
        size: Buffer.byteLength(content, 'utf8'),
        contentType,
      } satisfies CustomSkillFile
    }),
  )

  return upsertCustomSkill({
    project_id: input.projectId,
    skill_id: input.skillId,
    name: frontmatter.name,
    description: frontmatter.description,
    version: frontmatter.version ?? null,
    blob_path: skillPath,
    frontmatter: frontmatter as unknown as Record<string, unknown>,
    files: fileManifest as unknown as Record<string, unknown>,
    enabled: true,
    created_by_user_id: input.createdByUserId ?? null,
  })
}

function guessContentType(path: string): string {
  if (path.endsWith('.md')) return 'text/markdown; charset=utf-8'
  if (path.endsWith('.json')) return 'application/json; charset=utf-8'
  if (path.endsWith('.sh')) return 'application/x-sh; charset=utf-8'
  if (path.endsWith('.js') || path.endsWith('.ts')) return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

/** Read a single supporting file's content (referenced via files[].path). */
export async function readCustomSkillFile(
  projectId: string,
  skillId: string,
  relPath: string,
): Promise<string | null> {
  if (!ALLOWED_PREFIXES.some((p) => relPath.startsWith(p))) return null
  if (relPath.includes('..') || relPath.startsWith('/')) return null
  const storage = getStorageProvider()
  const fullPath = `${projectId}/${skillId}/${relPath}`
  const result = await storage.downloadText(AUTOMATIONS_BUCKET, fullPath)
  if (result.error) return null
  return result.content ?? null
}

export async function listCustomSkillDescriptors(projectId: string): Promise<SkillDescriptor[]> {
  const rows = await listCustomSkillRows(projectId)
  return rows.map((row) => ({
    source: 'custom' as const,
    id: row.skill_id,
    frontmatter: row.frontmatter as unknown as SkillFrontmatter,
    path: row.blob_path,
  }))
}

export async function getCustomSkillDescriptor(
  projectId: string,
  skillId: string,
): Promise<SkillDescriptor | null> {
  const row = await getCustomSkillRow(projectId, skillId)
  if (!row) return null
  return {
    source: 'custom',
    id: row.skill_id,
    frontmatter: row.frontmatter as unknown as SkillFrontmatter,
    path: row.blob_path,
  }
}

/** Read the raw SKILL.md content for a custom skill. */
export async function readCustomSkillContent(
  projectId: string,
  skillId: string,
): Promise<string | null> {
  const row = await getCustomSkillRow(projectId, skillId)
  if (!row) return null
  const storage = getStorageProvider()
  const result = await storage.downloadText(AUTOMATIONS_BUCKET, row.blob_path)
  if (result.error) return null
  return result.content ?? null
}

export type CustomSkillBundle = {
  skillMd: string
  files: Array<{ path: string; content: string }>
}

/**
 * One-shot fetch of everything the runner needs to materialize a custom
 * skill: the SKILL.md body plus every `references/` / `scripts/` file from
 * the manifest, downloaded in parallel. Single DB row read, no extra trips.
 */
export async function getCustomSkillBundle(
  projectId: string,
  skillId: string,
): Promise<CustomSkillBundle | null> {
  const row = await getCustomSkillRow(projectId, skillId)
  if (!row) return null
  const storage = getStorageProvider()
  const manifest = (row.files as unknown as CustomSkillFile[] | null) ?? []

  const [skillResult, fileResults] = await Promise.all([
    storage.downloadText(AUTOMATIONS_BUCKET, row.blob_path),
    Promise.all(
      manifest.map(async (f) => {
        const fullPath = `${projectId}/${skillId}/${f.path}`
        const r = await storage.downloadText(AUTOMATIONS_BUCKET, fullPath)
        return { path: f.path, content: r.content ?? null }
      }),
    ),
  ])
  if (skillResult.error || !skillResult.content) return null

  return {
    skillMd: skillResult.content,
    files: fileResults
      .filter((f): f is { path: string; content: string } => f.content !== null),
  }
}

export async function deleteCustomSkill(projectId: string, skillId: string): Promise<boolean> {
  const row = await getCustomSkillRow(projectId, skillId)
  if (!row) return false
  const storage = getStorageProvider()
  const files = (row.files as unknown as CustomSkillFile[] | null) ?? []
  const allPaths = [
    row.blob_path,
    ...files.map((f) => `${projectId}/${skillId}/${f.path}`),
  ]
  // Best-effort blob delete; the row is the source of truth.
  await storage.delete(AUTOMATIONS_BUCKET, allPaths).catch((err) => {
    console.error('[custom-skills] failed to delete blob', err)
  })
  return deleteCustomSkillRow(projectId, skillId)
}
