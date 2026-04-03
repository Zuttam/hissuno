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
import { db } from '@/lib/db'
import { eq, and, asc, desc, inArray, isNotNull } from 'drizzle-orm'
import { sessions, sessionMessages, issues, contacts, companies, knowledgeSources, entityRelationships } from '@/lib/db/schema/app'
import { listSessions } from '@/lib/db/queries/sessions'
import { listIssues } from '@/lib/db/queries/issues'
import { listContacts } from '@/lib/db/queries/contacts'
import { listCompanies } from '@/lib/db/queries/companies'
import { getSessionContactInfo, batchGetSessionContacts } from '@/lib/db/queries/entity-relationships'
import { searchSessions } from '@/lib/sessions/sessions-service'
import { searchIssues } from '@/lib/issues/issues-service'
import { searchCustomers } from '@/lib/customers/customers-service'
import { searchKnowledge } from '@/lib/knowledge/knowledge-service'
import { createSessionAdmin } from '@/lib/sessions/sessions-service'
import { createIssueAdmin } from '@/lib/issues/issues-service'
import { createContactAdmin, createCompanyAdmin } from '@/lib/customers/customers-service'
import { listProjectProductScopes, getProductScopeById } from '@/lib/db/queries/product-scopes'
import { searchScopes, createProductScopeAdmin } from '@/lib/product-scopes/product-scopes-service'
import { generateSlugFromName } from '@/lib/security/sanitize'
import type { SessionTag, SessionSource } from '@/types/session'
import type { IssueType, IssuePriority, IssueStatus } from '@/types/issue'
import type { CompanyStage } from '@/types/customer'
import type { ProductScopeType, ProductScopeGoal } from '@/types/product-scope'

const LOG_PREFIX = '[mcp.resource-tools]'

