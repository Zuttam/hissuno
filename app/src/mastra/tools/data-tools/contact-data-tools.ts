/**
 * Contact-Mode Data Tools for Support Agent
 *
 * Scoped tools for end-user (contact) mode. All queries filter by both
 * projectId AND contactId from RuntimeContext to ensure contacts can only
 * see their own data.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
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
      title: z.string(),
      type: z.string(),
      status: z.string(),
      priority: z.string(),
      upvoteCount: z.number(),
    })),
    total: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { projectId, contactId } = getDataContext(runtimeContext)
    if (!projectId) return { issues: [], total: 0, error: NO_PROJECT_ERROR }
    if (!contactId) return { issues: [], total: 0, error: NO_CONTACT_ERROR }

    try {
      const supabase = createAdminClient()

      // sessions (by contact_id) -> issue_sessions -> issues
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('issue_sessions(issue:issues(id, title, type, status, priority, upvote_count))')
        .eq('contact_id', contactId)
        .eq('project_id', projectId)

      if (!sessionData) {
        return { issues: [], total: 0 }
      }

      // Deduplicate issues
      const issueMap = new Map<string, { id: string; title: string; type: string; status: string; priority: string; upvoteCount: number }>()
      for (const session of sessionData) {
        const links = (session as unknown as { issue_sessions: Array<{ issue: unknown }> }).issue_sessions ?? []
        for (const link of links) {
          const issue = Array.isArray(link.issue) ? link.issue[0] : link.issue
          if (issue && typeof issue === 'object' && 'id' in issue) {
            const i = issue as Record<string, unknown>
            const id = i.id as string
            if (!issueMap.has(id)) {
              // Apply filters
              if (context.type && i.type !== context.type) continue
              if (context.status && i.status !== context.status) continue
              issueMap.set(id, {
                id,
                title: i.title as string,
                type: i.type as string,
                status: i.status as string,
                priority: i.priority as string,
                upvoteCount: (i.upvote_count as number) ?? 0,
              })
            }
          }
        }
      }

      const issues = Array.from(issueMap.values()).slice(0, context.limit ?? 10)
      return { issues, total: issueMap.size }
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
  execute: async ({ context, runtimeContext }) => {
    const { projectId, contactId } = getDataContext(runtimeContext)
    if (!projectId) return { conversations: [], total: 0, error: NO_PROJECT_ERROR }
    if (!contactId) return { conversations: [], total: 0, error: NO_CONTACT_ERROR }

    try {
      const supabase = createAdminClient()
      let query = supabase
        .from('sessions')
        .select('id, name, source, status, message_count, created_at, last_activity_at', { count: 'exact' })
        .eq('contact_id', contactId)
        .eq('project_id', projectId)
        .order('last_activity_at', { ascending: false })

      if (context.status) query = query.eq('status', context.status)
      query = query.limit(context.limit ?? 10)

      const { data, count, error } = await query
      if (error) {
        return { conversations: [], total: 0, error: error.message }
      }

      return {
        conversations: (data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          source: s.source,
          status: s.status,
          messageCount: s.message_count ?? 0,
          createdAt: s.created_at,
          lastActivityAt: s.last_activity_at,
        })),
        total: count ?? 0,
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
  execute: async ({ context, runtimeContext }) => {
    const { projectId, contactId } = getDataContext(runtimeContext)
    if (!projectId) return { conversation: null, found: false, error: NO_PROJECT_ERROR }
    if (!contactId) return { conversation: null, found: false, error: NO_CONTACT_ERROR }

    try {
      const supabase = createAdminClient()

      // Get session with ownership check (contact_id must match)
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, name, source, status, created_at, contact_id')
        .eq('id', context.sessionId)
        .eq('project_id', projectId)
        .single()

      if (sessionError || !session) {
        return { conversation: null, found: false, error: sessionError?.code === 'PGRST116' ? 'Conversation not found' : sessionError?.message }
      }

      // Verify ownership
      if (session.contact_id !== contactId) {
        return { conversation: null, found: false, error: 'Conversation not found' }
      }

      // Get messages
      const { data: messages } = await supabase
        .from('session_messages')
        .select('sender_type, content, created_at')
        .eq('session_id', context.sessionId)
        .order('created_at', { ascending: true })

      return {
        conversation: {
          id: session.id,
          name: session.name,
          source: session.source,
          status: session.status,
          createdAt: session.created_at,
          messages: (messages ?? []).map((m) => ({
            role: m.sender_type === 'user' ? 'user' : 'assistant',
            content: m.content,
            createdAt: m.created_at,
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
