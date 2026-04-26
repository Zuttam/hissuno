/**
 * Skill catalog resolver.
 *
 * Discovers bundled skills (under `packages/skills/`) and combines them with
 * project-scoped custom skills from blob storage.
 *
 * The base "hissuno" skill is intentionally excluded from the automation
 * catalog: it's documentation distributed for local Claude/Cursor use, not a
 * server-run automation.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import type { SkillDescriptor, SkillFrontmatter } from './types'

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/

const EXCLUDED_BUNDLED_SKILLS = new Set(['hissuno'])

/** Resolve the bundled skills directory at runtime. */
function resolveBundledSkillsDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, '..', '..', '..', 'packages', 'skills'),
    join(here, '..', '..', '..', '..', 'packages', 'skills'),
    join(process.cwd(), 'packages', 'skills'),
    join(process.cwd(), 'app', 'packages', 'skills'),
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
 * subdirectory and skips any that don't parse cleanly or are in the excluded
 * set.
 */
export function listBundledSkills(): SkillDescriptor[] {
  const dir = resolveBundledSkillsDir()
  if (!dir) return []

  const entries = readdirSync(dir, { withFileTypes: true })
  const descriptors: SkillDescriptor[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (EXCLUDED_BUNDLED_SKILLS.has(entry.name)) continue

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
 * Look up a single skill by id. Bundled-only for v1; custom skills are wired
 * in Phase 7 once blob storage upload exists.
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
