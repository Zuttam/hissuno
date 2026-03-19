/**
 * Issues Resource Adapter
 *
 * Provides access to project issues (bugs, feature requests, change requests).
 */

import { db } from '@/lib/db'
import { eq, and, desc, ilike, or, inArray, isNotNull } from 'drizzle-orm'
import { issues, sessions, entityRelationships } from '@/lib/db/schema/app'
import { createIssueAdmin } from '@/lib/issues/issues-service'
import { batchGetSessionContacts } from '@/lib/db/queries/entity-relationships'
import { searchSimilarIssues } from '@/lib/issues/embedding-service'
import type { ResourceAdapter, ResourceListItem, ResourceDetail, SearchResult, AddResult } from './types'

const LOG_PREFIX = '[mcp.resources.issues]'

const VALID_TYPES = ['bug', 'feature_request', 'change_request'] as const
type IssueType = (typeof VALID_TYPES)[number]

export const issuesAdapter: ResourceAdapter = {
  async list(projectId, filters) {
    const limit = typeof filters.limit === 'number' ? filters.limit : 20

    const conditions = [
      eq(issues.project_id, projectId),
      eq(issues.is_archived, false),
    ]

    if (typeof filters.type === 'string') conditions.push(eq(issues.type, filters.type))
    if (typeof filters.priority === 'string') conditions.push(eq(issues.priority, filters.priority))
    if (typeof filters.status === 'string') conditions.push(eq(issues.status, filters.status))
    if (typeof filters.search === 'string') {
      const s = `%${filters.search}%`
      conditions.push(
        or(
          ilike(issues.title, s),
          ilike(issues.description, s)
        )!
      )
    }

    const data = await db
      .select({
        id: issues.id,
        title: issues.title,
        type: issues.type,
        priority: issues.priority,
        status: issues.status,
        upvote_count: issues.upvote_count,
        updated_at: issues.updated_at,
      })
      .from(issues)
      .where(and(...conditions))
      .orderBy(desc(issues.updated_at))
      .limit(limit)

    const items: ResourceListItem[] = data.map((i) => ({
      id: i.id,
      name: i.title,
      description: `${i.type} | ${i.priority} priority | ${i.status}`,
      metadata: {
        type: i.type,
        priority: i.priority,
        status: i.status ?? 'open',
        upvoteCount: String(i.upvote_count ?? 0),
        updatedAt: i.updated_at?.toISOString() ?? '',
      },
    }))

    return { items, total: items.length }
  },

  async get(projectId, id) {
    const [issue] = await db
      .select({
        id: issues.id,
        title: issues.title,
        description: issues.description,
        type: issues.type,
        priority: issues.priority,
        status: issues.status,
        upvote_count: issues.upvote_count,
        created_at: issues.created_at,
        updated_at: issues.updated_at,
      })
      .from(issues)
      .where(
        and(
          eq(issues.id, id),
          eq(issues.project_id, projectId)
        )
      )

    if (!issue) {
      return null
    }

    const lines: string[] = [
      `# ${issue.title}`,
      '',
      `- **Type:** ${issue.type}`,
      `- **Priority:** ${issue.priority}`,
      `- **Status:** ${issue.status}`,
      `- **Upvotes:** ${issue.upvote_count ?? 0}`,
      `- **Created:** ${issue.created_at?.toISOString() ?? ''}`,
      `- **Updated:** ${issue.updated_at?.toISOString() ?? ''}`,
      '',
      '## Description',
      '',
      issue.description ?? '_No description_',
      '',
    ]

    // Get linked sessions with contact info via entity_relationships
    const sessionLinks = await db
      .select({ session_id: entityRelationships.session_id })
      .from(entityRelationships)
      .where(
        and(
          eq(entityRelationships.issue_id, id),
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
      const contactInfo = [info?.contactName, info?.companyName].filter(Boolean).join(' @ ')
      return {
        id: s.id,
        name: s.name,
        contactInfo,
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

    return {
      id: issue.id,
      type: 'issues' as const,
      markdown: lines.join('\n'),
    }
  },

  async search(projectId, query, limit) {
    // Phase 1: Try semantic vector search
    try {
      const results = await searchSimilarIssues(projectId, query, query, {
        limit,
        threshold: 0.4,
        includeClosed: true,
      })

      if (results.length > 0) {
        return results.map(
          (r): SearchResult => ({
            id: r.issueId,
            type: 'issues',
            name: r.title,
            snippet: r.description.slice(0, 200),
            score: r.similarity,
          })
        )
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} semantic search failed, falling back to text`, err)
    }

    // Phase 2: Fall back to ILIKE text search on title + description
    const s = `%${query}%`
    const data = await db
      .select({
        id: issues.id,
        title: issues.title,
        description: issues.description,
        updated_at: issues.updated_at,
      })
      .from(issues)
      .where(
        and(
          eq(issues.project_id, projectId),
          eq(issues.is_archived, false),
          or(
            ilike(issues.title, s),
            ilike(issues.description, s)
          )
        )
      )
      .orderBy(desc(issues.updated_at))
      .limit(limit)

    return data.map(
      (r): SearchResult => ({
        id: r.id,
        type: 'issues',
        name: r.title,
        snippet: (r.description ?? '').slice(0, 200),
        score: 0,
      })
    )
  },

  async add(projectId, data): Promise<AddResult> {
    const type = data.type
    if (typeof type !== 'string' || !VALID_TYPES.includes(type as IssueType)) {
      throw new Error(`Validation error: "type" must be one of: ${VALID_TYPES.join(', ')}`)
    }

    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Validation error: "title" is required.')
    }

    if (typeof data.description !== 'string' || data.description.trim().length === 0) {
      throw new Error('Validation error: "description" is required.')
    }

    const result = await createIssueAdmin({
      projectId,
      type: type as IssueType,
      title: data.title,
      description: data.description,
      priority: typeof data.priority === 'string' ? (data.priority as 'low' | 'medium' | 'high') : undefined,
    })

    return {
      id: result.issue.id,
      type: 'issues',
      name: result.issue.title,
    }
  },
}
