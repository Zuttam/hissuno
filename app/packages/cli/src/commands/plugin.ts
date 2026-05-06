/**
 * `hissuno plugin <verb>` — credential lookup for skill scripts.
 *
 *   hissuno plugin token <pluginId>      — print the active access token
 *   hissuno plugin connection <pluginId> — print the full connection JSON
 *
 * Both refresh expiring OAuth tokens server-side and persist the new credentials.
 * Skill scripts running inside the sandbox already have `<PLUGIN>_ACCESS_TOKEN`
 * injected as an env var for any plugin listed in `requires.plugins`, so these
 * verbs are mostly for ad-hoc use, multi-connection projects, or scripts that
 * need fields beyond the access token.
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, buildPath, resolveProjectId } from '../lib/api.js'
import { error, renderJson } from '../lib/output.js'

interface ConnectionResponse {
  pluginId: string
  connectionId: string
  externalAccountId: string
  accountLabel: string
  accessToken: string
  credentials?: Record<string, unknown>
  settings?: Record<string, unknown>
}

export const pluginCommand = new Command('plugin')
  .description('Plugin connection helpers (skill-script use).')

pluginCommand
  .command('token <pluginId>')
  .description('Print the active access token for a connected plugin.')
  .option('--external-account-id <id>', 'Disambiguate when multiple connections exist.')
  .option('--connection-id <id>', 'Pick a specific connection by id.')
  .action(async (pluginId: string, opts: { externalAccountId?: string; connectionId?: string }) => {
    const config = requireConfig()
    const projectId = await resolveProjectId(config)

    const path = buildPath(`/api/plugins/${pluginId}/token`, {
      projectId,
      externalAccountId: opts.externalAccountId,
      connectionId: opts.connectionId,
    })
    const result = await apiCall<ConnectionResponse | { error: string }>(config, 'GET', path)
    if (!result.ok) {
      const message = (result.data as { error?: string })?.error ?? `HTTP ${result.status}`
      error(`Failed to fetch token: ${message}`)
      process.exit(1)
    }
    const data = result.data as ConnectionResponse
    if (process.argv.includes('--json')) {
      renderJson(data)
    } else {
      // Default: just the token, so it's pipe-friendly:
      //   export TOKEN=$(hissuno plugin token slack)
      process.stdout.write(`${data.accessToken}\n`)
    }
  })

pluginCommand
  .command('connection <pluginId>')
  .description('Print the full connection JSON (credentials + settings).')
  .option('--external-account-id <id>', 'Disambiguate when multiple connections exist.')
  .option('--connection-id <id>', 'Pick a specific connection by id.')
  .action(async (pluginId: string, opts: { externalAccountId?: string; connectionId?: string }) => {
    const config = requireConfig()
    const projectId = await resolveProjectId(config)

    const path = buildPath(`/api/plugins/${pluginId}/connection`, {
      projectId,
      externalAccountId: opts.externalAccountId,
      connectionId: opts.connectionId,
    })
    const result = await apiCall<ConnectionResponse | { error: string }>(config, 'GET', path)
    if (!result.ok) {
      const message = (result.data as { error?: string })?.error ?? `HTTP ${result.status}`
      error(`Failed to fetch connection: ${message}`)
      process.exit(1)
    }
    renderJson(result.data)
  })
