/**
 * `hissuno external-records <verb>` — external→hissuno mapping lookup.
 *
 * Skill scripts query this before fetching/creating to avoid duplicates:
 *
 *   hissuno external-records lookup --source slack --resource-type session \
 *     --id MSG123 --id MSG124
 *
 * Returns one record per external_id that exists in the project. Missing
 * ids simply don't appear. Resource POST endpoints automatically register
 * the mapping when given external_id + external_source per item, so most
 * skills only ever read.
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId } from '../lib/api.js'
import { error, renderJson } from '../lib/output.js'

const VALID_RESOURCE_TYPES = ['session', 'contact', 'company', 'issue', 'knowledge'] as const
type ResourceType = (typeof VALID_RESOURCE_TYPES)[number]

interface ExternalRecord {
  source: string
  externalId: string
  resourceType: string
  resourceId: string
  lastSyncedAt: string
}

export const externalRecordsCommand = new Command('external-records').description(
  'Lookup external→hissuno id mappings.',
)

externalRecordsCommand
  .command('lookup')
  .description('Look up which external ids have been synced.')
  .requiredOption('--source <source>', 'External source id (typically the plugin id).')
  .requiredOption('--resource-type <type>', `One of: ${VALID_RESOURCE_TYPES.join(', ')}`)
  .requiredOption('--id <externalId...>', 'External id(s) to look up. Repeatable.')
  .action(
    async (opts: { source: string; resourceType: string; id: string[] }) => {
      if (!(VALID_RESOURCE_TYPES as readonly string[]).includes(opts.resourceType)) {
        error(`--resource-type must be one of: ${VALID_RESOURCE_TYPES.join(', ')}`)
        process.exit(1)
      }
      const ids = Array.isArray(opts.id) ? opts.id : [opts.id]
      if (ids.length === 0) {
        error('At least one --id is required.')
        process.exit(1)
      }

      const config = requireConfig()
      const projectId = await resolveProjectId(config)

      const params = new URLSearchParams()
      params.set('projectId', projectId)
      params.set('source', opts.source)
      params.set('resourceType', opts.resourceType)
      for (const id of ids) params.append('externalId', id)

      const path = `/api/external-records?${params.toString()}`
      const result = await apiCall<{ records: ExternalRecord[]; error?: string }>(
        config,
        'GET',
        path,
      )
      if (!result.ok) {
        const message = result.data?.error ?? `HTTP ${result.status}`
        error(`Failed to look up records: ${message}`)
        process.exit(1)
      }
      renderJson(result.data.records ?? [])
    },
  )

// Keep the imported type usable for downstream consumers.
export type { ResourceType }
