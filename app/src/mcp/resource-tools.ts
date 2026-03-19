/**
 * MCP Resource Tools
 *
 * Registers 5 generic resource tools on the MCP server that give
 * external agents structured access to Hissuno's data:
 * knowledge, feedback, issues, and contacts.
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getContext } from './context'
import { RESOURCE_TYPES, type ResourceType, type ResourceAdapter } from './resources/types'
import { knowledgeAdapter } from './resources/knowledge'
import { feedbackAdapter } from './resources/feedback'
import { issuesAdapter } from './resources/issues'
import { customersAdapter } from './resources/customers'

const LOG_PREFIX = '[mcp.resource-tools]'

const adapters: Record<ResourceType, ResourceAdapter> = {
  knowledge: knowledgeAdapter,
  feedback: feedbackAdapter,
  issues: issuesAdapter,
  customers: customersAdapter,
}

function getAdapter(type: ResourceType): ResourceAdapter {
  return adapters[type]
}

/**
 * Register all resource tools on the MCP server.
 */
export function registerResourceTools(server: McpServer) {
  // ============================================================================
  // list_resource_types
  // ============================================================================

  server.registerTool(
    'list_resource_types',
    {
      title: 'List Resource Types',
      description:
        'List all available resource types in Hissuno with their supported filters and fields. ' +
        'Call this first to understand what data you can access.',
      inputSchema: {},
    },
    async () => {
      const markdown = [
        '# Hissuno Resource Types',
        '',
        '## knowledge',
        'Analyzed knowledge sources (codebases, documents, URLs).',
        '- **Filters:** (none)',
        '- **Search:** Semantic vector search across all knowledge chunks',
        '- **Add:** Not supported (use dashboard)',
        '',
        '## feedback',
        'Customer feedback sessions (conversations from widget, Slack, Intercom, etc.).',
        '- **Filters:** `source` (widget|slack|intercom|gong|api|manual), `status` (active|closing_soon|awaiting_idle_response|closed), `tags` (string[]), `contact_id`, `search`',
        '- **Search:** Semantic vector search (falls back to full-text for unanalyzed sessions)',
        '- **Add:** Required: `messages` (array of {role, content}). Optional: `name`, `tags`',
        '',
        '## issues',
        'Product issues (bugs, feature requests, change requests).',
        '- **Filters:** `type` (bug|feature_request|change_request), `priority` (low|medium|high), `status` (open|ready|in_progress|resolved|closed), `search`',
        '- **Search:** Semantic vector search for similar issues',
        '- **Add:** Required: `type`, `title`, `description`. Optional: `priority`',
        '',
        '## customers',
        'Customers - contacts (people) and companies (organizations).',
        '- **Filters:** `customer_type` (contacts|companies, default: contacts)',
        '  - *contacts:* `search`, `company_id`, `role`',
        '  - *companies:* `search`, `stage` (prospect|onboarding|active|churned|expansion), `industry`',
        '- **Search:** Semantic vector search (contacts only, falls back to name/email text search)',
        '- **Add:** Set `customer_type` in data to select sub-type.',
        '  - *contacts:* Required: `name`, `email`. Optional: `role`, `title`, `phone`, `company_id`, `is_champion`',
        '  - *companies:* Required: `name`, `domain`. Optional: `industry`, `arr`, `stage`, `employee_count`, `plan_tier`, `country`, `notes`',
      ].join('\n')

      return { content: [{ type: 'text' as const, text: markdown }] }
    }
  )

  // ============================================================================
  // list_resources
  // ============================================================================

  server.registerTool(
    'list_resources',
    {
      title: 'List Resources',
      description:
        'List resources of a given type with optional filters. ' +
        'Call list_resource_types first to see available types and their filters.',
      inputSchema: {
        type: z.enum(RESOURCE_TYPES).describe('The resource type to list'),
        filters: z
          .record(z.unknown())
          .optional()
          .describe('Optional filters (see list_resource_types for available filters per type)'),
        limit: z.number().min(1).max(50).optional().describe('Max results (default: 20)'),
      },
    },
    async (params) => {
      const ctx = getContext()

      try {
        const adapter = getAdapter(params.type)
        const filters = { ...(params.filters ?? {}), limit: params.limit ?? 20 }
        const { items, total } = await adapter.list(ctx.projectId, filters)

        console.log(`${LOG_PREFIX} list_resources type=${params.type} total=${total}`)

        const lines: string[] = [`# ${params.type} (${total} total)`, '']

        for (const item of items) {
          lines.push(`## ${item.name}`)
          lines.push(`ID: \`${item.id}\``)
          if (item.description) lines.push(item.description)
          const metaEntries = Object.entries(item.metadata)
          if (metaEntries.length > 0) {
            lines.push(metaEntries.map(([k, v]) => `- **${k}:** ${v}`).join('\n'))
          }
          lines.push('')
        }

        if (items.length === 0) {
          lines.push('_No results found._')
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
      } catch (error) {
        console.error(`${LOG_PREFIX} list_resources error`, error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // get_resource
  // ============================================================================

  server.registerTool(
    'get_resource',
    {
      title: 'Get Resource',
      description:
        'Get full details of a specific resource by type and ID. ' +
        'Returns a comprehensive markdown document with all available data.',
      inputSchema: {
        type: z.enum(RESOURCE_TYPES).describe('The resource type'),
        id: z.string().describe('The resource ID'),
      },
    },
    async (params) => {
      const ctx = getContext()

      try {
        const adapter = getAdapter(params.type)
        const detail = await adapter.get(ctx.projectId, params.id)

        console.log(`${LOG_PREFIX} get_resource type=${params.type} id=${params.id} found=${!!detail}`)

        if (!detail) {
          return {
            content: [{ type: 'text' as const, text: `Not found: ${params.type} with ID \`${params.id}\`` }],
            isError: true,
          }
        }

        return { content: [{ type: 'text' as const, text: detail.markdown }] }
      } catch (error) {
        console.error(`${LOG_PREFIX} get_resource error`, error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // search_resources
  // ============================================================================

  server.registerTool(
    'search_resources',
    {
      title: 'Search Resources',
      description:
        'Search across resources using natural language. ' +
        'Optionally specify a type to search within, or omit to search all types. ' +
        'Uses semantic vector search for all resource types (with full-text fallback for unembedded data).',
      inputSchema: {
        query: z.string().describe('Natural language search query'),
        type: z.enum(RESOURCE_TYPES).optional().describe('Optional: limit search to one resource type'),
        limit: z.number().min(1).max(20).optional().describe('Max results per type (default: 10)'),
      },
    },
    async (params) => {
      const ctx = getContext()
      const limit = params.limit ?? 10

      try {
        let allResults: Array<{ id: string; type: ResourceType; name: string; snippet: string; score?: number }>

        if (params.type) {
          const adapter = getAdapter(params.type)
          allResults = await adapter.search(ctx.projectId, params.query, limit)
        } else {
          // Search all types in parallel
          const results = await Promise.allSettled(
            RESOURCE_TYPES.map(async (type) => {
              const adapter = getAdapter(type)
              return adapter.search(ctx.projectId, params.query, limit)
            })
          )

          allResults = []
          for (let i = 0; i < results.length; i++) {
            const result = results[i]
            if (result.status === 'fulfilled') {
              allResults.push(...result.value)
            } else {
              console.warn(`${LOG_PREFIX} search_resources ${RESOURCE_TYPES[i]} failed:`, result.reason)
            }
          }

          // Sort: scored results first (descending), then unscored
          allResults.sort((a, b) => {
            if (a.score != null && b.score != null) return b.score - a.score
            if (a.score != null) return -1
            if (b.score != null) return 1
            return 0
          })
        }

        console.log(`${LOG_PREFIX} search_resources query="${params.query}" type=${params.type ?? 'all'} results=${allResults.length}`)

        const lines: string[] = [`# Search Results for "${params.query}"`, '', `Found ${allResults.length} results.`, '']

        for (const r of allResults) {
          lines.push(`## [${r.type}] ${r.name}`)
          lines.push(`ID: \`${r.id}\``)
          if (r.score != null) lines.push(`Score: ${Math.round(r.score * 100)}%`)
          lines.push(r.snippet)
          lines.push('')
        }

        if (allResults.length === 0) {
          lines.push('_No results found._')
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
      } catch (error) {
        console.error(`${LOG_PREFIX} search_resources error`, error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // add_resource
  // ============================================================================

  server.registerTool(
    'add_resource',
    {
      title: 'Add Resource',
      description:
        'Create a new resource. Call list_resource_types first to see required and optional fields per type. ' +
        'Not available in contact mode.',
      inputSchema: {
        type: z.enum(RESOURCE_TYPES).describe('The resource type to create'),
        data: z.record(z.unknown()).describe('Resource data (see list_resource_types for required/optional fields)'),
      },
    },
    async (params) => {
      const ctx = getContext()

      if (ctx.mode === 'contact') {
        return {
          content: [{ type: 'text' as const, text: 'Error: Creating resources is not available in contact mode.' }],
          isError: true,
        }
      }

      try {
        const adapter = getAdapter(params.type)
        const result = await adapter.add(ctx.projectId, params.data)

        console.log(`${LOG_PREFIX} add_resource type=${params.type} id=${result.id}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Created ${result.type}: **${result.name}** (ID: \`${result.id}\`)`,
            },
          ],
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} add_resource error`, error)
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          isError: true,
        }
      }
    }
  )
}
