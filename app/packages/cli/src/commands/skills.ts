/**
 * hissuno skills - Install Hissuno skills into agent environments
 *
 *   hissuno skills list                List all available skills
 *   hissuno skills install [slugs...]  Install specific or all skills
 *   hissuno skills uninstall [slugs..] Remove specific or all skills
 *   hissuno skills status              Show install state per skill per location
 */

import { Command } from 'commander'
import { existsSync, cpSync, rmSync, readdirSync, readFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { confirm } from '@inquirer/prompts'
import { renderJson, success, error, warn, BOLD, DIM, RESET, CYAN, GREEN } from '../lib/output.js'

const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills')
const CURSOR_SKILLS_DIR = join(homedir(), '.cursor', 'skills')

interface SkillMeta {
  slug: string
  name: string
  description: string
  version: string
  author: string
  path: string
}


function getJson(cmd: Command): boolean {
  return cmd.parent?.parent?.opts().json ?? false
}

/**
 * Return the names of valid skill subdirectories (those containing SKILL.md).
 */
function getSkillNames(skillsDir: string): string[] {
  if (!existsSync(skillsDir)) return []
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(join(skillsDir, e.name, 'SKILL.md')))
    .map(e => e.name)
}

/**
 * Resolve the bundled skills directory (the parent containing skill subdirs).
 * Each subdirectory must contain a SKILL.md to be considered a valid skill.
 */
function getBundledSkillsPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url))

  const candidates = [
    join(thisDir, 'skills'),
    join(thisDir, '..', 'skills'),
    join(thisDir, '..', '..', 'skills'),
    join(thisDir, '..', '..', '..', 'skills'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate) && getSkillNames(candidate).length > 0) return candidate
  }

  throw new Error('Bundled skills not found. Package may be corrupted.')
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) count++
    else if (entry.isDirectory()) count += countFiles(join(dir, entry.name))
  }
  return count
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Handles simple key: value pairs and nested metadata block.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const result: Record<string, string> = {}
  const lines = match[1].split('\n')

  for (const line of lines) {
    // Skip nested keys, multiline continuations, and empty lines
    if (line.startsWith('  ')) {
      // Nested metadata fields like "  author: hissuno"
      const nested = line.trim().match(/^(\w+):\s*(.+)$/)
      if (nested) result[nested[1]] = nested[2].replace(/^["']|["']$/g, '')
      continue
    }

    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) {
      const val = kv[2].trim()
      // Skip block indicators (>, |) - the description will be on the next lines
      if (val === '>' || val === '|') continue
      result[kv[1]] = val.replace(/^["']|["']$/g, '')
    }
  }

  // Handle multiline description (>)
  if (!result['description']) {
    const descMatch = content.match(/description:\s*>\n([\s\S]*?)(?=\n\w|\n---)/m)
    if (descMatch) {
      result['description'] = descMatch[1]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ')
    }
  }

  return result
}

/**
 * Discover all skill directories under the bundled root.
 */
function discoverSkills(rootDir: string): SkillMeta[] {
  const skills: SkillMeta[] = []

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillDir = join(rootDir, entry.name)
    const skillMd = join(skillDir, 'SKILL.md')
    if (!existsSync(skillMd)) continue

    const content = readFileSync(skillMd, 'utf-8')
    const fm = parseFrontmatter(content)

    skills.push({
      slug: entry.name,
      name: fm['name'] || entry.name,
      description: fm['description'] || '',
      version: fm['version'] || '0.0',
      author: fm['author'] || 'unknown',
      path: skillDir,
    })
  }

  return skills.sort((a, b) => a.slug.localeCompare(b.slug))
}

function resolveTargetDir(opts: { cursor?: boolean; path?: string }): string {
  if (opts.path) return opts.path
  if (opts.cursor) return CURSOR_SKILLS_DIR
  return CLAUDE_SKILLS_DIR
}

function getLocationInfo(name: string, skillPath: string): { name: string; installed: boolean; fileCount: number } {
  const installed = existsSync(skillPath) && existsSync(join(skillPath, 'SKILL.md'))
  return {
    name,
    installed,
    fileCount: installed ? countFiles(skillPath) : 0,
  }
}

export const skillsCommand = new Command('skills')
  .description('Install Hissuno skills into agent environments')

// ---------------------------------------------------------------------------
// skills list
// ---------------------------------------------------------------------------

skillsCommand
  .command('list')
  .description('List all available skills')
  .action((_, cmd) => {
    const json = getJson(cmd)

    let rootDir: string
    try {
      rootDir = getBundledSkillsPath()
    } catch (err) {
      if (json) {
        console.log(renderJson({ error: (err as Error).message }))
      } else {
        error((err as Error).message)
      }
      process.exit(1)
    }

    const skills = discoverSkills(rootDir)

    if (json) {
      console.log(renderJson(skills.map((s) => ({
        slug: s.slug,
        name: s.name,
        version: s.version,
        author: s.author,
        description: s.description,
      }))))
      return
    }

    if (skills.length === 0) {
      warn('No skills found.')
      return
    }

    console.log(`\n  ${BOLD}${CYAN}Available Skills${RESET}\n`)

    const maxSlug = Math.max(...skills.map((s) => s.slug.length))
    const maxVer = Math.max(...skills.map((s) => s.version.length))

    for (const skill of skills) {
      const slug = skill.slug.padEnd(maxSlug)
      const ver = `v${skill.version}`.padEnd(maxVer + 1)
      console.log(`  ${BOLD}${slug}${RESET}  ${DIM}${ver}${RESET}  ${skill.description}`)
    }
    console.log()
  })

// ---------------------------------------------------------------------------
// skills install
// ---------------------------------------------------------------------------

skillsCommand
  .command('install')
  .description('Install Hissuno skills')
  .option('--cursor', 'Install to Cursor skills directory')
  .option('--path <dir>', 'Install to a custom directory')
  .option('--force', 'Overwrite without prompting')
  .option('--skill <name>', 'Install a specific skill only')
  .action(async (opts, cmd) => {
    const json = getJson(cmd)

    if (opts.cursor && opts.path) {
      if (json) {
        console.log(renderJson({ error: '--cursor and --path are mutually exclusive' }))
      } else {
        error('--cursor and --path are mutually exclusive.')
      }
      process.exit(1)
    }

    let srcDir: string
    try {
      srcDir = getBundledSkillsPath()
    } catch (err) {
      if (json) {
        console.log(renderJson({ error: (err as Error).message }))
      } else {
        error((err as Error).message)
      }
      process.exit(1)
    }

    const targetBase = resolveTargetDir(opts)
    const allSkills = getSkillNames(srcDir)

    if (opts.skill && !allSkills.includes(opts.skill)) {
      const msg = `Unknown skill "${opts.skill}". Available: ${allSkills.join(', ')}`
      if (json) {
        console.log(renderJson({ error: msg }))
      } else {
        error(msg)
      }
      process.exit(1)
    }

    const skillsToInstall = opts.skill ? [opts.skill] : allSkills
    const results: { name: string; path: string; files: number }[] = []

    for (const name of skillsToInstall) {
      const src = join(srcDir, name)
      const dest = join(targetBase, name)

      if (existsSync(dest) && existsSync(join(dest, 'SKILL.md')) && !opts.force) {
        const overwrite = await confirm({
          message: `Skill "${name}" already installed at ${dest}. Overwrite?`,
          default: false,
        })
        if (!overwrite) {
          if (!json) console.log(`  Skipped ${name}`)
          continue
        }
      }

      if (!existsSync(targetBase)) {
        mkdirSync(targetBase, { recursive: true })
      }

      if (existsSync(dest)) {
        rmSync(dest, { recursive: true })
      }
      cpSync(src, dest, { recursive: true })
      results.push({ name, path: dest, files: countFiles(dest) })
    }

    if (json) {
      console.log(renderJson(results))
    } else {
      for (const r of results) {
        success(`${r.name} installed to ${r.path} (${r.files} files)`)
      }
      if (results.length === 0) {
        console.log('No skills installed.')
      }
    }
  })

// ---------------------------------------------------------------------------
// skills uninstall
// ---------------------------------------------------------------------------

skillsCommand
  .command('uninstall')
  .description('Remove installed skills')
  .option('--cursor', 'Uninstall from Cursor skills directory')
  .option('--path <dir>', 'Uninstall from a custom directory')
  .option('--skill <name>', 'Uninstall a specific skill only')
  .action((opts, cmd) => {
    const json = getJson(cmd)

    if (opts.cursor && opts.path) {
      if (json) {
        console.log(renderJson({ error: '--cursor and --path are mutually exclusive' }))
      } else {
        error('--cursor and --path are mutually exclusive.')
      }
      process.exit(1)
    }

    const targetBase = resolveTargetDir(opts)

    if (opts.skill) {
      const dest = join(targetBase, opts.skill)
      if (!existsSync(dest)) {
        if (json) {
          console.log(renderJson({ error: `Skill "${opts.skill}" not installed at ${dest}` }))
        } else {
          warn(`Skill "${opts.skill}" not installed at ${dest}`)
        }
        return
      }
      rmSync(dest, { recursive: true })
      if (json) {
        console.log(renderJson({ uninstalled: [opts.skill], path: targetBase }))
      } else {
        success(`${opts.skill} removed from ${dest}`)
      }
      return
    }

    // Remove all hissuno skills
    const installed = getSkillNames(targetBase)
    if (installed.length === 0) {
      if (json) {
        console.log(renderJson({ error: 'No skills installed at this location' }))
      } else {
        warn(`No skills installed at ${targetBase}`)
      }
      return
    }

    for (const name of installed) {
      rmSync(join(targetBase, name), { recursive: true })
    }

    if (json) {
      console.log(renderJson({ uninstalled: installed, path: targetBase }))
    } else {
      success(`Removed ${installed.length} skill(s) from ${targetBase}: ${installed.join(', ')}`)
    }
  })

// ---------------------------------------------------------------------------
// skills status
// ---------------------------------------------------------------------------

skillsCommand
  .command('status')
  .description('Check skills installation status')
  .action((_, cmd) => {
    const json = getJson(cmd)

    const locations = [
      { name: 'Claude Code', base: CLAUDE_SKILLS_DIR },
      { name: 'Cursor', base: CURSOR_SKILLS_DIR },
    ]

    let srcDir: string | null = null
    try {
      srcDir = getBundledSkillsPath()
    } catch {
      // bundled skills unavailable - that's ok for status
    }

    const bundledSkills = srcDir ? getSkillNames(srcDir) : []

    const statusData = locations.map(loc => ({
      name: loc.name,
      path: loc.base,
      skills: bundledSkills.map(skill => getLocationInfo(skill, join(loc.base, skill))),
    }))

    if (json) {
      console.log(renderJson(statusData))
      return
    }

    console.log(`\n  ${BOLD}${CYAN}Skills Installation${RESET}\n`)

    for (const loc of statusData) {
      console.log(`  ${BOLD}${loc.name}${RESET}  ${DIM}${loc.path}${RESET}`)
      for (const skill of loc.skills) {
        const status = skill.installed
          ? `${GREEN}Installed${RESET}  (${skill.fileCount} files)`
          : `${DIM}Not found${RESET}`
        console.log(`    ${skill.name.padEnd(28)} ${status}`)
      }
      console.log()
    }
  })
