/**
 * Output Formatting
 *
 * ANSI terminal rendering for structured data output,
 * plus JSON mode for scripting.
 */

export const BOLD = '\x1b[1m'
export const DIM = '\x1b[2m'
export const RESET = '\x1b[0m'
export const CYAN = '\x1b[36m'
export const RED = '\x1b[31m'
export const YELLOW = '\x1b[33m'
export const GREEN = '\x1b[32m'
export const MAGENTA = '\x1b[35m'

/**
 * Render markdown-ish text with basic ANSI formatting.
 * Handles headers, bold, inline code, and bullet lists.
 */
export function renderMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // Headers
      if (line.startsWith('# ')) return `\n${BOLD}${CYAN}${line.slice(2)}${RESET}\n`
      if (line.startsWith('## ')) return `\n${BOLD}${line.slice(3)}${RESET}`
      if (line.startsWith('### ')) return `${BOLD}${line.slice(4)}${RESET}`

      // Bullet points with bold keys
      if (line.startsWith('- **')) {
        return line
          .replace(/\*\*([^*]+)\*\*/g, `${BOLD}$1${RESET}`)
          .replace(/`([^`]+)`/g, `${DIM}$1${RESET}`)
      }

      // Italic/emphasis lines
      if (line.startsWith('_') && line.endsWith('_')) {
        return `${DIM}${line.slice(1, -1)}${RESET}`
      }

      // Inline formatting
      return line
        .replace(/\*\*([^*]+)\*\*/g, `${BOLD}$1${RESET}`)
        .replace(/`([^`]+)`/g, `${DIM}$1${RESET}`)
    })
    .join('\n')
}

/**
 * Pretty-print data as JSON.
 */
export function renderJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Print a success message.
 */
export function success(message: string): void {
  console.log(`${GREEN}${message}${RESET}`)
}

/**
 * Print an error message.
 */
export function error(message: string): void {
  console.error(`${RED}${message}${RESET}`)
}

/**
 * Print a warning message.
 */
export function warn(message: string): void {
  console.warn(`${YELLOW}${message}${RESET}`)
}

// ---------------------------------------------------------------------------
// Resource Formatters
// ---------------------------------------------------------------------------

interface ResourceItem {
  id?: string
  name?: string
  title?: string
  [key: string]: unknown
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 3) + '...'
}

function formatDate(val: unknown): string {
  if (!val) return '-'
  const s = typeof val === 'string' ? val : String(val)
  try {
    const d = new Date(s)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return s
  }
}

function label(text: string): string {
  return `${DIM}${text}${RESET}`
}

function heading(text: string): string {
  return `${BOLD}${CYAN}${text}${RESET}`
}

function itemName(text: string): string {
  return `${BOLD}${text}${RESET}`
}

function dimText(text: string): string {
  return `${DIM}${text}${RESET}`
}

function badge(text: string, color = YELLOW): string {
  return `${color}${text}${RESET}`
}

// ---------------------------------------------------------------------------
// formatResourceList — tabular list of resources
// ---------------------------------------------------------------------------

