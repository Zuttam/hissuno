/**
 * hissuno search <query> — Search across resources
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { formatSearchResults, renderJson, error } from '../lib/output.js'

export const searchCommand = new Command('search')
  .description('Search across resources using natural language')
  .argument('<query>', 'Search query')
  .option('--type <type>', 'Limit to one resource type (knowledge|feedback|issues|customers|scopes)')
  .option('--limit <n>', 'Max results (default: 10)', '10')
  .action(async (query, opts, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    if (opts.type) {
      const validTypes = ['knowledge', 'feedback', 'issues', 'customers', 'scopes']
      if (!validTypes.includes(opts.type)) {
        error(`Invalid type "${opts.type}". Must be one of: ${validTypes.join(', ')}`)
        process.exit(1)
      }
      // customers search routes to contacts (companies don't have semantic search)
      if (opts.type === 'customers') opts.type = 'contacts'
    }

    const projectId = await resolveProjectId(config)

    const params: Record<string, string | number | undefined> = {
      projectId,
      q: query,
      limit: parseInt(opts.limit, 10),
    }
    if (opts.type) params.type = opts.type

    try {
      const result = await apiCall<{ results: Array<{ id: string; type: string; name: string; snippet: string; score?: number }>; total: number }>(
        config,
        'GET',
        buildPath('/api/search', params),
      )

      if (!result.ok) {
        const data = result.data as unknown as { error?: string }
        error(`Failed: ${data.error || `HTTP ${result.status}`}`)
        process.exit(1)
      }

      if (jsonMode) {
        console.log(renderJson(result.data))
      } else {
        console.log(formatSearchResults(result.data.results ?? []))
      }
    } catch (err) {
      error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      process.exit(1)
    }
  })
