/**
 * Project-scoped custom skill storage.
 *
 * Custom skills are user-uploaded automation skills (SKILL.md + optional
 * frontmatter). They live in two places:
 *
 * - Metadata row in `custom_skills` (Postgres): id, frontmatter snapshot,
 *   blob_path. Used for fast catalog rendering and trigger validation
 *   without round-tripping the blob on every list.
 * - The SKILL.md content itself in blob storage (FileStorageProvider —
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
  createdByUserId?: string | null
}

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

  const path = blobPath(input.projectId, input.skillId)
  const storage = getStorageProvider()
  const result = await storage.upload(AUTOMATIONS_BUCKET, path, input.content, {
    upsert: true,
    contentType: 'text/markdown; charset=utf-8',
  })
  if (result.error) {
    throw new Error(`Failed to upload skill content: ${result.error.message}`)
  }

  return upsertCustomSkill({
    project_id: input.projectId,
    skill_id: input.skillId,
    name: frontmatter.name,
    description: frontmatter.description,
    version: frontmatter.version ?? null,
    blob_path: path,
    frontmatter: frontmatter as unknown as Record<string, unknown>,
    enabled: true,
    created_by_user_id: input.createdByUserId ?? null,
  })
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

export async function deleteCustomSkill(projectId: string, skillId: string): Promise<boolean> {
  const row = await getCustomSkillRow(projectId, skillId)
  if (!row) return false
  const storage = getStorageProvider()
  // Best-effort blob delete; the row is the source of truth.
  await storage.delete(AUTOMATIONS_BUCKET, [row.blob_path]).catch((err) => {
    console.error('[custom-skills] failed to delete blob', err)
  })
  return deleteCustomSkillRow(projectId, skillId)
}
