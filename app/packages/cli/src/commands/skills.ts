/**
 * hissuno skills - Install Hissuno skills into agent environments
 *
 *   hissuno skills install             Copy to ~/.claude/skills/hissuno/
 *   hissuno skills install --cursor    Copy to ~/.cursor/skills/hissuno/
 *   hissuno skills install --path <d>  Copy to custom location
 *   hissuno skills uninstall           Remove installed skills
 *   hissuno skills status              Show install state across known locations
 */

import { Command } from 'commander'
import { existsSync, cpSync, rmSync, readdirSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { confirm } from '@inquirer/prompts'
import { renderJson, success, error, warn, BOLD, DIM, RESET, CYAN, GREEN } from '../lib/output.js'

const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills', 'hissuno')
const CURSOR_SKILLS_DIR = join(homedir(), '.cursor', 'skills', 'hissuno')

interface LocationInfo {
  name: string
  path: string
  installed: boolean
  fileCount: number
}

function getJson(cmd: Command): boolean {
  return cmd.parent?.parent?.opts().json ?? false
}

/**
 * Resolve the bundled skills directory.
 * In prod (dist/): ../skills relative to the compiled JS file
 * In dev (src/): ../../../../skills/hissuno relative to src/commands/
 */
function getBundledSkillsPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url))

  // Bundled (tsup single-file): dist/index.js -> ../skills (via bin shim)
  // When linked or installed, import.meta.url resolves to the package root
  const candidates = [
    join(thisDir, 'skills'),               // tsup bundle: packageRoot/skills
    join(thisDir, '..', 'skills'),          // if thisDir is dist/
    join(thisDir, '..', '..', 'skills'),    // legacy nested structure
    join(thisDir, '..', '..', '..', 'skills', 'hissuno'), // dev: src/commands/
  ]

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'SKILL.md'))) return candidate
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

function getLocationInfo(name: string, path: string): LocationInfo {
  const installed = existsSync(path) && existsSync(join(path, 'SKILL.md'))
  return { name, path, installed, fileCount: installed ? countFiles(path) : 0 }
}

function resolveTargetDir(opts: { cursor?: boolean; path?: string }): string {
  if (opts.path) return opts.path
  if (opts.cursor) return CURSOR_SKILLS_DIR
  return CLAUDE_SKILLS_DIR
}

export const skillsCommand = new Command('skills')
  .description('Install Hissuno skills into agent environments')

// ---------------------------------------------------------------------------
// skills install
// ---------------------------------------------------------------------------

skillsCommand
  .command('install')
  .description('Install Hissuno skills')
  .option('--cursor', 'Install to Cursor skills directory')
  .option('--path <dir>', 'Install to a custom directory')
  .option('--force', 'Overwrite without prompting')
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

    const destDir = resolveTargetDir(opts)

    // Check if target exists
    if (existsSync(destDir) && existsSync(join(destDir, 'SKILL.md')) && !opts.force) {
      const overwrite = await confirm({
        message: `Skills already installed at ${destDir}. Overwrite?`,
        default: false,
      })
      if (!overwrite) {
        console.log('Skipped.')
        return
      }
    }

    // Ensure parent directory exists
    const parentDir = dirname(destDir)
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true })
    }

    // Remove existing and copy fresh
    if (existsSync(destDir)) {
      rmSync(destDir, { recursive: true })
    }
    cpSync(srcDir, destDir, { recursive: true })

    const fileCount = countFiles(destDir)

    if (json) {
      console.log(renderJson({ installed: true, path: destDir, files: fileCount }))
    } else {
      success(`Skills installed to ${destDir} (${fileCount} files)`)
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

    const destDir = resolveTargetDir(opts)

    if (!existsSync(destDir)) {
      if (json) {
        console.log(renderJson({ error: 'Skills not installed at this location' }))
      } else {
        warn(`Skills not installed at ${destDir}`)
      }
      return
    }

    rmSync(destDir, { recursive: true })

    if (json) {
      console.log(renderJson({ uninstalled: true, path: destDir }))
    } else {
      success(`Skills removed from ${destDir}`)
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
      getLocationInfo('Claude Code', CLAUDE_SKILLS_DIR),
      getLocationInfo('Cursor', CURSOR_SKILLS_DIR),
    ]

    if (json) {
      console.log(renderJson(locations.map(l => ({
        name: l.name,
        path: l.path,
        installed: l.installed,
        files: l.fileCount,
      }))))
      return
    }

    console.log(`\n  ${BOLD}${CYAN}Skills Installation${RESET}\n`)

    for (const loc of locations) {
      const status = loc.installed
        ? `${GREEN}Installed${RESET}  ${loc.path} (${loc.fileCount} files)`
        : `${DIM}Not found${RESET}`
      console.log(`  ${BOLD}${loc.name.padEnd(12)}${RESET} ${status}`)
    }
    console.log()
  })
