/**
 * Feedback (Sessions) Resource Adapter
 *
 * Provides access to customer feedback sessions and their messages.
 */

import { db } from '@/lib/db'
import { eq, and, desc, asc, ilike, sql, inArray, isNotNull } from 'drizzle-orm'
import { sessions, sessionMessages, entityRelationships } from '@/lib/db/schema/app'
import { saveSessionMessage } from '@/lib/db/queries/session-messages'
import { batchGetSessionContacts, getSessionContactInfo } from '@/lib/db/queries/entity-relationships'
import { searchSessionsSemantic } from '@/lib/sessions/embedding-service'
import type { ResourceAdapter, ResourceListItem, ResourceDetail, SearchResult, AddResult } from './types'

const LOG_PREFIX = '[mcp.resources.feedback]'

export const feedbackAdapter: ResourceAdapter = {
  async list(projectId, filters) {
    const limit = typeof filters.limit === 'number' ? filters.limit : 20

    const conditions = [
      eq(sessions.project_id, projectId),
      eq(sessions.is_archived, false),
    ]

    if (typeof filters.source === 'string') conditions.push(eq(sessions.source, filters.source))
    if (typeof filters.status === 'string') conditions.push(eq(sessions.status, filters.status))
    if (typeof filters.contact_id === 'string') {
      conditions.push(
        inArray(
          sessions.id,
          db
            .select({ id: entityRelationships.session_id })
            .from(entityRelationships)
            .where(
              and(
                eq(entityRelationships.contact_id, filters.contact_id),
                isNotNull(entityRelationships.session_id),
              ),
            ),
        ),
      )
    }
    if (typeof filters.search === 'string') {
      conditions.push(ilike(sessions.name, `%${filters.search}%`))
    }

    const data = await db
      .select({
        id: sessions.id,
        name: sessions.name,
        source: sessions.source,
        status: sessions.status,
        message_count: sessions.message_count,
        tags: sessions.tags,
        last_activity_at: sessions.last_activity_at,
      })
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.last_activity_at))
      .limit(limit)

    // Batch-enrich with contact/company info (2 queries instead of 3N)
    const contactInfoMap = await batchGetSessionContacts(data.map((s) => s.id))
    const items: ResourceListItem[] = data.map((s) => {
      const info = contactInfoMap.get(s.id)
      return {
        id: s.id,
        name: s.name ?? 'Unnamed feedback',
        description: [info?.contactName, info?.companyName].filter(Boolean).join(' @ ') || (s.source ?? 'unknown'),
        metadata: {
          source: s.source ?? 'unknown',
          status: s.status ?? 'active',
          messageCount: String(s.message_count ?? 0),
          ...(Array.isArray(s.tags) && s.tags.length > 0 ? { tags: (s.tags as string[]).join(', ') } : {}),
          lastActivityAt: s.last_activity_at?.toISOString() ?? '',
        },
      }
    })

    return { items, total: items.length }
  },

  async get(projectId, id) {
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
          eq(sessions.id, id),
          eq(sessions.project_id, projectId)
        )
      )

    if (!session) {
      return null
    }

    const messages = await db
      .select({
        sender_type: sessionMessages.sender_type,
        content: sessionMessages.content,
        created_at: sessionMessages.created_at,
      })
      .from(sessionMessages)
      .where(eq(sessionMessages.session_id, id))
      .orderBy(asc(sessionMessages.created_at))

    // Get contact info via entity_relationships
    const contactInfo = await getSessionContactInfo(id)
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

    return {
      id: session.id,
      type: 'feedback' as const,
      markdown: lines.join('\n'),
    }
  },

  async search(projectId, query, limit) {
    // Phase 1: Try semantic vector search
    try {
      const semanticResults = await searchSessionsSemantic(projectId, query, {
        limit,
        threshold: 0.5,
        isArchived: false,
      })

      if (semanticResults.length > 0) {
        return semanticResults.map(
          (r): SearchResult => ({
            id: r.sessionId,
            type: 'feedback',
            name: r.name ?? 'Unnamed feedback',
            snippet: r.description ?? '',
            score: r.similarity,
          })
        )
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} semantic search failed, falling back to full-text`, err)
    }

    // Phase 2: Fall back to full-text search via RPC
    const searchResults = await db.execute(sql`
      SELECT * FROM search_sessions_multi(
        ${projectId},
        ${query},
        ${query},
        ${false},
        ${limit},
        ${0}
      )
    `)

    if (!searchResults.rows || searchResults.rows.length === 0) {
      return []
    }

    const sessionIds = searchResults.rows.map((r: Record<string, unknown>) => r.session_id as string)

    // Batch-fetch session names (1 query instead of N)
    const nameMap = new Map<string, string | null>()
    if (sessionIds.length > 0) {
      const nameRows = await db
        .select({ id: sessions.id, name: sessions.name })
        .from(sessions)
        .where(inArray(sessions.id, sessionIds))
      for (const s of nameRows) {
        nameMap.set(s.id, s.name)
      }
    }

    return searchResults.rows.map(
      (r: Record<string, unknown>): SearchResult => ({
        id: r.session_id as string,
        type: 'feedback',
        name: nameMap.get(r.session_id as string) ?? 'Unnamed feedback',
        snippet: `Match in: ${r.match_source}`,
      })
    )
  },

  async add(projectId, data) {
    const messages = data.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Validation error: "messages" array is required and must not be empty.')
    }

    const sessionId = `api-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const now = new Date()

    const name = typeof data.name === 'string' ? data.name : null
    const tags = Array.isArray(data.tags) ? data.tags : []

    const [session] = await db
      .insert(sessions)
      .values({
        id: sessionId,
        project_id: projectId,
        name,
        source: 'api',
        status: 'active',
        message_count: messages.length,
        tags,
        is_archived: false,
        first_message_at: now,
        last_activity_at: now,
      })
      .returning({ id: sessions.id, name: sessions.name })

    if (!session) {
      throw new Error('Failed to create feedback session')
    }

    for (const msg of messages) {
      const role = typeof msg === 'object' && msg !== null && (msg as Record<string, unknown>).role
      const content = typeof msg === 'object' && msg !== null && (msg as Record<string, unknown>).content
      if (typeof content !== 'string') continue

      await saveSessionMessage({
        sessionId,
        projectId,
        senderType: role === 'user' ? 'user' : 'ai',
        content,
      })
    }

    return {
      id: session.id,
      type: 'feedback' as const,
      name: session.name ?? 'New feedback',
    }
  },
}
