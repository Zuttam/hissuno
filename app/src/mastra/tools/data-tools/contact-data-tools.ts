/**
 * Contact-Mode Data Tools for Hissuno Agent
 *
 * Scoped tools for end-user (contact) mode. All queries filter by both
 * projectId AND contactId from RuntimeContext to ensure contacts can only
 * see their own data.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/lib/db'
import { eq, and, asc, desc, inArray, isNotNull } from 'drizzle-orm'
import { batchGetIssueSessionCounts } from '@/lib/db/queries/entity-relationships'
import { sessions, sessionMessages, issues, entityRelationships } from '@/lib/db/schema/app'
import { getDataContext } from './helpers'

const NO_PROJECT_ERROR = 'Project context not available.'
const NO_CONTACT_ERROR = 'Contact context not available.'

// ============================================================================
// my-issues
// ============================================================================

export const myIssuesTool = createTool({
  id: 'my-issues',
  description: `List issues linked to your conversations.
Shows issues that were created or upvoted from your feedback sessions.`,
  inputSchema: z.object({
    type: z.enum(['bug', 'feature_request', 'change_request']).optional().describe('Filter by issue type'),
    status: z.enum(['open', 'ready', 'in_progress', 'resolved', 'closed']).optional().describe('Filter by status'),
    limit: z.number().min(1).max(20).default(10).optional().describe('Max results (default: 10)'),
  }),
  outputSchema: z.object({
    issues: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      status: z.string(),
      priority: z.string(),
      sessionCount: z.number(),
    })),
    total: z.number(),
    error: z.string().optional(),
  }),
  execute: async (context, { requestContext }) => {
    const { projectId, contactId } = getDataContext(requestContext)
    if (!projectId) return { issues: [], total: 0, error: NO_PROJECT_ERROR }
    if (!contactId) return { issues: [], total: 0, error: NO_CONTACT_ERROR }

    try {
      // Get sessions for this contact via entity_relationships
      const contactSessionRows = await db
        .select({ session_id: entityRelationships.session_id })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.project_id, projectId),
          eq(entityRelationships.contact_id, contactId),
          isNotNull(entityRelationships.session_id)
        ))

      const sessionIds = [...new Set(contactSessionRows.map((r) => r.session_id).filter((id): id is string => id !== null))]
      if (sessionIds.length === 0) {
        return { issues: [], total: 0 }
      }

      // Get issue IDs linked to these sessions via entity_relationships
      const issueLinks = await db
        .select({ issue_id: entityRelationships.issue_id })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.project_id, projectId),
          inArray(entityRelationships.session_id, sessionIds),
          isNotNull(entityRelationships.issue_id)
        ))

      // Deduplicate issue IDs
      const uniqueIssueIds = [...new Set(issueLinks.map((l) => l.issue_id).filter((id): id is string => id !== null))]
      if (uniqueIssueIds.length === 0) {
        return { issues: [], total: 0 }
      }

      // Fetch all issues in a single query
      const conditions = [inArray(issues.id, uniqueIssueIds)]
      if (context.type) conditions.push(eq(issues.type, context.type))
      if (context.status) conditions.push(eq(issues.status, context.status))

      const issueRows = await db
        .select({
          id: issues.id,
          name: issues.name,
          type: issues.type,
          status: issues.status,
          priority: issues.priority,
        })
        .from(issues)
        .where(and(...conditions))

      const sliced = issueRows.slice(0, context.limit ?? 10)
      const issueIds = sliced.map((i) => i.id)
      const sessionCounts = issueIds.length > 0 ? await batchGetIssueSessionCounts(issueIds) : new Map<string, number>()

      const issueList = sliced.map((issue) => ({
        id: issue.id,
        name: issue.name,
        type: issue.type,
        status: issue.status ?? 'open',
        priority: issue.priority,
        sessionCount: sessionCounts.get(issue.id) ?? 0,
      }))

      return { issues: issueList, total: issueRows.length }
    } catch (err) {
      return { issues: [], total: 0, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// ============================================================================
// my-conversations
// ============================================================================

export const myConversationsTool = createTool({
  id: 'my-conversations',
  description: `List your previous conversations (feedback sessions).
Shows your past interactions and their current status.`,
  inputSchema: z.object({
    status: z.enum(['active', 'closing_soon', 'awaiting_idle_response', 'closed']).optional().describe('Filter by status'),
    limit: z.number().min(1).max(20).default(10).optional().describe('Max results (default: 10)'),
  }),
  outputSchema: z.object({
    conversations: z.array(z.object({
      id: z.string(),
      name: z.string().nullable(),
      source: z.string(),
      status: z.string(),
      messageCount: z.number(),
      createdAt: z.string(),
      lastActivityAt: z.string(),
    })),
    total: z.number(),
    error: z.string().optional(),
  }),
  execute: async (context, { requestContext }) => {
    const { projectId, contactId } = getDataContext(requestContext)
    if (!projectId) return { conversations: [], total: 0, error: NO_PROJECT_ERROR }
    if (!contactId) return { conversations: [], total: 0, error: NO_CONTACT_ERROR }

    try {
      // Get session IDs for this contact via entity_relationships
      const contactSessionRows = await db
        .select({ session_id: entityRelationships.session_id })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.project_id, projectId),
          eq(entityRelationships.contact_id, contactId),
          isNotNull(entityRelationships.session_id)
        ))

      const contactSessionIds = [...new Set(contactSessionRows.map((r) => r.session_id).filter((id): id is string => id !== null))]
      if (contactSessionIds.length === 0) {
        return { conversations: [], total: 0 }
      }

      const conditions = [
        inArray(sessions.id, contactSessionIds),
        eq(sessions.project_id, projectId),
      ]

      if (context.status) {
        conditions.push(eq(sessions.status, context.status))
      }

      const data = await db
        .select({
          id: sessions.id,
          name: sessions.name,
          source: sessions.source,
          status: sessions.status,
          message_count: sessions.message_count,
          created_at: sessions.created_at,
          last_activity_at: sessions.last_activity_at,
        })
        .from(sessions)
        .where(and(...conditions))
        .orderBy(desc(sessions.last_activity_at))
        .limit(context.limit ?? 10)

      return {
        conversations: data.map((s) => ({
          id: s.id,
          name: s.name,
          source: s.source ?? 'unknown',
          status: s.status ?? 'active',
          messageCount: s.message_count ?? 0,
          createdAt: s.created_at?.toISOString() ?? '',
          lastActivityAt: s.last_activity_at?.toISOString() ?? '',
        })),
        total: data.length,
      }
    } catch (err) {
      return { conversations: [], total: 0, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// ============================================================================
// get-conversation
// ============================================================================

export const getConversationTool = createTool({
  id: 'get-conversation',
  description: `Get the full conversation history for one of your previous sessions.
Includes all messages. Only works for your own conversations.`,
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID'),
  }),
  outputSchema: z.object({
    conversation: z.object({
      id: z.string(),
      name: z.string().nullable(),
      source: z.string(),
      status: z.string(),
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
  execute: async (context, { requestContext }) => {
    const { projectId, contactId } = getDataContext(requestContext)
    if (!projectId) return { conversation: null, found: false, error: NO_PROJECT_ERROR }
    if (!contactId) return { conversation: null, found: false, error: NO_CONTACT_ERROR }

    try {
      // Verify ownership: check that this session is linked to the contact via entity_relationships
      const [ownershipCheck] = await db
        .select({ session_id: entityRelationships.session_id })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.project_id, projectId),
          eq(entityRelationships.session_id, context.sessionId),
          eq(entityRelationships.contact_id, contactId)
        ))

      if (!ownershipCheck) {
        return { conversation: null, found: false, error: 'Conversation not found' }
      }

      // Get session
      const [session] = await db
        .select({
          id: sessions.id,
          name: sessions.name,
          source: sessions.source,
          status: sessions.status,
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
        return { conversation: null, found: false, error: 'Conversation not found' }
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

      return {
        conversation: {
          id: session.id,
          name: session.name,
          source: session.source ?? 'unknown',
          status: session.status ?? 'active',
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
      return { conversation: null, found: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },
})

// Export all contact-mode data tools
export const contactDataTools = [
  myIssuesTool,
  myConversationsTool,
  getConversationTool,
]