export function formatResourceList(type: string, items: ResourceItem[], total: number): string {
  const lines: string[] = [heading(`${capitalize(type)} (${total} total)`), '']

  if (items.length === 0) {
    lines.push(dimText('No results found.'))
    return lines.join('\n')
  }

  for (const item of items) {
    const name = (item.name ?? item.title ?? 'Untitled') as string

    switch (type) {
      case 'feedback':
        lines.push(formatFeedbackRow(item, name))
        break
      case 'issues':
        lines.push(formatIssueRow(item, name))
        break
      case 'contacts':
        lines.push(formatContactRow(item, name))
        break
      case 'companies':
        lines.push(formatCompanyRow(item, name))
        break
      case 'knowledge':
        lines.push(formatKnowledgeRow(item, name))
        break
      case 'scopes':
        lines.push(formatScopeRow(item, name))
        break
      default:
        lines.push(`  ${itemName(name)}  ${dimText(String(item.id ?? ''))}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatFeedbackRow(item: ResourceItem, name: string): string {
  const id = dimText(truncate(String(item.id ?? ''), 12))
  const source = item.source ? badge(String(item.source)) : ''
  const status = item.status ? label(String(item.status)) : ''
  const msgs = item.message_count != null ? `${item.message_count} msgs` : ''
  const tags = Array.isArray(item.tags) && item.tags.length > 0 ? dimText((item.tags as string[]).join(', ')) : ''
  const date = formatDate(item.last_activity_at)

  const parts = [source, status, msgs, tags, date].filter(Boolean)
  return `  ${itemName(truncate(name, 40))}  ${id}\n    ${parts.join('  ')}`
}

function formatIssueRow(item: ResourceItem, name: string): string {
  const id = dimText(truncate(String(item.id ?? ''), 12))
  const type = item.type ? badge(String(item.type), MAGENTA) : ''
  const priority = item.priority ? formatPriority(String(item.priority)) : ''
  const status = item.status ? label(String(item.status)) : ''
  const upvotes = item.upvote_count != null ? `${item.upvote_count} upvotes` : ''

  const parts = [type, priority, status, upvotes].filter(Boolean)
  return `  ${itemName(truncate(name, 50))}  ${id}\n    ${parts.join('  ')}`
}

function formatPriority(p: string): string {
  switch (p) {
    case 'high': return `${RED}high${RESET}`
    case 'medium': return `${YELLOW}medium${RESET}`
    case 'low': return `${GREEN}low${RESET}`
    default: return label(p)
  }
}

function formatContactRow(item: ResourceItem, name: string): string {
  const email = item.email ? dimText(String(item.email)) : ''
  const role = item.role ? label(String(item.role)) : ''
  const title = item.title ? label(String(item.title)) : ''
  const champion = item.is_champion ? badge('champion', GREEN) : ''

  const parts = [email, role, title, champion].filter(Boolean)
  return `  ${itemName(name)}  ${parts.join('  ')}`
}

function formatCompanyRow(item: ResourceItem, name: string): string {
  const id = dimText(truncate(String(item.id ?? ''), 12))
  const domain = item.domain ? dimText(String(item.domain)) : ''
  const stage = item.stage ? badge(String(item.stage)) : ''
  const arr = item.arr != null ? `$${Number(item.arr).toLocaleString()} ARR` : ''
  const industry = item.industry ? label(String(item.industry)) : ''
  const health = item.health_score != null ? `health: ${item.health_score}` : ''
  const contactCount = item.contact_count != null ? `${item.contact_count} contacts` : ''

  const parts = [domain, stage, arr, industry, health, contactCount].filter(Boolean)
  return `  ${itemName(name)}  ${id}\n    ${parts.join('  ')}`
}

function formatScopeRow(item: ResourceItem, name: string): string {
  const id = dimText(truncate(String(item.id ?? ''), 12))
  const type = item.type ? badge(String(item.type), MAGENTA) : ''
  const isDefault = item.is_default ? badge('default', GREEN) : ''
  const goals = Array.isArray(item.goals) && item.goals.length > 0 ? `${item.goals.length} goals` : ''
  const desc = item.description ? dimText(truncate(String(item.description), 40)) : ''

  const parts = [type, isDefault, goals, desc].filter(Boolean)
  return `  ${itemName(name)}  ${id}\n    ${parts.join('  ')}`
}

function formatKnowledgeRow(item: ResourceItem, name: string): string {
  const id = dimText(truncate(String(item.id ?? ''), 12))
  const type = item.type ? badge(String(item.type), MAGENTA) : ''
  const status = item.status ? label(String(item.status)) : ''
  const url = item.url ? dimText(truncate(String(item.url), 40)) : ''
  const analyzed = item.analyzed_at ? `analyzed ${formatDate(item.analyzed_at)}` : dimText('not analyzed')
  const enabled = item.enabled === false ? badge('disabled', RED) : ''

  const parts = [type, status, enabled, url, analyzed].filter(Boolean)
  return `  ${itemName(truncate(name, 40))}  ${id}\n    ${parts.join('  ')}`
}

// ---------------------------------------------------------------------------
// formatResourceDetail — single resource detail view
// ---------------------------------------------------------------------------

export function formatResourceDetail(type: string, item: ResourceItem, extra?: Record<string, unknown>): string {
  const name = (item.name ?? item.title ?? 'Untitled') as string
  const lines: string[] = [heading(name), '']

  // Common ID
  if (item.id) lines.push(`${label('ID:')} ${item.id}`)

  switch (type) {
    case 'feedback':
      formatFeedbackDetail(lines, item, extra)
      break
    case 'issues':
      formatIssueDetail(lines, item)
      break
    case 'contacts':
      formatContactDetail(lines, item)
      break
    case 'companies':
      formatCompanyDetail(lines, item)
      break
    case 'knowledge':
      formatKnowledgeDetail(lines, item)
      break
    case 'scopes':
      formatScopeDetail(lines, item)
      break
  }

  return lines.join('\n')
}

function formatFeedbackDetail(lines: string[], item: ResourceItem, extra?: Record<string, unknown>): void {
  if (item.source) lines.push(`${label('Source:')} ${item.source}`)
  if (item.status) lines.push(`${label('Status:')} ${item.status}`)
  if (item.message_count != null) lines.push(`${label('Messages:')} ${item.message_count}`)
  if (Array.isArray(item.tags) && item.tags.length > 0) lines.push(`${label('Tags:')} ${(item.tags as string[]).join(', ')}`)
  if (item.created_at) lines.push(`${label('Created:')} ${formatDate(item.created_at)}`)

  // Messages from extra data
  const messages = (extra?.messages ?? item.messages) as Array<{ sender_type?: string; role?: string; content: string }> | undefined
  if (messages && messages.length > 0) {
    lines.push('', heading('Conversation'), '')
    for (const msg of messages) {
      const role = msg.sender_type === 'user' || msg.role === 'user' ? 'Customer' : 'Agent'
      lines.push(`${BOLD}${role}:${RESET} ${msg.content}`, '')
    }
  }
}

function formatIssueDetail(lines: string[], item: ResourceItem): void {
  if (item.type) lines.push(`${label('Type:')} ${item.type}`)
  if (item.priority) lines.push(`${label('Priority:')} ${formatPriority(String(item.priority))}`)
  if (item.status) lines.push(`${label('Status:')} ${item.status}`)
  if (item.upvote_count != null) lines.push(`${label('Upvotes:')} ${item.upvote_count}`)
  if (item.created_at) lines.push(`${label('Created:')} ${formatDate(item.created_at)}`)

  if (item.description) {
    lines.push('', String(item.description))
  }
}

function formatContactDetail(lines: string[], item: ResourceItem): void {
  if (item.email) lines.push(`${label('Email:')} ${item.email}`)
  if (item.role) lines.push(`${label('Role:')} ${item.role}`)
  if (item.title && typeof item.title === 'string') lines.push(`${label('Title:')} ${item.title}`)
  if (item.phone) lines.push(`${label('Phone:')} ${item.phone}`)
  if (item.is_champion) lines.push(`${label('Champion:')} ${badge('Yes', GREEN)}`)
  if (item.company_name || item.company) {
    const name = item.company_name ?? (item.company as Record<string, unknown>)?.name
    if (name) lines.push(`${label('Company:')} ${name}`)
  }
  if (item.session_count != null) lines.push(`${label('Feedback sessions:')} ${item.session_count}`)
  if (item.issue_count != null) lines.push(`${label('Issues:')} ${item.issue_count}`)
}

function formatCompanyDetail(lines: string[], item: ResourceItem): void {
  if (item.domain) lines.push(`${label('Domain:')} ${item.domain}`)
  if (item.industry) lines.push(`${label('Industry:')} ${item.industry}`)
  if (item.country) lines.push(`${label('Country:')} ${item.country}`)
  if (item.arr != null) lines.push(`${label('ARR:')} $${Number(item.arr).toLocaleString()}`)
  if (item.stage) lines.push(`${label('Stage:')} ${badge(String(item.stage))}`)
  if (item.plan_tier) lines.push(`${label('Plan:')} ${item.plan_tier}`)
  if (item.employee_count != null) lines.push(`${label('Employees:')} ${item.employee_count}`)
  if (item.health_score != null) lines.push(`${label('Health Score:')} ${item.health_score}`)
  if (item.renewal_date) lines.push(`${label('Renewal:')} ${formatDate(item.renewal_date)}`)
  if (item.notes) lines.push(`${label('Notes:')} ${item.notes}`)
  if (item.created_at) lines.push(`${label('Created:')} ${formatDate(item.created_at)}`)

  const companyContacts = item.contacts as Array<{ id: string; name: string; email: string }> | undefined
  if (companyContacts && companyContacts.length > 0) {
    lines.push('', `${BOLD}Contacts (${companyContacts.length}):${RESET}`)
    for (const c of companyContacts) {
      lines.push(`  - ${c.name} (${c.email})`)
    }
  }
}

function formatScopeDetail(lines: string[], item: ResourceItem): void {
  if (item.slug) lines.push(`${label('Slug:')} ${item.slug}`)
  if (item.type) lines.push(`${label('Type:')} ${item.type}`)
  if (item.is_default) lines.push(`${label('Default:')} ${badge('Yes', GREEN)}`)
  if (item.description) lines.push(`${label('Description:')} ${item.description}`)
  if (item.created_at) lines.push(`${label('Created:')} ${formatDate(item.created_at)}`)

  const goals = item.goals as Array<{ id: string; text: string }> | undefined
  if (goals && goals.length > 0) {
    lines.push('', `${BOLD}Goals (${goals.length}):${RESET}`)
    for (const goal of goals) {
      lines.push(`  - ${goal.text}`)
    }
  }
}

function formatKnowledgeDetail(lines: string[], item: ResourceItem): void {
  if (item.type) lines.push(`${label('Type:')} ${badge(String(item.type), MAGENTA)}`)
  if (item.status) lines.push(`${label('Status:')} ${item.status}`)
  if (item.enabled !== undefined) lines.push(`${label('Enabled:')} ${item.enabled ? badge('Yes', GREEN) : badge('No', RED)}`)
  if (item.url) lines.push(`${label('URL:')} ${item.url}`)
  if (item.description) lines.push(`${label('Description:')} ${item.description}`)
  if (item.analysis_scope) lines.push(`${label('Analysis scope:')} ${item.analysis_scope}`)
  if (item.analyzed_at) lines.push(`${label('Analyzed:')} ${formatDate(item.analyzed_at)}`)
  if (item.created_at) lines.push(`${label('Created:')} ${formatDate(item.created_at)}`)
  if (item.product_scope_id) lines.push(`${label('Product scope:')} ${item.product_scope_id}`)
}

// ---------------------------------------------------------------------------
// formatSearchResults — search results with scores
// ---------------------------------------------------------------------------

export function formatSearchResults(results: Array<{ id: string; type: string; name: string; snippet: string; score?: number }>): string {
  const lines: string[] = [heading(`Search Results (${results.length} found)`), '']

  if (results.length === 0) {
    lines.push(dimText('No results found.'))
    return lines.join('\n')
  }

  for (const r of results) {
    const typeTag = badge(`[${r.type}]`, MAGENTA)
    const score = r.score != null ? dimText(`${Math.round(r.score * 100)}%`) : ''
    lines.push(`  ${typeTag} ${itemName(r.name)}  ${score}`)
    lines.push(`    ${dimText(r.id)}`)
    if (r.snippet) lines.push(`    ${truncate(r.snippet, 80)}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// formatRelatedEntities — append related entities to detail view
// ---------------------------------------------------------------------------

export function formatRelatedEntities(relationships: Record<string, unknown[]>): string {
  const sections: string[] = []
  const labelMap: Record<string, string> = {
    companies: 'Companies',
    contacts: 'Contacts',
    issues: 'Issues',
    sessions: 'Feedback',
    knowledgeSources: 'Knowledge',
    productScopes: 'Product Scopes',
  }

  for (const [key, items] of Object.entries(relationships)) {
    if (!Array.isArray(items) || items.length === 0) continue
    const lbl = labelMap[key] ?? key
    const names = items.map((i: any) => i.name ?? i.title ?? i.id).join(', ')
    sections.push(`    ${lbl}: ${names}`)
  }

  if (sections.length === 0) return ''
  return `\n  Related:\n${sections.join('\n')}`
}

// ---------------------------------------------------------------------------
// formatResourceTypes — static help text
// ---------------------------------------------------------------------------

export function formatResourceTypes(): string {
  return [
    heading('Hissuno Resource Types'),
    '',
    `${BOLD}knowledge${RESET}`,
    '  Knowledge sources (codebases, documents, URLs, Notion pages).',
    `  ${label('Filters:')} (none)`,
    `  ${label('Search:')} Semantic vector search across all knowledge chunks`,
    '',
    `${BOLD}feedback${RESET}`,
    '  Customer feedback sessions (conversations from widget, Slack, Intercom, etc.).',
    `  ${label('Filters:')} --source, --status, --tags, --contact-id, --search`,
    `  ${label('Search:')} Semantic vector search (full-text fallback)`,
    `  ${label('Add:')} messages (required), name, tags`,
    '',
    `${BOLD}issues${RESET}`,
    '  Product issues (bugs, feature requests, change requests).',
    `  ${label('Filters:')} --issue-type, --priority, --status, --search`,
    `  ${label('Search:')} Semantic vector search for similar issues`,
    `  ${label('Add:')} type, title, description (required), priority`,
    '',
    `${BOLD}customers${RESET}`,
    '  Customers (contacts and companies). Use --customer-type to select (default: contacts).',
    `  ${label('Sub-types:')} contacts (people), companies (organizations)`,
    `  ${label('Filters (contacts):')} --search, --company-id, --role`,
    `  ${label('Filters (companies):')} --search, --stage, --industry`,
    `  ${label('Search:')} Semantic vector search (contacts only, name/email fallback)`,
    `  ${label('Add (contacts):')} name, email (required), role, title, phone, company_id, is_champion`,
    `  ${label('Add (companies):')} name, domain (required), industry, arr, stage, employee_count, plan_tier, country, notes`,
    '',
    `${BOLD}scopes${RESET}`,
    '  Product scopes (product areas and initiatives) with goals.',
    `  ${label('Add:')} name, type (required), description, goals`,
    `  ${label('Update:')} name, type, description, goals`,
  ].join('\n')
}
