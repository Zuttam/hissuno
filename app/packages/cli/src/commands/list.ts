/**
 * hissuno list <type> — List resources with optional filters
 */

import { Command } from 'commander'
import { requireConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, buildPath } from '../lib/api.js'
import { formatResourceList, formatScopeTree, renderJson, error } from '../lib/output.js'
import { resolveCustomerType } from '../lib/customer-type.js'

const TYPE_ENDPOINTS: Record<string, { path: string; key: string }> = {
  knowledge: { path: '/api/knowledge/sources', key: 'sources' },
  feedback: { path: '/api/sessions', key: 'sessions' },
  issues: { path: '/api/issues', key: 'issues' },
  customers: { path: '/api/contacts', key: 'contacts' },
  scopes: { path: '/api/product-scopes', key: 'scopes' },
}

export const listCommand = new Command('list')
  .description('List resources of a given type')
  .argument('<type>', 'Resource type: knowledge, feedback, issues, customers, scopes')
  .option('--source <source>', 'Filter feedback by source (widget|slack|intercom|gong|api|manual)')
  .option('--status <status>', 'Filter by status')
  .option('--tags <tags>', 'Filter feedback by tags (comma-separated)')
  .option('--contact-id <id>', 'Filter feedback by contact ID')
  .option('--search <query>', 'Text search filter')
  .option('--issue-type <type>', 'Filter issues by type (bug|feature_request|change_request)')
  .option('--priority <priority>', 'Filter issues by priority (low|medium|high)')
  .option('--company-id <id>', 'Filter contacts by company ID')
  .option('--role <role>', 'Filter contacts by role')
  .option('--customer-type <type>', 'Customer sub-type: contacts (default) or companies')
  .option('--stage <stage>', 'Filter companies by stage (prospect|onboarding|active|churned|expansion)')
  .option('--industry <industry>', 'Filter companies by industry')
  .option('--limit <n>', 'Max results (default: 20)', '20')
  .action(async (type, opts, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    const validTypes = Object.keys(TYPE_ENDPOINTS)
    if (!validTypes.includes(type)) {
      error(`Invalid type "${type}". Must be one of: ${validTypes.join(', ')}`)
      process.exit(1)
    }

    const projectId = await resolveProjectId(config)

    // Resolve endpoint - for customers, route based on --customer-type
    let endpoint: { path: string; key: string }
    let displayType = type
    if (type === 'customers') {
      const customerType = resolveCustomerType(opts.customerType)
      endpoint = { path: `/api/${customerType}`, key: customerType }
      displayType = customerType
    } else {
      endpoint = TYPE_ENDPOINTS[type]
    }

    // Build query params
    const params: Record<string, string | number | undefined> = {
      projectId,
      limit: parseInt(opts.limit, 10),
    }

    if (opts.source) params.source = opts.source
    if (opts.status) params.status = opts.status
    if (opts.tags) params.tags = opts.tags
    if (opts.contactId) params.contactId = opts.contactId
    if (opts.search) params.search = opts.search
    if (opts.issueType) params.type = opts.issueType
    if (opts.priority) params.priority = opts.priority
    if (opts.companyId) params.companyId = opts.companyId
    if (opts.role) params.role = opts.role
    if (opts.stage) params.stage = opts.stage
    if (opts.industry) params.industry = opts.industry

    try {
      const result = await apiCall<Record<string, unknown>>(config, 'GET', buildPath(endpoint.path, params))

      if (!result.ok) {
        const data = result.data as { error?: string }
        error(`Failed: ${data.error || `HTTP ${result.status}`}`)
        process.exit(1)
      }

      const items = (result.data[endpoint.key] ?? []) as Record<string, unknown>[]
      const total = (result.data.total ?? items.length) as number

      if (jsonMode) {
        console.log(renderJson(result.data))
      } else if (type === 'scopes') {
        console.log(formatScopeTree(items, total))
      } else {
        console.log(formatResourceList(displayType, items, total))
      }
    } catch (err) {
      error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      process.exit(1)
    }
  })
