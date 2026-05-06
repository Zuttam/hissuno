/**
 * `hissuno automations state <verb>` — durable per-(project, skill) state.
 *
 * Skill scripts use this to persist cursors, last-synced IDs, and other
 * resumable bookkeeping that must survive between runs.
 *
 *   hissuno automations state get --skill <id>           — print state JSON
 *   hissuno automations state set --skill <id> --json -  — write state from stdin
 *   hissuno automations state delete --skill <id>        — clear state
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, buildPath, resolveProjectId } from '../lib/api.js'
import { error, renderJson } from '../lib/output.js'

interface StateResponse {
  state: Record<string, unknown>
  updatedAt?: string
}

async function readStdinJson(): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  const text = Buffer.concat(chunks).toString('utf-8').trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('stdin must be a JSON object')
    }
    return parsed as Record<string, unknown>
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse stdin JSON: ${msg}`)
  }
}

export const automationsCommand = new Command('automations')
  .description('Automation skill helpers.')

const stateCommand = new Command('state').description('Per-skill durable state.')

stateCommand
  .command('get')
  .description('Print the current state JSON for a skill.')
  .requiredOption('--skill <skillId>', 'Skill id (matches SKILL.md folder name).')
  .action(async (opts: { skill: string }) => {
    const config = requireConfig()
    const projectId = await resolveProjectId(config)
    const path = buildPath('/api/automations/state', { projectId, skillId: opts.skill })
    const result = await apiCall<StateResponse | { error: string }>(config, 'GET', path)
    if (!result.ok) {
      const message = (result.data as { error?: string })?.error ?? `HTTP ${result.status}`
      error(`Failed to read state: ${message}`)
      process.exit(1)
    }
    renderJson((result.data as StateResponse).state ?? {})
  })

stateCommand
  .command('set')
  .description('Write state JSON for a skill. Reads JSON from stdin.')
  .requiredOption('--skill <skillId>', 'Skill id.')
  .option('--json <flag>', "Pass '-' to read from stdin (default).")
  .action(async (opts: { skill: string }) => {
    const config = requireConfig()
    const projectId = await resolveProjectId(config)
    let state: Record<string, unknown>
    try {
      state = await readStdinJson()
    } catch (err) {
      error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
    const path = buildPath('/api/automations/state', { projectId, skillId: opts.skill })
    const result = await apiCall<StateResponse | { error: string }>(config, 'PUT', path, { state })
    if (!result.ok) {
      const message = (result.data as { error?: string })?.error ?? `HTTP ${result.status}`
      error(`Failed to write state: ${message}`)
      process.exit(1)
    }
    renderJson(result.data)
  })

stateCommand
  .command('delete')
  .description('Clear state for a skill.')
  .requiredOption('--skill <skillId>', 'Skill id.')
  .action(async (opts: { skill: string }) => {
    const config = requireConfig()
    const projectId = await resolveProjectId(config)
    const path = buildPath('/api/automations/state', { projectId, skillId: opts.skill })
    const result = await apiCall<{ ok?: boolean; error?: string }>(config, 'DELETE', path)
    if (!result.ok) {
      const message = result.data?.error ?? `HTTP ${result.status}`
      error(`Failed to delete state: ${message}`)
      process.exit(1)
    }
    process.stdout.write('OK\n')
  })

automationsCommand.addCommand(stateCommand)
