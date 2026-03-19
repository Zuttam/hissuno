/**
 * hissuno get <type> <id> — Get full resource details
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { formatResourceDetail, formatRelatedEntities, renderJson, error } from '../lib/output.js'
import { resolveCustomerType } from '../lib/customer-type.js'

function cliTypeToEntityType(type: string, customerType?: string): string {
  if (type === 'customers') {
    return customerType === 'companies' ? 'company' : 'contact'
  }
  const map: Record<string, string> = {
    issue: 'issue',
    issues: 'issue',
    session: 'session',
    sessions: 'session',
    feedback: 'session',
    company: 'company',
    companies: 'company',
    contact: 'contact',
    contacts: 'contact',
    knowledge: 'knowledge_source',
    sources: 'knowledge_source',
    scopes: 'product_scope',
    scope: 'product_scope',
  }
  return map[type] ?? type
}

const TYPE_ENDPOINTS: Record<string, { path: (id: string) => string; key: string }> = {
  knowledge: { path: (id) => `/api/knowledge/packages/${id}`, key: 'package' },
  sources: { path: (id) => `/api/knowledge/sources/${id}`, key: 'source' },
  feedback: { path: (id) => `/api/sessions/${id}`, key: 'session' },
  issues: { path: (id) => `/api/issues/${id}`, key: 'issue' },
  customers: { path: (id) => `/api/contacts/${id}`, key: 'contact' },
  scopes: { path: (id) => `/api/product-scopes/${id}`, key: 'scope' },
}

export const getCommand = new Command('get')
  .description('Get full details of a specific resource')
  .argument('<type>', 'Resource type: knowledge, sources, feedback, issues, customers, scopes')
  .argument('<id>', 'Resource ID')
  .option('--customer-type <type>', 'Customer sub-type: contacts (default) or companies')
  .action(async (type, id, opts, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    const validTypes = Object.keys(TYPE_ENDPOINTS)
    if (!validTypes.includes(type)) {
      error(`Invalid type "${type}". Must be one of: ${validTypes.join(', ')}`)
      process.exit(1)
    }

    const projectId = await resolveProjectId(config)

    // Resolve endpoint - for customers, route based on --customer-type
    let endpoint: { path: (id: string) => string; key: string }
    let displayType = type
    const customerType = resolveCustomerType(opts.customerType)
    if (type === 'customers') {
      const key = customerType === 'companies' ? 'company' : 'contact'
      endpoint = { path: (id) => `/api/${customerType}/${id}`, key }
      displayType = customerType
    } else {
      endpoint = TYPE_ENDPOINTS[type]
    }

    try {
      // Fetch resource and relationships in parallel (independent calls)
      const [result, relResult] = await Promise.all([
        apiCall<Record<string, unknown>>(
          config,
          'GET',
          buildPath(endpoint.path(id), { projectId }),
        ),
        apiCall<{ relationships?: Record<string, unknown[]> }>(
          config,
          'GET',
          buildPath('/api/relationships', {
            projectId,
            entityType: cliTypeToEntityType(type, customerType),
            entityId: id,
          }),
        ),
      ])

      if (!result.ok) {
        const data = result.data as { error?: string }
        error(`Failed: ${data.error || `HTTP ${result.status}`}`)
        process.exit(1)
      }

      const item = (result.data[endpoint.key] ?? result.data) as Record<string, unknown>

      if (jsonMode) {
        const output = { ...result.data as Record<string, unknown> }
        if (relResult.ok && relResult.data.relationships) {
          output.relationships = relResult.data.relationships
        }
        console.log(renderJson(output))
      } else {
        // For feedback, pass messages as extra data
        const extra = type === 'feedback' ? { messages: result.data.messages } : undefined
        let output = formatResourceDetail(displayType, item, extra as Record<string, unknown> | undefined)
        if (relResult.ok && relResult.data.relationships) {
          output += formatRelatedEntities(relResult.data.relationships as Record<string, unknown[]>)
        }
        console.log(output)
      }
    } catch (err) {
      error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      process.exit(1)
    }
  })
