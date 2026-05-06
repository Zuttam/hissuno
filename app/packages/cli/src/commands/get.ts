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
    codebase: 'codebase',
    codebases: 'codebase',
    scopes: 'product_scope',
    scope: 'product_scope',
    knowledge: 'knowledge_source',
  }
  return map[type] ?? type
}

const TYPE_ENDPOINTS: Record<string, { path: (id: string) => string; key: string }> = {
  feedback: { path: (id) => `/api/sessions/${id}`, key: 'session' },
  issues: { path: (id) => `/api/issues/${id}`, key: 'issue' },
  customers: { path: (id) => `/api/contacts/${id}`, key: 'contact' },
  scopes: { path: (id) => `/api/product-scopes/${id}`, key: 'scope' },
  codebase: { path: (id) => `/api/codebases/${id}`, key: 'codebase' },
}

const SUPPORTED_TYPES = [...Object.keys(TYPE_ENDPOINTS), 'knowledge']

/**
 * Resolve the parent scope for a knowledge source via the relationships endpoint.
 * Knowledge lives under product scopes, so fetching by ID alone requires the lookup.
 */
async function resolveKnowledgeParentScope(
  config: ReturnType<typeof requireConfig>,
  projectId: string,
  sourceId: string,
): Promise<string | null> {
  const result = await apiCall<{ relationships?: { productScopes?: Array<{ id: string }> } }>(
    config,
    'GET',
    buildPath('/api/relationships', {
      projectId,
      entityType: 'knowledge_source',
      entityId: sourceId,
    }),
  )
  if (!result.ok) return null
  const scopes = result.data.relationships?.productScopes ?? []
  return scopes[0]?.id ?? null
}

export const getCommand = new Command('get')
  .description('Get full details of a specific resource')
  .argument('<type>', 'Resource type: feedback, issues, customers, scopes, codebase, knowledge')
  .argument('<id>', 'Resource ID')
  .option('--customer-type <type>', 'Customer sub-type: contacts (default) or companies')
  .action(async (type, id, opts, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    if (!SUPPORTED_TYPES.includes(type)) {
      error(`Invalid type "${type}". Must be one of: ${SUPPORTED_TYPES.join(', ')}`)
      process.exit(1)
    }

    const projectId = await resolveProjectId(config)

    // Resolve endpoint - for customers, route based on --customer-type;
    // for knowledge, look up the parent scope and use the scoped endpoint.
    let endpoint: { path: (id: string) => string; key: string }
    let displayType = type
    const customerType = resolveCustomerType(opts.customerType)
    if (type === 'customers') {
      const key = customerType === 'companies' ? 'company' : 'contact'
      endpoint = { path: (id) => `/api/${customerType}/${id}`, key }
      displayType = customerType
    } else if (type === 'knowledge') {
      const scopeId = await resolveKnowledgeParentScope(config, projectId, id)
      if (!scopeId) {
        error(`Knowledge source ${id} is not attached to any scope (or you don't have access).`)
        process.exit(1)
      }
      endpoint = { path: (sid) => `/api/product-scopes/${scopeId}/knowledge/${sid}`, key: 'source' }
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