const RESOURCE_TYPES = ['knowledge', 'feedback', 'issues', 'customers', 'scopes'] as const
type ResourceType = (typeof RESOURCE_TYPES)[number]

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
        '- **Add:** Required: `type`, `name`, `description`. Optional: `priority`',
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
        '',
        '## scopes',
        'Product scopes (product areas and initiatives) that organize your product.',
        '- **Filters:** `type` (product_area|initiative)',
        '- **Search:** Semantic vector search with text fallback',
        '- **Add:** Required: `name`. Optional: `slug`, `description`, `type` (product_area|initiative), `color`, `goals` (array of {id, text})',
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
        const filters = { ...(params.filters ?? {}) }
        const limit = params.limit ?? 20
        let items: Array<{ id: string; name: string; description: string; metadata: Record<string, string> }> = []
        let total = 0

        switch (params.type) {
          case 'feedback': {
            const { sessions: data, total: t } = await listSessions(ctx.projectId, {
              source: typeof filters.source === 'string' ? (filters.source as SessionSource) : undefined,
              status: typeof filters.status === 'string' ? (filters.status as 'active' | 'closed') : undefined,
              contactId: typeof filters.contact_id === 'string' ? filters.contact_id : undefined,
              search: typeof filters.search === 'string' ? filters.search : undefined,
              tags: Array.isArray(filters.tags) ? filters.tags as SessionTag[] : undefined,
              limit,
            })
            total = t
            items = data.map((s) => {
              const contactName = s.contact?.name ?? null
              const companyName = s.contact?.company?.name ?? null
              return {
                id: s.id,
                name: s.name ?? 'Unnamed feedback',
                description: [contactName, companyName].filter(Boolean).join(' @ ') || (s.source ?? 'unknown'),
                metadata: {
                  source: s.source ?? 'unknown',
                  status: s.status ?? 'active',
                  messageCount: String(s.message_count ?? 0),
                  ...(Array.isArray(s.tags) && s.tags.length > 0 ? { tags: (s.tags as string[]).join(', ') } : {}),
                  lastActivityAt: s.last_activity_at ?? '',
                },
              }
            })
            break
          }

          case 'issues': {
            const { issues: data, total: t } = await listIssues(ctx.projectId, {
              type: typeof filters.type === 'string' ? (filters.type as IssueType) : undefined,
              priority: typeof filters.priority === 'string' ? (filters.priority as IssuePriority) : undefined,
              status: typeof filters.status === 'string' ? (filters.status as IssueStatus) : undefined,
              search: typeof filters.search === 'string' ? filters.search : undefined,
              limit,
            })
            total = t
            items = data.map((i) => ({
              id: i.id,
              name: i.name,
              description: `${i.type} | ${i.priority} priority | ${i.status}`,
              metadata: {
                type: i.type,
                priority: i.priority,
                status: i.status ?? 'open',
                sessionCount: String(i.session_count ?? 0),
                updatedAt: i.updated_at ?? '',
              },
            }))
            break
          }

          case 'customers': {
            const customerType = typeof filters.customer_type === 'string' ? filters.customer_type : 'contacts'

            if (customerType === 'companies') {
              const { companies: data, total: t } = await listCompanies(ctx.projectId, {
                search: typeof filters.search === 'string' ? filters.search : undefined,
                stage: typeof filters.stage === 'string' ? (filters.stage as CompanyStage) : undefined,
                industry: typeof filters.industry === 'string' ? filters.industry : undefined,
                limit,
              })
              total = t
              items = data.map((c) => ({
                id: c.id,
                name: c.name,
                description: [c.domain, c.stage, c.industry].filter(Boolean).join(' | '),
                metadata: {
                  domain: c.domain ?? '',
                  stage: c.stage ?? 'prospect',
                  ...(c.industry ? { industry: c.industry } : {}),
                  ...(c.arr != null ? { arr: String(c.arr) } : {}),
                  ...(c.health_score != null ? { healthScore: String(c.health_score) } : {}),
                  contactCount: String(c.contact_count ?? 0),
                },
              }))
            } else {
              const { contacts: data, total: t } = await listContacts(ctx.projectId, {
                companyId: typeof filters.company_id === 'string' ? filters.company_id : undefined,
                search: typeof filters.search === 'string' ? filters.search : undefined,
                role: typeof filters.role === 'string' ? filters.role : undefined,
                limit,
              })
              total = t
              items = data.map((c) => {
                const companyName = c.company?.name ?? null
                return {
                  id: c.id,
                  name: c.name,
                  description: [c.email, c.role, companyName].filter(Boolean).join(' | '),
                  metadata: {
                    email: c.email,
                    ...(c.role ? { role: c.role } : {}),
                    ...(c.title ? { title: c.title } : {}),
                    ...(companyName ? { company: companyName } : {}),
                    isChampion: String(c.is_champion ?? false),
                    ...(c.last_contacted_at ? { lastContactedAt: typeof c.last_contacted_at === 'string' ? c.last_contacted_at : c.last_contacted_at.toISOString() } : {}),
                  },
                }
              })
            }
            break
          }

          case 'knowledge': {
            const data = await db
              .select({
                id: knowledgeSources.id,
                type: knowledgeSources.type,
                name: knowledgeSources.name,
                description: knowledgeSources.description,
                analyzed_at: knowledgeSources.analyzed_at,
              })
              .from(knowledgeSources)
              .where(
                and(
                  eq(knowledgeSources.project_id, ctx.projectId),
                  eq(knowledgeSources.status, 'done')
                )
              )
              .orderBy(desc(knowledgeSources.created_at))
              .limit(limit)

            items = data.map((s) => ({
              id: s.id,
              name: s.name ?? 'Untitled',
              description: s.description ?? '',
              metadata: {
                type: s.type,
                ...(s.analyzed_at ? { analyzedAt: s.analyzed_at.toISOString() } : {}),
              },
            }))
            total = items.length
            break
          }

          case 'scopes': {
            const allScopes = await listProjectProductScopes(ctx.projectId)
            const typeFilter = typeof filters.type === 'string' ? filters.type : undefined
            const filtered = typeFilter
              ? allScopes.filter((s) => s.type === typeFilter)
              : allScopes
            const limited = filtered.slice(0, limit)
            total = filtered.length
            items = limited.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description || `${s.type} scope`,
              metadata: {
                slug: s.slug,
                type: s.type,
                ...(s.color ? { color: s.color } : {}),
                position: String(s.position),
                isDefault: String(s.is_default),
                ...(s.goals && (s.goals as Array<{ id: string; text: string }>).length > 0
                  ? { goals: (s.goals as Array<{ id: string; text: string }>).map((g) => g.text).join(', ') }
                  : {}),
                ...(s.updated_at ? { updatedAt: String(s.updated_at) } : {}),
              },
            }))
            break
          }
        }

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
        let markdown: string | null = null

        switch (params.type) {
          case 'feedback': {
            const [session] = await db
              .select({
                id: sessions.id,
                name: sessions.name,
                source: sessions.source,
                status: sessions.status,
                message_count: sessions.message_count,
                tags: sessions.tags,
                created_at: sessions.created_at,
              })
              .from(sessions)
              .where(
                and(
                  eq(sessions.id, params.id),
                  eq(sessions.project_id, ctx.projectId)
                )
              )

            if (!session) break

            const messages = await db
              .select({
                sender_type: sessionMessages.sender_type,
                content: sessionMessages.content,
                created_at: sessionMessages.created_at,
              })
              .from(sessionMessages)
              .where(eq(sessionMessages.session_id, params.id))
              .orderBy(asc(sessionMessages.created_at))

            const contactInfo = await getSessionContactInfo(params.id)
            const contactName = contactInfo?.contactName ?? null
            const contactEmail = contactInfo?.contactEmail ?? null

            const lines: string[] = [
              `# ${session.name ?? 'Feedback Session'}`,
              '',
              `- **Source:** ${session.source}`,
              `- **Status:** ${session.status}`,
              `- **Messages:** ${session.message_count ?? 0}`,
              contactName ? `- **Contact:** ${contactName} (${contactEmail ?? 'no email'})` : null,
              Array.isArray(session.tags) && session.tags.length > 0 ? `- **Tags:** ${(session.tags as string[]).join(', ')}` : null,
              `- **Created:** ${session.created_at?.toISOString() ?? ''}`,
              '',
              '## Conversation',
              '',
            ].filter((line): line is string => line !== null)

            for (const msg of messages) {
              const role = msg.sender_type === 'user' ? 'Customer' : 'Agent'
              lines.push(`**${role}:** ${msg.content}`, '')
            }

            markdown = lines.join('\n')
            break
          }

          case 'issues': {
            const [issue] = await db
              .select({
                id: issues.id,
                name: issues.name,
                description: issues.description,
                type: issues.type,
                priority: issues.priority,
                status: issues.status,
                created_at: issues.created_at,
                updated_at: issues.updated_at,
              })
              .from(issues)
              .where(
                and(
                  eq(issues.id, params.id),
                  eq(issues.project_id, ctx.projectId)
                )
              )

            if (!issue) break

            const lines: string[] = [
              `# ${issue.name}`,
              '',
              `- **Type:** ${issue.type}`,
              `- **Priority:** ${issue.priority}`,
              `- **Status:** ${issue.status}`,
              `- **Created:** ${issue.created_at?.toISOString() ?? ''}`,
              `- **Updated:** ${issue.updated_at?.toISOString() ?? ''}`,
              '',
              '## Description',
              '',
              issue.description ?? '_No description_',
              '',
            ]

            const sessionLinks = await db
              .select({ session_id: entityRelationships.session_id })
              .from(entityRelationships)
              .where(
                and(
                  eq(entityRelationships.issue_id, params.id),
                  isNotNull(entityRelationships.session_id),
                ),
              )

            const sessionIds = sessionLinks
              .map((r) => r.session_id)
              .filter((sid): sid is string => sid !== null)

            // Batch-fetch sessions and contacts (3 queries instead of 4N)
            const [sessionRows, contactInfoMap] = await Promise.all([
              sessionIds.length > 0
                ? db.select({ id: sessions.id, name: sessions.name, created_at: sessions.created_at })
                    .from(sessions).where(inArray(sessions.id, sessionIds))
                : Promise.resolve([]),
              batchGetSessionContacts(sessionIds),
            ])

            const linkedSessions = sessionRows.map((s) => {
              const info = contactInfoMap.get(s.id)
              const contactInfoStr = [info?.contactName, info?.companyName].filter(Boolean).join(' @ ')
              return {
                id: s.id,
                name: s.name,
                contactInfo: contactInfoStr,
                created_at: s.created_at?.toISOString() ?? '',
              }
            })

            if (linkedSessions.length > 0) {
              lines.push('## Linked Feedback', '')
              for (const s of linkedSessions) {
                lines.push(`- **${s.name ?? s.id}** ${s.contactInfo ? `(${s.contactInfo})` : ''} — ${s.created_at}`)
              }
              lines.push('')
            }

            markdown = lines.join('\n')
            break
          }

          case 'customers': {
            // Try contacts first, then companies
            const [contact] = await db
              .select({
                id: contacts.id,
                name: contacts.name,
                email: contacts.email,
                role: contacts.role,
                title: contacts.title,
                phone: contacts.phone,
                is_champion: contacts.is_champion,
                notes: contacts.notes,
                last_contacted_at: contacts.last_contacted_at,
                company_id: contacts.company_id,
              })
              .from(contacts)
              .where(
                and(
                  eq(contacts.id, params.id),
                  eq(contacts.project_id, ctx.projectId)
                )
              )

            if (contact) {
              // Fetch company name and linked sessions in parallel
              const [companyResult, contactSessions] = await Promise.all([
                contact.company_id
                  ? db.select({ name: companies.name }).from(companies).where(eq(companies.id, contact.company_id))
                  : Promise.resolve([]),
                db
                  .select({
                    id: sessions.id,
                    name: sessions.name,
                    source: sessions.source,
                    message_count: sessions.message_count,
                    created_at: sessions.created_at,
                  })
                  .from(sessions)
                  .where(
                    inArray(
                      sessions.id,
                      db
                        .select({ id: entityRelationships.session_id })
                        .from(entityRelationships)
                        .where(
                          and(
                            eq(entityRelationships.contact_id, params.id),
                            isNotNull(entityRelationships.session_id),
                          ),
                        ),
                    ),
                  )
                  .orderBy(desc(sessions.created_at))
                  .limit(20),
              ])
              const companyName = companyResult[0]?.name ?? null

              const sessionIds = contactSessions.map((s) => s.id)
              const issueMap = new Map<string, { id: string; name: string; type: string; status: string }>()

              if (sessionIds.length > 0) {
                const issueLinks = await db
                  .select({ issue_id: entityRelationships.issue_id })
                  .from(entityRelationships)
                  .where(
                    and(
                      inArray(entityRelationships.session_id, sessionIds),
                      isNotNull(entityRelationships.issue_id),
                    ),
                  )

                const issueIds = [...new Set(
                  issueLinks
                    .map((r) => r.issue_id)
                    .filter((id): id is string => id !== null),
                )]

                if (issueIds.length > 0) {
                  const issueRows = await db
                    .select({
                      id: issues.id,
                      name: issues.name,
                      type: issues.type,
                      status: issues.status,
                    })
                    .from(issues)
                    .where(inArray(issues.id, issueIds))

                  for (const issue of issueRows) {
                    issueMap.set(issue.id, {
                      id: issue.id,
                      name: issue.name,
                      type: issue.type,
                      status: issue.status ?? 'open',
                    })
                  }
                }
              }

              const lines: string[] = [
                `# ${contact.name}`,
                '',
                `- **Email:** ${contact.email}`,
                contact.role ? `- **Role:** ${contact.role}` : null,
                contact.title ? `- **Title:** ${contact.title}` : null,
                contact.phone ? `- **Phone:** ${contact.phone}` : null,
                companyName ? `- **Company:** ${companyName}` : null,
                `- **Champion:** ${contact.is_champion ? 'Yes' : 'No'}`,
                contact.last_contacted_at ? `- **Last Contacted:** ${contact.last_contacted_at.toISOString()}` : null,
                contact.notes ? `\n## Notes\n\n${contact.notes}` : null,
              ].filter((line): line is string => line !== null)

              if (contactSessions.length > 0) {
                lines.push('', '## Feedback Sessions', '')
                for (const s of contactSessions) {
                  lines.push(`- **${s.name ?? s.id}** (${s.source}, ${s.message_count ?? 0} messages) — ${s.created_at?.toISOString() ?? ''}`)
                }
              }

              const issueList = Array.from(issueMap.values())
              if (issueList.length > 0) {
                lines.push('', '## Linked Issues', '')
                for (const i of issueList) {
                  lines.push(`- **${i.name}** (${i.type}, ${i.status})`)
                }
              }

              markdown = lines.join('\n')
            } else {
              // Try companies
              const company = await db.query.companies.findFirst({
                where: and(
                  eq(companies.id, params.id),
                  eq(companies.project_id, ctx.projectId)
                ),
                with: {
                  contacts: {
                    columns: { id: true, name: true, email: true },
                  },
                },
              })

              if (company) {
                const lines: string[] = [
                  `# ${company.name}`,
                  '',
                  `- **Domain:** ${company.domain}`,
                  company.industry ? `- **Industry:** ${company.industry}` : null,
                  company.country ? `- **Country:** ${company.country}` : null,
                  company.arr != null ? `- **ARR:** $${Number(company.arr).toLocaleString()}` : null,
                  `- **Stage:** ${company.stage ?? 'prospect'}`,
                  company.plan_tier ? `- **Plan Tier:** ${company.plan_tier}` : null,
                  company.employee_count != null ? `- **Employees:** ${company.employee_count}` : null,
                  company.health_score != null ? `- **Health Score:** ${company.health_score}/100` : null,
                  company.renewal_date ? `- **Renewal Date:** ${company.renewal_date.toISOString()}` : null,
                  company.notes ? `\n## Notes\n\n${company.notes}` : null,
                ].filter((line): line is string => line !== null)

                const companyContacts = company.contacts as Array<{ id: string; name: string; email: string }> | undefined
                if (companyContacts && companyContacts.length > 0) {
                  lines.push('', '## Contacts', '')
                  for (const c of companyContacts) {
                    lines.push(`- **${c.name}** (${c.email})`)
                  }
                }

                markdown = lines.join('\n')
              }
            }
            break
          }

          case 'knowledge': {
            const [source] = await db
              .select({
                id: knowledgeSources.id,
                name: knowledgeSources.name,
                type: knowledgeSources.type,
                description: knowledgeSources.description,
                analyzed_content: knowledgeSources.analyzed_content,
                analyzed_at: knowledgeSources.analyzed_at,
                status: knowledgeSources.status,
              })
              .from(knowledgeSources)
              .where(
                and(
                  eq(knowledgeSources.id, params.id),
                  eq(knowledgeSources.project_id, ctx.projectId)
                )
              )

            if (!source) break

            if (source.status !== 'done' || !source.analyzed_content) {
              break
            }

            const content = source.analyzed_content
            if (!content) {
              throw new Error('Analyzed content is empty')
            }

            const header = [
              `# ${source.name ?? 'Knowledge Source'}`,
              '',
              `- **Type:** ${source.type}`,
              source.description ? `- **Description:** ${source.description}` : null,
              source.analyzed_at ? `- **Analyzed:** ${source.analyzed_at.toISOString()}` : null,
              '',
              '---',
              '',
            ]
              .filter((line) => line !== null)
              .join('\n')

            markdown = header + content
            break
          }

          case 'scopes': {
            const scope = await getProductScopeById(params.id)
            if (!scope || scope.project_id !== ctx.projectId) break

            const goals = scope.goals as Array<{ id: string; text: string }> | null

            const lines: string[] = [
              `# ${scope.name}`,
              '',
              `- **Slug:** ${scope.slug}`,
              `- **Type:** ${scope.type}`,
              scope.color ? `- **Color:** ${scope.color}` : null,
              `- **Position:** ${scope.position}`,
              `- **Default:** ${scope.is_default ? 'Yes' : 'No'}`,
              scope.created_at ? `- **Created:** ${String(scope.created_at)}` : null,
              scope.updated_at ? `- **Updated:** ${String(scope.updated_at)}` : null,
            ].filter((line): line is string => line !== null)

            if (scope.description) {
              lines.push('', '## Description', '', scope.description)
            }

            if (goals && goals.length > 0) {
              lines.push('', '## Goals', '')
              for (const goal of goals) {
                lines.push(`- ${goal.text}`)
              }
            }

            markdown = lines.join('\n')
            break
          }
        }

        console.log(`${LOG_PREFIX} get_resource type=${params.type} id=${params.id} found=${!!markdown}`)

        if (!markdown) {
          return {
            content: [{ type: 'text' as const, text: `Not found: ${params.type} with ID \`${params.id}\`` }],
            isError: true,
          }
        }

        return { content: [{ type: 'text' as const, text: markdown }] }
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

        const searchByType = async (type: ResourceType) => {
          switch (type) {
            case 'feedback':
              return (await searchSessions(ctx.projectId, params.query, limit)).map((r) => ({ ...r, type: 'feedback' as const }))
            case 'issues':
              return (await searchIssues(ctx.projectId, params.query, limit)).map((r) => ({ ...r, type: 'issues' as const }))
            case 'customers':
              return (await searchCustomers(ctx.projectId, params.query, limit)).map((r) => ({ ...r, type: 'customers' as const }))
            case 'knowledge':
              return (await searchKnowledge(ctx.projectId, params.query, limit)).map((r) => ({ ...r, type: 'knowledge' as const }))
            case 'scopes':
              return (await searchScopes(ctx.projectId, params.query, limit)).map((r) => ({ ...r, type: 'scopes' as const }))
          }
        }

        if (params.type) {
          allResults = await searchByType(params.type)
        } else {
          // Search all types in parallel
          const results = await Promise.allSettled(
            RESOURCE_TYPES.map((type) => searchByType(type))
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
        let resultId: string
        let resultName: string
        let resultType: string = params.type

        switch (params.type) {
          case 'feedback': {
            const messages = params.data.messages
            if (!Array.isArray(messages) || messages.length === 0) {
              throw new Error('Validation error: "messages" array is required and must not be empty.')
            }

            const name = typeof params.data.name === 'string' ? params.data.name : undefined
            const tags = Array.isArray(params.data.tags) ? params.data.tags as SessionTag[] : []

            const result = await createSessionAdmin({
              project_id: ctx.projectId,
              name,
              tags,
              source: 'api',
              messages: messages
                .filter((msg): msg is { role: string; content: string } =>
                  typeof msg === 'object' && msg !== null &&
                  typeof (msg as Record<string, unknown>).content === 'string'
                )
                .map((msg) => ({
                  role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
                  content: msg.content,
                })),
            })

            if (!result) {
              throw new Error('Failed to create feedback session')
            }

            resultId = result.id
            resultName = result.name ?? 'New feedback'
            break
          }

          case 'issues': {
            const VALID_TYPES = ['bug', 'feature_request', 'change_request'] as const
            const type = params.data.type
            if (typeof type !== 'string' || !VALID_TYPES.includes(type as IssueType)) {
              throw new Error(`Validation error: "type" must be one of: ${VALID_TYPES.join(', ')}`)
            }

            if (typeof params.data.name !== 'string' || (params.data.name as string).trim().length === 0) {
              throw new Error('Validation error: "name" is required.')
            }

            if (typeof params.data.description !== 'string' || (params.data.description as string).trim().length === 0) {
              throw new Error('Validation error: "description" is required.')
            }

            const result = await createIssueAdmin({
              projectId: ctx.projectId,
              type: type as IssueType,
              name: params.data.name as string,
              description: params.data.description as string,
              priority: typeof params.data.priority === 'string' ? (params.data.priority as 'low' | 'medium' | 'high') : undefined,
            })

            resultId = result.issue.id
            resultName = result.issue.name
            break
          }

          case 'customers': {
            const customerType = typeof params.data.customer_type === 'string' ? params.data.customer_type : 'contacts'

            if (customerType === 'companies') {
              if (typeof params.data.name !== 'string' || (params.data.name as string).trim().length === 0) {
                throw new Error('Validation error: "name" is required.')
              }
              if (typeof params.data.domain !== 'string' || (params.data.domain as string).trim().length === 0) {
                throw new Error('Validation error: "domain" is required.')
              }

              const company = await createCompanyAdmin({
                projectId: ctx.projectId,
                name: params.data.name as string,
                domain: params.data.domain as string,
                industry: typeof params.data.industry === 'string' ? params.data.industry : undefined,
                arr: typeof params.data.arr === 'number' ? params.data.arr : undefined,
                stage: typeof params.data.stage === 'string' ? params.data.stage : undefined,
                employeeCount: typeof params.data.employee_count === 'number' ? params.data.employee_count : undefined,
                planTier: typeof params.data.plan_tier === 'string' ? params.data.plan_tier : undefined,
                country: typeof params.data.country === 'string' ? params.data.country : undefined,
                notes: typeof params.data.notes === 'string' ? params.data.notes : undefined,
              })

              resultId = company.id
              resultName = company.name
            } else {
              if (typeof params.data.name !== 'string' || (params.data.name as string).trim().length === 0) {
                throw new Error('Validation error: "name" is required.')
              }

              if (typeof params.data.email !== 'string' || (params.data.email as string).trim().length === 0) {
                throw new Error('Validation error: "email" is required.')
              }

              const contact = await createContactAdmin({
                projectId: ctx.projectId,
                name: params.data.name as string,
                email: params.data.email as string,
                role: typeof params.data.role === 'string' ? params.data.role : undefined,
                title: typeof params.data.title === 'string' ? params.data.title : undefined,
                phone: typeof params.data.phone === 'string' ? params.data.phone : undefined,
                companyId: typeof params.data.company_id === 'string' ? params.data.company_id : undefined,
                isChampion: typeof params.data.is_champion === 'boolean' ? params.data.is_champion : undefined,
              })

              resultId = contact.id
              resultName = contact.name
            }

            resultType = 'customers'
            break
          }

          case 'knowledge': {
            throw new Error('Knowledge sources cannot be created via MCP. Use the dashboard to add and analyze knowledge sources.')
          }

          case 'scopes': {
            if (typeof params.data.name !== 'string' || (params.data.name as string).trim().length === 0) {
              throw new Error('Validation error: "name" is required.')
            }

            const name = (params.data.name as string).trim()
            const slug = typeof params.data.slug === 'string'
              ? (params.data.slug as string).trim()
              : generateSlugFromName(name)

            const VALID_SCOPE_TYPES: ProductScopeType[] = ['product_area', 'initiative']
            const scopeType = typeof params.data.type === 'string' ? params.data.type : undefined
            if (scopeType && !VALID_SCOPE_TYPES.includes(scopeType as ProductScopeType)) {
              throw new Error(`Validation error: "type" must be one of: ${VALID_SCOPE_TYPES.join(', ')}`)
            }

            const scope = await createProductScopeAdmin(ctx.projectId, {
              name,
              slug,
              description: typeof params.data.description === 'string' ? params.data.description : undefined,
              color: typeof params.data.color === 'string' ? params.data.color : undefined,
              type: scopeType as ProductScopeType | undefined,
              goals: Array.isArray(params.data.goals) ? params.data.goals as ProductScopeGoal[] : null,
            })

            resultId = scope.id
            resultName = scope.name
            resultType = 'scopes'
            break
          }
        }

        console.log(`${LOG_PREFIX} add_resource type=${params.type} id=${resultId!}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Created ${resultType}: **${resultName!}** (ID: \`${resultId!}\`)`,
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
