/**
 * hissuno config - Manual configuration wizard
 *
 * Interactive setup for connecting the CLI to an existing Hissuno instance:
 *   1. API key + base URL
 *   2. Validate credentials
 *   3. Auto-detect project
 *   4. Optionally connect data sources
 *
 * Subcommands:
 *   hissuno config show  — display current configuration
 */

import { Command } from 'commander'
import { input, password, confirm, select } from '@inquirer/prompts'
import { loadConfig, saveConfig, getActiveProfileName, type HissunoConfig } from '../lib/config.js'
import { apiCall } from '../lib/api.js'
import { renderJson, success, error } from '../lib/output.js'
import {
  PLATFORMS,
  PLATFORM_LABELS,
  OAUTH_PLATFORMS,
  connectOAuth,
  connectGong,
  connectZendesk,
  connectIntercom,
  connectFathom,
  connectHubspot,
  connectNotion,
  type Platform,
} from './integrations.js'

const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'

/**
 * Run the interactive config wizard. Returns the validated config.
 * Used by both `hissuno config` and `hissuno profile create`.
 */
export async function runConfigWizard(): Promise<HissunoConfig> {
  console.log(`\n${BOLD}Step 1: Authentication${RESET}`)

  const apiKey = await password({
    message: 'API key (hiss_...):',
    mask: '*',
    validate: (val) => {
      if (!val.startsWith('hiss_')) return 'API key must start with hiss_'
      if (val.length < 10) return 'API key is too short'
      return true
    },
  })

  const baseUrl = await input({
    message: 'Hissuno URL:',
    default: 'http://localhost:3000',
    validate: (val) => {
      try {
        new URL(val)
        return true
      } catch {
        return 'Must be a valid URL'
      }
    },
  })

  const normalizedUrl = baseUrl.replace(/\/+$/, '')
  const config: HissunoConfig = { api_key: apiKey, base_url: normalizedUrl }

  process.stdout.write('Validating... ')

  try {
    const result = await apiCall<{ projects?: { id: string; name: string }[] }>(config, 'GET', '/api/projects')
    const projects = Array.isArray(result.data) ? result.data : result.data?.projects

    if (!result.ok || !Array.isArray(projects) || projects.length === 0) {
      const data = result.data as { error?: string }
      console.log('')
      error(`Validation failed: ${(data as Record<string, string>).error || `HTTP ${result.status}`}`)
      process.exit(1)
    }

    const projectName = projects[0].name
    const projectId = projects[0].id
    success('Authenticated.')

    console.log(`\n${BOLD}Step 2: Project${RESET}`)
    console.log(`Using project: ${BOLD}${projectName}${RESET} (${DIM}${projectId}${RESET})`)

    config.project_id = projectId
    return config
  } catch (err) {
    console.log('')
    error(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}

export const configCommand = new Command('config')
  .description('Configure CLI connection (API key, URL, project)')
  .action(async () => {
    console.log(`\n${BOLD}${CYAN}Hissuno Config${RESET}`)
    console.log(`${DIM}Connect the CLI to your Hissuno instance.${RESET}\n`)

    // Check for existing config
    const existing = loadConfig()
    if (existing) {
      const reconfigure = await confirm({
        message: 'Existing configuration found. Reconfigure?',
        default: false,
      })
      if (!reconfigure) {
        console.log('Keeping existing configuration.')
        return
      }
    }

    const fullConfig = await runConfigWizard()
    saveConfig(fullConfig)
    success('Configuration saved to ~/.hissuno/config.json')

    // -----------------------------------------------------------------------
    // Step 3: Connect Data Sources (optional)
    // -----------------------------------------------------------------------
    console.log(`\n${BOLD}Step 3: Connect Data Sources (optional)${RESET}`)

    let connectMore = await confirm({
      message: 'Would you like to connect a data source?',
      default: true,
    })

    while (connectMore) {
      const platform = await select<Platform>({
        message: 'Select a platform:',
        choices: PLATFORMS.map((p) => ({
          value: p,
          name: PLATFORM_LABELS[p],
        })),
      })

      if (OAUTH_PLATFORMS.includes(platform)) {
        await connectOAuth(fullConfig, platform, fullConfig.project_id!)
      } else if (platform === 'gong') {
        await connectGong(fullConfig, fullConfig.project_id!, {})
      } else if (platform === 'zendesk') {
        await connectZendesk(fullConfig, fullConfig.project_id!, {})
      } else if (platform === 'intercom') {
        await connectIntercom(fullConfig, fullConfig.project_id!, {})
      } else if (platform === 'fathom') {
        await connectFathom(fullConfig, fullConfig.project_id!, {})
      } else if (platform === 'hubspot') {
        await connectHubspot(fullConfig, fullConfig.project_id!, {})
      } else if (platform === 'notion') {
        await connectNotion(fullConfig, fullConfig.project_id!, {})
      }

      connectMore = await confirm({
        message: 'Connect another?',
        default: false,
      })
    }

    // -----------------------------------------------------------------------
    // Done
    // -----------------------------------------------------------------------
    console.log('')
    success('Configuration complete!')
    console.log(`
${DIM}Next steps:${RESET}
  hissuno status                   Check connection health
  hissuno search "checkout bugs"   Search your intelligence
  hissuno list feedback            List feedback sessions
  hissuno integrations             Manage integrations
`)
  })

// ---------------------------------------------------------------------------
// config show
// ---------------------------------------------------------------------------

function maskApiKey(key: string): string {
  if (key.length <= 8) return key
  return key.slice(0, 8) + '*'.repeat(12)
}

configCommand
  .command('show')
  .description('Display current configuration')
  .action(async (_, cmd) => {
    const json = cmd.parent?.parent?.opts().json

    const config = loadConfig()
    if (!config) {
      if (json) {
        console.log(renderJson({ error: 'Not configured' }))
      } else {
        console.log('Not configured. Run `hissuno config` to set up.')
      }
      return
    }

    const profileName = getActiveProfileName()

    if (json) {
      console.log(renderJson({
        profile: profileName,
        api_key: maskApiKey(config.api_key),
        base_url: config.base_url,
        project_id: config.project_id ?? null,
      }))
      return
    }

    console.log(`\n  ${BOLD}${CYAN}Hissuno Configuration${RESET}\n`)
    console.log(`  ${DIM}Profile:${RESET}  ${profileName}`)
    console.log(`  ${DIM}API Key:${RESET}  ${maskApiKey(config.api_key)}`)
    console.log(`  ${DIM}URL:${RESET}      ${config.base_url}`)
    if (config.project_id) {
      console.log(`  ${DIM}Project:${RESET}  ${config.project_id}`)
    }
    console.log()
  })
