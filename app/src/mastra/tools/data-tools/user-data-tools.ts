/**
 * User-Mode Data Tools for Hissuno Agent
 *
 * Full project access tools for PM/team member mode (contactId === null).
 * All queries filter by projectId from RuntimeContext using Drizzle ORM.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/lib/db'
import { eq, and, desc, ilike, or, asc, inArray, isNotNull, sql } from 'drizzle-orm'
import { sessions, sessionMessages, issues, contacts, companies, entityRelationships } from '@/lib/db/schema/app'
import { batchGetSessionContacts, getSessionContactInfo } from '@/lib/db/queries/entity-relationships'
import { getDataContext } from './helpers'

const NO_PROJECT_ERROR = 'Project context not available.'

// ============================================================================
// list-issues
// ============================================================================

export const listIssuesTool = createTool({
  id: 'list-issues',
  description: `List issues for the current project with optional filters.
Use this to find bugs, feature requests, or change requests.
Supports filtering by goalId to find issues that contribute to a specific product scope goal.
Returns a summary of each issue including title, type, priority, status, and upvote count.`,
  inputSchema: z.object({
    type: z.enum(['bug', 'feature_request', 'change_request']).optional().describe('Filter by issue type'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter by priority'),
    status: z.enum(['open', 'ready', 'in_progress', 'resolved', 'closed']).optional().describe('Filter by status'),
    search: z.string().optional().describe('Search in title and description'),
    goalId: z.string().optional().describe('Filter by product scope goal ID - returns only issues classified under this goal'),
    limit: z.number().min(1).max(50).default(20).optional().describe('Max results (default: 20)'),
  }),
  outputSchema: z.object({
    issues: z.array(z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      priority: z.string(),
      status: z.string(),
      upvoteCount: z.number(),
      updatedAt: z.string(),
    })),
    total: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { projectId } = getDataContext(runtimeContext)
    if (!projectId) {
      return { issues: [], total: 0, error: NO_PROJECT_ERROR }
    }

    try {
      const conditions = [
        eq(issues.project_id, projectId),
        eq(issues.is_archived, false),
      ]

      if (context.type) conditions.push(eq(issues.type, context.type))
      if (context.priority) conditions.push(eq(issues.priority, context.priority))
      if (context.status) conditions.push(eq(issues.status, context.status))
      if (context.search) {
        const s = `%${context.search}%`
        conditions.push(
          or(
            ilike(issues.title, s),
            ilike(issues.description, s)
          )!
        )
      }
      if (context.goalId) {
        conditions.push(
          inArray(
            issues.id,
            db
              .select({ id: entityRelationships.issue_id })
              .from(entityRelationships)
              .where(
                and(
                  isNotNull(entityRelationships.issue_id),
                  isNotNull(entityRelationships.product_scope_id),
                  sql`${entityRelationships.metadata}->>'matchedGoalId' = ${context.goalId}`,
                ),
              ),
          ),
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
        .limit(context.limit ?? 20)

      return {
        issues: data.map((i) => ({
          id: i.id,
          title: i.title,
          type: i.type,
          priority: i.priority,
          status: i.status ?? 'open',
          upvoteCount: i.upvote_count ?? 0,
          updatedAt: i.updated_at?.toISOString() ?? '',
        })),
        total: data.length,
      }
    } catch (err) {
      return { issues: [], total: 0, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// ============================================================================
// get-issue
// ============================================================================

export const getIssueTool = createTool({
  id: 'get-issue',
  description: `Get full details of a specific issue including linked feedback sessions and contacts.
Use this after list-issues to drill into a specific issue.`,
  inputSchema: z.object({
    issueId: z.string().describe('The issue ID'),
  }),
  outputSchema: z.object({
    issue: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.string(),
      priority: z.string(),
      status: z.string(),
      upvoteCount: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
      sessions: z.array(z.object({
        id: z.string(),
        contactName: z.string().nullable(),
        contactEmail: z.string().nullable(),
        companyName: z.string().nullable(),
        createdAt: z.string(),
      })),
    }).nullable(),
    found: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { projectId } = getDataContext(runtimeContext)
    if (!projectId) {
      return { issue: null, found: false, error: NO_PROJECT_ERROR }
    }

    try {
      // Get issue
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
            eq(issues.id, context.issueId),
            eq(issues.project_id, projectId)
          )
        )

      if (!issue) {
        return { issue: null, found: false, error: 'Issue not found' }
      }

      // Get linked sessions via entity_relationships
      const issueSessionLinks = await db
        .select({ session_id: entityRelationships.session_id })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.issue_id, context.issueId),
          isNotNull(entityRelationships.session_id)
        ))

      const sessionIds = [...new Set(issueSessionLinks.map((l) => l.session_id).filter((id): id is string => id !== null))]

      // Batch-fetch sessions and contacts (2-3 queries total instead of 3N)
      const [sessionRows, contactInfoMap] = await Promise.all([
        sessionIds.length > 0
          ? db.select({ id: sessions.id, created_at: sessions.created_at })
              .from(sessions).where(inArray(sessions.id, sessionIds))
          : Promise.resolve([]),
        batchGetSessionContacts(sessionIds),
      ])

      const linkedSessions = sessionRows.map((s) => {
        const info = contactInfoMap.get(s.id)
        return {
          id: s.id,
          contactName: info?.contactName ?? null,
          contactEmail: info?.contactEmail ?? null,
          companyName: info?.companyName ?? null,
          createdAt: s.created_at?.toISOString() ?? '',
        }
      })

      return {
        issue: {
          id: issue.id,
          title: issue.title,
          description: issue.description ?? '',
          type: issue.type,
          priority: issue.priority,
          status: issue.status ?? 'open',
          upvoteCount: issue.upvote_count ?? 0,
          createdAt: issue.created_at?.toISOString() ?? '',
          updatedAt: issue.updated_at?.toISOString() ?? '',
          sessions: linkedSessions,
        },
        found: true,
      }
    } catch (err) {
      return { issue: null, found: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// ============================================================================
// list-feedback
// ============================================================================

export const listFeedbackTool = createTool({
  id: 'list-feedback',
  description: `List feedback sessions (conversations) for the current project.
Use this to browse customer conversations with optional filters.`,
  inputSchema: z.object({
    source: z.enum(['widget', 'slack', 'intercom', 'gong', 'api', 'manual']).optional().describe('Filter by source channel'),
    status: z.enum(['active', 'closing_soon', 'awaiting_idle_response', 'closed']).optional().describe('Filter by status'),
    tags: z.array(z.string()).optional().describe('Filter by tags (overlaps)'),
    dateFrom: z.string().optional().describe('Filter from date (ISO string)'),
    dateTo: z.string().optional().describe('Filter to date (ISO string)'),
    contactId: z.string().optional().describe('Filter by contact ID'),
    search: z.string().optional().describe('Search in session name'),
    limit: z.number().min(1).max(50).default(20).optional().describe('Max results (default: 20)'),
  }),
  outputSchema: z.object({
    sessions: z.array(z.object({
      id: z.string(),
      name: z.string().nullable(),
      source: z.string(),
      status: z.string(),
      messageCount: z.number(),
      contactName: z.string().nullable(),
      contactEmail: z.string().nullable(),
      companyName: z.string().nullable(),
      tags: z.array(z.string()),
      lastActivityAt: z.string(),
    })),
    total: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { projectId } = getDataContext(runtimeContext)
    if (!projectId) {
      return { sessions: [], total: 0, error: NO_PROJECT_ERROR }
    }

    try {
      const conditions = [
        eq(sessions.project_id, projectId),
        eq(sessions.is_archived, false),
      ]

      if (context.source) conditions.push(eq(sessions.source, context.source))
      if (context.status) conditions.push(eq(sessions.status, context.status))
      if (context.contactId) {
        // Filter by contact via entity_relationships
        const contactSessionRows = await db
          .select({ session_id: entityRelationships.session_id })
          .from(entityRelationships)
          .where(and(
            eq(entityRelationships.project_id, projectId),
            eq(entityRelationships.contact_id, context.contactId),
            isNotNull(entityRelationships.session_id)
          ))
        const contactSessionIds = contactSessionRows.map((r) => r.session_id).filter((id): id is string => id !== null)
        if (contactSessionIds.length === 0) {
          return { sessions: [], total: 0 }
        }
        conditions.push(inArray(sessions.id, contactSessionIds))
      }
      if (context.search) {
        conditions.push(ilike(sessions.name, `%${context.search}%`))
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
        .limit(context.limit ?? 20)

      // Batch-enrich with contact/company info (2 queries instead of 3N)
      const contactInfoMap = await batchGetSessionContacts(data.map((s) => s.id))
      const result = data.map((s) => {
        const info = contactInfoMap.get(s.id)
        return {
          id: s.id,
          name: s.name,
          source: s.source ?? 'unknown',
          status: s.status ?? 'active',
          messageCount: s.message_count ?? 0,
          contactName: info?.contactName ?? null,
          contactEmail: info?.contactEmail ?? null,
          companyName: info?.companyName ?? null,
          tags: (s.tags as string[]) ?? [],
          lastActivityAt: s.last_activity_at?.toISOString() ?? '',
        }
      })

      return {
        sessions: result,
        total: result.length,
      }
    } catch (err) {
      return { sessions: [], total: 0, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// ============================================================================
// get-feedback
// ============================================================================

export const getFeedbackTool = createTool({
  id: 'get-feedback',
  description: `Get full details of a specific feedback session including its messages.
Use this after list-feedback to read the conversation.`,
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID'),
  }),
  outputSchema: z.object({
    session: z.object({
      id: z.string(),
      name: z.string().nullable(),
      source: z.string(),
      status: z.string(),
      messageCount: z.number(),
      contactName: z.string().nullable(),
      contactEmail: z.string().nullable(),
      tags: z.array(z.string()),
      createdAt: z.string(),
      messages: z.array(z.object({
        role: z.string(),
        content: z.string(),
        createdAt: z.string(),
      })),
    }).nullable(),
    found: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { projectId } = getDataContext(runtimeContext)
    if (!projectId) {
      return { session: null, found: false, error: NO_PROJECT_ERROR }
    }

    try {
      // Get session
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
            eq(sessions.id, context.sessionId),
            eq(sessions.project_id, projectId)
          )
        )

      if (!session) {
        return { session: null, found: false, error: 'Session not found' }
      }

      // Get messages
      const messages = await db
        .select({
          sender_type: sessionMessages.sender_type,
          content: sessionMessages.content,
          created_at: sessionMessages.created_at,
        })
        .from(sessionMessages)
        .where(eq(sessionMessages.session_id, context.sessionId))
        .orderBy(asc(sessionMessages.created_at))

      // Get contact info via entity_relationships
      const contactInfo = await getSessionContactInfo(context.sessionId)

      return {
        session: {
          id: session.id,
          name: session.name,
          source: session.source ?? 'unknown',
          status: session.status ?? 'active',
          messageCount: session.message_count ?? 0,
          contactName: contactInfo?.contactName ?? null,
          contactEmail: contactInfo?.contactEmail ?? null,
          tags: (session.tags as string[]) ?? [],
          createdAt: session.created_at?.toISOString() ?? '',
          messages: messages.map((m) => ({
            role: m.sender_type === 'user' ? 'user' : 'assistant',
            content: m.content,
            createdAt: m.created_at?.toISOString() ?? '',
          })),
        },
        found: true,
      }
    } catch (err) {
      return { session: null, found: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// ============================================================================
// list-contacts
// ============================================================================

export const listContactsTool = createTool({
  id: 'list-contacts',
  description: `List contacts for the current project.
Use this to find customers, understand who is reporting issues, or identify champions.`,
  inputSchema: z.object({
    search: z.string().optional().describe('Search by name or email'),
    companyId: z.string().optional().describe('Filter by company ID'),
    role: z.string().optional().describe('Filter by role (partial match)'),
    limit: z.number().min(1).max(50).default(20).optional().describe('Max results (default: 20)'),
  }),
  outputSchema: z.object({
    contacts: z.array(z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string().nullable(),
      title: z.string().nullable(),
      companyName: z.string().nullable(),
      isChampion: z.boolean(),
      lastContactedAt: z.string().nullable(),
    })),
    total: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { projectId } = getDataContext(runtimeContext)
    if (!projectId) {
      return { contacts: [], total: 0, error: NO_PROJECT_ERROR }
    }

    try {
      const conditions = [
        eq(contacts.project_id, projectId),
        eq(contacts.is_archived, false),
      ]

      if (context.search) {
        const s = `%${context.search}%`
        conditions.push(
          or(
            ilike(contacts.name, s),
            ilike(contacts.email, s)
          )!
        )
      }
      if (context.companyId) conditions.push(eq(contacts.company_id, context.companyId))
      if (context.role) {
        conditions.push(ilike(contacts.role, `%${context.role}%`))
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
        .limit(context.limit ?? 20)

      // Enrich with company names
      const result = []
      for (const c of data) {
        let companyName: string | null = null
        if (c.company_id) {
          const [company] = await db
            .select({ name: companies.name })
            .from(companies)
            .where(eq(companies.id, c.company_id))
          companyName = company?.name ?? null
        }
        result.push({
          id: c.id,
          name: c.name,
          email: c.email,
          role: c.role,
          title: c.title,
          companyName,
          isChampion: c.is_champion ?? false,
          lastContactedAt: c.last_contacted_at?.toISOString() ?? null,
        })
      }

      return {
        contacts: result,
        total: result.length,
      }
    } catch (err) {
      return { contacts: [], total: 0, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// ============================================================================
// get-contact
// ============================================================================

export const getContactTool = createTool({
  id: 'get-contact',
  description: `Get full details of a specific contact including their linked sessions and issues.
Use this after list-contacts to drill into a specific contact.`,
  inputSchema: z.object({
    contactId: z.string().describe('The contact ID'),
  }),
  outputSchema: z.object({
    contact: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string().nullable(),
      title: z.string().nullable(),
      phone: z.string().nullable(),
      companyName: z.string().nullable(),
      isChampion: z.boolean(),
      notes: z.string().nullable(),
      lastContactedAt: z.string().nullable(),
      sessions: z.array(z.object({
        id: z.string(),
        name: z.string().nullable(),
        source: z.string(),
        messageCount: z.number(),
        createdAt: z.string(),
      })),
      issues: z.array(z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        status: z.string(),
      })),
    }).nullable(),
    found: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { projectId } = getDataContext(runtimeContext)
    if (!projectId) {
      return { contact: null, found: false, error: NO_PROJECT_ERROR }
    }

    try {
      // Get contact
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
            eq(contacts.id, context.contactId),
            eq(contacts.project_id, projectId)
          )
        )

      if (!contact) {
        return { contact: null, found: false, error: 'Contact not found' }
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
      const contactSessionRels = await db
        .select({ session_id: entityRelationships.session_id })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.contact_id, context.contactId),
          isNotNull(entityRelationships.session_id)
        ))

      const contactSessionIds = [...new Set(contactSessionRels.map((r) => r.session_id).filter((id): id is string => id !== null))]

      const contactSessions = contactSessionIds.length > 0
        ? await db
            .select({
              id: sessions.id,
              name: sessions.name,
              source: sessions.source,
              message_count: sessions.message_count,
              created_at: sessions.created_at,
            })
            .from(sessions)
            .where(inArray(sessions.id, contactSessionIds))
            .orderBy(desc(sessions.created_at))
            .limit(20)
        : []

      // Get linked issues (sessions -> entity_relationships -> issues)
      const issueMap = new Map<string, { id: string; title: string; type: string; status: string }>()

      if (contactSessionIds.length > 0) {
        const issueLinks = await db
          .select({ issue_id: entityRelationships.issue_id })
          .from(entityRelationships)
          .where(and(
            inArray(entityRelationships.session_id, contactSessionIds),
            isNotNull(entityRelationships.issue_id)
          ))

        const uniqueIssueIds = [...new Set(issueLinks.map((l) => l.issue_id).filter((id): id is string => id !== null))]

        if (uniqueIssueIds.length > 0) {
          const issueRows = await db
            .select({
              id: issues.id,
              title: issues.title,
              type: issues.type,
              status: issues.status,
            })
            .from(issues)
            .where(inArray(issues.id, uniqueIssueIds))

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

      return {
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          role: contact.role,
          title: contact.title,
          phone: contact.phone,
          companyName,
          isChampion: contact.is_champion ?? false,
          notes: contact.notes,
          lastContactedAt: contact.last_contacted_at?.toISOString() ?? null,
          sessions: contactSessions.map((s) => ({
            id: s.id,
            name: s.name,
            source: s.source ?? 'unknown',
            messageCount: s.message_count ?? 0,
            createdAt: s.created_at?.toISOString() ?? '',
          })),
          issues: Array.from(issueMap.values()),
        },
        found: true,
      }
    } catch (err) {
      return { contact: null, found: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// Export all user-mode data tools
export const userDataTools = [
  listIssuesTool,
  getIssueTool,
  listFeedbackTool,
  getFeedbackTool,
  listContactsTool,
  getContactTool,
]
