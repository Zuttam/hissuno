/**
 * Contacts Resource Adapter
 *
 * Provides access to customer contacts and their linked data.
 */

import { db } from '@/lib/db'
import { eq, and, desc, ilike, or, inArray, isNotNull } from 'drizzle-orm'
import { contacts, companies, sessions, issues, entityRelationships } from '@/lib/db/schema/app'
import { insertContact } from '@/lib/db/queries/contacts'
import { searchContactsSemantic } from '@/lib/customers/contact-embedding-service'
import type { ResourceAdapter, ResourceListItem, SearchResult, AddResult } from './types'

const LOG_PREFIX = '[mcp.resources.contacts]'

export const contactsAdapter: ResourceAdapter = {
  async list(projectId, filters) {
    const limit = typeof filters.limit === 'number' ? filters.limit : 20

    const conditions = [
      eq(contacts.project_id, projectId),
      eq(contacts.is_archived, false),
    ]

    if (typeof filters.search === 'string') {
      const s = `%${filters.search}%`
      conditions.push(
        or(
          ilike(contacts.name, s),
          ilike(contacts.email, s)
        )!
      )
    }
    if (typeof filters.company_id === 'string') conditions.push(eq(contacts.company_id, filters.company_id))
    if (typeof filters.role === 'string') {
      conditions.push(ilike(contacts.role, `%${filters.role}%`))
    }

    const data = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        role: contacts.role,
        title: contacts.title,
        is_champion: contacts.is_champion,
        last_contacted_at: contacts.last_contacted_at,
        company_id: contacts.company_id,
      })
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.updated_at))
      .limit(limit)

    // Enrich with company names
    const items: ResourceListItem[] = []
    for (const c of data) {
      let companyName: string | null = null
      if (c.company_id) {
        const [company] = await db
          .select({ name: companies.name })
          .from(companies)
          .where(eq(companies.id, c.company_id))
        companyName = company?.name ?? null
      }

      items.push({
        id: c.id,
        name: c.name,
        description: [c.email, c.role, companyName].filter(Boolean).join(' | '),
        metadata: {
          email: c.email,
          ...(c.role ? { role: c.role } : {}),
          ...(c.title ? { title: c.title } : {}),
          ...(companyName ? { company: companyName } : {}),
          isChampion: String(c.is_champion ?? false),
          ...(c.last_contacted_at ? { lastContactedAt: c.last_contacted_at.toISOString() } : {}),
        },
      })
    }

    return { items, total: items.length }
  },

  async get(projectId, id) {
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
          eq(contacts.id, id),
          eq(contacts.project_id, projectId)
        )
      )

    if (!contact) {
      return null
    }

    // Get company name
    let companyName: string | null = null
    if (contact.company_id) {
      const [company] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, contact.company_id))
      companyName = company?.name ?? null
    }

    // Get linked sessions via entity_relationships
    const contactSessions = await db
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
                eq(entityRelationships.contact_id, id),
                isNotNull(entityRelationships.session_id),
              ),
            ),
        ),
      )
      .orderBy(desc(sessions.created_at))
      .limit(20)

    // Get linked issues via entity_relationships (sessions -> issues)
    const sessionIds = contactSessions.map((s) => s.id)
    const issueMap = new Map<string, { id: string; title: string; type: string; status: string }>()

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
            title: issues.title,
            type: issues.type,
            status: issues.status,
          })
          .from(issues)
          .where(inArray(issues.id, issueIds))

        for (const issue of issueRows) {
          issueMap.set(issue.id, {
            id: issue.id,
            title: issue.title,
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
        lines.push(`- **${i.title}** (${i.type}, ${i.status})`)
      }
    }

    return {
      id: contact.id,
      type: 'customers' as const,
      markdown: lines.join('\n'),
    }
  },

  async search(projectId, query, limit) {
    // Phase 1: Try semantic vector search
    try {
      const semanticResults = await searchContactsSemantic(projectId, query, {
        limit,
        threshold: 0.5,
        isArchived: false,
      })

      if (semanticResults.length > 0) {
        return semanticResults.map(
          (r): SearchResult => ({
            id: r.contactId,
            type: 'customers',
            name: r.name,
            snippet: [r.email, r.role].filter(Boolean).join(' | '),
            score: r.similarity,
          })
        )
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} semantic search failed, falling back to text search`, err)
    }

    // Phase 2: Fall back to ILIKE text search
    const s = `%${query}%`

    const data = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        role: contacts.role,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.project_id, projectId),
          eq(contacts.is_archived, false),
          or(
            ilike(contacts.name, s),
            ilike(contacts.email, s)
          )
        )
      )
      .limit(limit)

    return data.map(
      (c): SearchResult => ({
        id: c.id,
        type: 'customers',
        name: c.name,
        snippet: [c.email, c.role].filter(Boolean).join(' | '),
      })
    )
  },

  async add(projectId, data): Promise<AddResult> {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new Error('Validation error: "name" is required.')
    }

    if (typeof data.email !== 'string' || data.email.trim().length === 0) {
      throw new Error('Validation error: "email" is required.')
    }

    const contact = await insertContact({
      projectId,
      name: data.name,
      email: data.email,
      role: typeof data.role === 'string' ? data.role : undefined,
      title: typeof data.title === 'string' ? data.title : undefined,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      companyId: typeof data.company_id === 'string' ? data.company_id : undefined,
      isChampion: typeof data.is_champion === 'boolean' ? data.is_champion : undefined,
    })

    return {
      id: contact.id,
      type: 'customers',
      name: contact.name,
    }
  },
}
