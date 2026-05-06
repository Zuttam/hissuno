/**
 * Skill catalog resolver.
 *
 * Discovers bundled automation skills (sibling `skills/` directory) and
 * combines them with project-scoped custom skills from blob storage.
 *
 * These are server-run automations — distinct from the user-facing skills in
 * `packages/skills/`, which are shipped via the CLI for installation into the
 * user's own Claude/Cursor environment.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import type { SkillDescriptor, SkillFrontmatter } from './types'

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/

/** Resolve the bundled automation skills directory at runtime. */
function resolveBundledSkillsDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, 'skills'),
    join(process.cwd(), 'src', 'lib', 'automations', 'skills'),
    join(process.cwd(), 'app', 'src', 'lib', 'automations', 'skills'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return null
  try {
    const parsed = parseYaml(match[1]) as Partial<SkillFrontmatter>
    if (!parsed?.name || !parsed?.description) return null
    return parsed as SkillFrontmatter
  } catch {
    return null
  }
}

/**
 * List bundled skills as descriptors. Reads SKILL.md frontmatter for each
 * subdirectory and skips any that don't parse cleanly.
 */
export function listBundledSkills(): SkillDescriptor[] {
  const dir = resolveBundledSkillsDir()
  if (!dir) return []

  const entries = readdirSync(dir, { withFileTypes: true })
  const descriptors: SkillDescriptor[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillPath = join(dir, entry.name)
    const skillFile = join(skillPath, 'SKILL.md')
    if (!existsSync(skillFile)) continue

    const content = readFileSync(skillFile, 'utf8')
    const frontmatter = parseFrontmatter(content)
    if (!frontmatter) continue

    // Frontmatter `name` should match the folder name; folder name wins as
    // the canonical id (used in DB rows + URLs).
    descriptors.push({
      source: 'bundled',
      id: entry.name,
      frontmatter: { ...frontmatter, name: entry.name },
      path: skillPath,
    })
  }

  return descriptors
}

/**
 * Look up a bundled skill by id. Custom skills are project-scoped and
 * resolved separately via `findSkillForProject` in `dispatch.ts`.
 */
export function findSkill(skillId: string): SkillDescriptor | null {
  return listBundledSkills().find((s) => s.id === skillId) ?? null
}

/**
 * Resolve and read the SKILL.md body (markdown only, no frontmatter).
 *
 * The skill-runner agent uses this to load instructions on demand via the
 * `skill` tool that Mastra's Workspace exposes.
 */
export function readSkillBody(descriptor: SkillDescriptor): string {
  const file = join(descriptor.path, 'SKILL.md')
  const content = readFileSync(file, 'utf8')
  return content.replace(FRONTMATTER_RE, '').replace(/^\n+/, '')
}
