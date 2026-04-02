/**
 * hissuno profile - Multi-profile management
 *
 * Manage multiple CLI configurations for different Hissuno instances or projects.
 *
 *   hissuno profile list              List all profiles
 *   hissuno profile use <name>        Switch active profile
 *   hissuno profile create <name>     Create a new profile via config wizard
 *   hissuno profile delete <name>     Remove a profile
 */

import { Command } from 'commander'
import {
  migrateToMultiProfile,
  setActiveProfile,
  createProfile,
  deleteProfile,
} from '../lib/config.js'
import { renderJson, success, error, BOLD, DIM, RESET, CYAN, GREEN } from '../lib/output.js'
import { runConfigWizard } from './config.js'

function getJson(cmd: Command): boolean {
  return cmd.parent?.parent?.opts().json ?? false
}

export const profileCommand = new Command('profile')
  .description('Manage configuration profiles')

// ---------------------------------------------------------------------------
// profile list
// ---------------------------------------------------------------------------

profileCommand
  .command('list')
  .description('List all profiles')
  .action((_, cmd) => {
    const json = getJson(cmd)
    const full = migrateToMultiProfile()
    const names = Object.keys(full.profiles)

    if (json) {
      console.log(renderJson({
        active: full.active_profile,
        profiles: names,
      }))
      return
    }

    console.log(`\n  ${BOLD}${CYAN}Profiles${RESET}\n`)

    if (names.length === 0) {
      console.log(`  ${DIM}No profiles configured. Run \`hissuno profile create <name>\` to create one.${RESET}\n`)
      return
    }

    for (const name of names) {
      const marker = name === full.active_profile ? `${GREEN}* ${RESET}` : '  '
      const profile = full.profiles[name]
      const url = profile.base_url ? `${DIM}${profile.base_url}${RESET}` : ''
      console.log(`  ${marker}${BOLD}${name}${RESET}  ${url}`)
    }
    console.log()
  })

// ---------------------------------------------------------------------------
// profile use
// ---------------------------------------------------------------------------

profileCommand
  .command('use <name>')
  .description('Switch active profile')
  .action((name: string, _, cmd) => {
    const json = getJson(cmd)
    migrateToMultiProfile()

    try {
      setActiveProfile(name)
    } catch (err) {
      if (json) {
        console.log(renderJson({ error: (err as Error).message }))
      } else {
        error((err as Error).message)
      }
      process.exit(1)
    }

    if (json) {
      console.log(renderJson({ active: name }))
    } else {
      success(`Switched to profile "${name}".`)
    }
  })

// ---------------------------------------------------------------------------
// profile create
// ---------------------------------------------------------------------------

profileCommand
  .command('create <name>')
  .description('Create a new profile via config wizard')
  .option('--api-key <key>', 'API key (hiss_...)')
  .option('--url <url>', 'Hissuno instance URL')
  .action(async (name: string, opts, cmd) => {
    const json = getJson(cmd)
    migrateToMultiProfile()

    console.log(`\n${BOLD}${CYAN}Create Profile: ${name}${RESET}`)
    console.log(`${DIM}Configure connection for this profile.${RESET}\n`)

    const wizardOpts: { apiKey?: string; url?: string } = {}
    if (opts.apiKey) wizardOpts.apiKey = opts.apiKey
    if (opts.url) wizardOpts.url = opts.url

    const config = await runConfigWizard(Object.keys(wizardOpts).length > 0 ? wizardOpts : undefined)

    try {
      createProfile(name, config)
    } catch (err) {
      if (json) {
        console.log(renderJson({ error: (err as Error).message }))
      } else {
        error((err as Error).message)
      }
      process.exit(1)
    }

    if (json) {
      console.log(renderJson({ created: name }))
    } else {
      success(`Profile "${name}" created.`)
      console.log(`${DIM}Switch to it with: hissuno profile use ${name}${RESET}\n`)
    }
  })

// ---------------------------------------------------------------------------
// profile delete
// ---------------------------------------------------------------------------

profileCommand
  .command('delete <name>')
  .description('Remove a profile')
  .action((name: string, _, cmd) => {
    const json = getJson(cmd)
    migrateToMultiProfile()

    try {
      deleteProfile(name)
    } catch (err) {
      if (json) {
        console.log(renderJson({ error: (err as Error).message }))
      } else {
        error((err as Error).message)
      }
      process.exit(1)
    }

    if (json) {
      console.log(renderJson({ deleted: name }))
    } else {
      success(`Profile "${name}" deleted.`)
    }
  })
