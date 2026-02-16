/**
 * User-Mode Data Tools for Support Agent
 *
 * Full project access tools for PM/team member mode (contactId === null).
 * All queries filter by projectId from RuntimeContext using createAdminClient().
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getDataContext } from './helpers'

const NO_PROJECT_ERROR = 'Project context not available.'

// ============================================================================
// list-issues
// ============================================================================

export const listIssuesTool = createTool({
  id: 'list-issues',
  description: `List issues for the current project with optional filters.
Use this to find bugs, feature requests, or change requests.
Returns a summary of each issue including title, type, priority, status, and upvote count.`,
  inputSchema: z.object({
    type: z.enum(['bug', 'feature_request', 'change_request']).optional().describe('Filter by issue type'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter by priority'),
    status: z.enum(['open', 'ready', 'in_progress', 'resolved', 'closed']).optional().describe('Filter by status'),
    search: z.string().optional().describe('Search in title and description'),
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
      const supabase = createAdminClient()
      let query = supabase
        .from('issues')
        .select('id, title, type, priority, status, upvote_count, updated_at', { count: 'exact' })
        .eq('project_id', projectId)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })

      if (context.type) query = query.eq('type', context.type)
      if (context.priority) query = query.eq('priority', context.priority)
      if (context.status) query = query.eq('status', context.status)
      if (context.search) {
        const s = context.search.replace(/[%_.,()]/g, '\\$&')
        query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`)
      }
      query = query.limit(context.limit ?? 20)

      const { data, count, error } = await query
      if (error) {
        return { issues: [], total: 0, error: error.message }
      }

      return {
        issues: (data ?? []).map((i) => ({
          id: i.id,
          title: i.title,
          type: i.type,
          priority: i.priority,
          status: i.status,
          upvoteCount: i.upvote_count ?? 0,
          updatedAt: i.updated_at,
        })),
        total: count ?? 0,
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
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('issues')
        .select(`
          id, title, description, type, priority, status, upvote_count, created_at, updated_at,
          issue_sessions(
            session:sessions(id, created_at, contact:contacts(id, name, email, company:companies(id, name)))
          )
        `)
        .eq('id', context.issueId)
        .eq('project_id', projectId)
        .single()

      if (error || !data) {
        return { issue: null, found: false, error: error?.code === 'PGRST116' ? 'Issue not found' : error?.message }
      }

      const sessions = (data.issue_sessions ?? [])
        .map((is: { session: unknown }) => {
          const s = Array.isArray(is.session) ? is.session[0] : is.session
          if (!s || typeof s !== 'object') return null
          const sess = s as Record<string, unknown>
          const contact = sess.contact as unknown as Record<string, unknown> | null
          const company = contact?.company as unknown as Record<string, unknown> | null
          return {
            id: sess.id as string,
            contactName: (contact?.name as string) ?? null,
            contactEmail: (contact?.email as string) ?? null,
            companyName: (company?.name as string) ?? null,
            createdAt: sess.created_at as string,
          }
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)

      return {
        issue: {
          id: data.id,
          title: data.title,
          description: data.description ?? '',
          type: data.type,
          priority: data.priority,
          status: data.status,
          upvoteCount: data.upvote_count ?? 0,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          sessions,
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
      const supabase = createAdminClient()
      let query = supabase
        .from('sessions')
        .select('id, name, source, status, message_count, tags, last_activity_at, contact:contacts(id, name, email, company:companies(id, name))', { count: 'exact' })
        .eq('project_id', projectId)
        .eq('is_archived', false)
        .order('last_activity_at', { ascending: false })

      if (context.source) query = query.eq('source', context.source)
      if (context.status) query = query.eq('status', context.status)
      if (context.tags && context.tags.length > 0) query = query.overlaps('tags', context.tags)
      if (context.dateFrom) query = query.gte('created_at', context.dateFrom)
      if (context.dateTo) query = query.lte('created_at', context.dateTo)
      if (context.contactId) query = query.eq('contact_id', context.contactId)
      if (context.search) {
        const s = context.search.replace(/[%_.,()]/g, '\\$&')
        query = query.ilike('name', `%${s}%`)
      }
      query = query.limit(context.limit ?? 20)

      const { data, count, error } = await query
      if (error) {
        return { sessions: [], total: 0, error: error.message }
      }

      return {
        sessions: (data ?? []).map((s) => {
          const contact = s.contact as unknown as Record<string, unknown> | null
          const company = contact?.company as unknown as Record<string, unknown> | null
          return {
            id: s.id,
            name: s.name,
            source: s.source,
            status: s.status,
            messageCount: s.message_count ?? 0,
            contactName: (contact?.name as string) ?? null,
            contactEmail: (contact?.email as string) ?? null,
            companyName: (company?.name as string) ?? null,
            tags: (s.tags as string[]) ?? [],
            lastActivityAt: s.last_activity_at,
          }
        }),
        total: count ?? 0,
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
      const supabase = createAdminClient()

      // Get session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, name, source, status, message_count, tags, created_at, contact:contacts(id, name, email)')
        .eq('id', context.sessionId)
        .eq('project_id', projectId)
        .single()

      if (sessionError || !session) {
        return { session: null, found: false, error: sessionError?.code === 'PGRST116' ? 'Session not found' : sessionError?.message }
      }

      // Get messages
      const { data: messages } = await supabase
        .from('session_messages')
        .select('sender_type, content, created_at')
        .eq('session_id', context.sessionId)
        .order('created_at', { ascending: true })

      const contact = session.contact as unknown as Record<string, unknown> | null

      return {
        session: {
          id: session.id,
          name: session.name,
          source: session.source,
          status: session.status,
          messageCount: session.message_count ?? 0,
          contactName: (contact?.name as string) ?? null,
          contactEmail: (contact?.email as string) ?? null,
          tags: (session.tags as string[]) ?? [],
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
      const supabase = createAdminClient()
      let query = supabase
        .from('contacts')
        .select('id, name, email, role, title, is_champion, last_contacted_at, company:companies(id, name)', { count: 'exact' })
        .eq('project_id', projectId)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })

      if (context.search) {
        const s = context.search.replace(/[%_.,()]/g, '\\$&')
        query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`)
      }
      if (context.companyId) query = query.eq('company_id', context.companyId)
      if (context.role) {
        const s = context.role.replace(/[%_.,()]/g, '\\$&')
        query = query.ilike('role', `%${s}%`)
      }
      query = query.limit(context.limit ?? 20)

      const { data, count, error } = await query
      if (error) {
        return { contacts: [], total: 0, error: error.message }
      }

      return {
        contacts: (data ?? []).map((c) => {
          const company = c.company as unknown as Record<string, unknown> | null
          return {
            id: c.id,
            name: c.name,
            email: c.email,
            role: c.role,
            title: c.title,
            companyName: (company?.name as string) ?? null,
            isChampion: c.is_champion ?? false,
            lastContactedAt: c.last_contacted_at,
          }
        }),
        total: count ?? 0,
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
      const supabase = createAdminClient()

      // Get contact with company
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id, name, email, role, title, phone, is_champion, notes, last_contacted_at, company:companies(id, name)')
        .eq('id', context.contactId)
        .eq('project_id', projectId)
        .single()

      if (contactError || !contact) {
        return { contact: null, found: false, error: contactError?.code === 'PGRST116' ? 'Contact not found' : contactError?.message }
      }

      // Get linked sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, name, source, message_count, created_at')
        .eq('contact_id', context.contactId)
        .order('created_at', { ascending: false })
        .limit(20)

      // Get linked issues (sessions -> issue_sessions -> issues)
      const { data: sessionIssues } = await supabase
        .from('sessions')
        .select('issue_sessions(issue:issues(id, title, type, status))')
        .eq('contact_id', context.contactId)

      const issueMap = new Map<string, { id: string; title: string; type: string; status: string }>()
      for (const s of sessionIssues ?? []) {
        const links = (s as unknown as { issue_sessions: Array<{ issue: unknown }> }).issue_sessions ?? []
        for (const link of links) {
          const issue = Array.isArray(link.issue) ? link.issue[0] : link.issue
          if (issue && typeof issue === 'object' && 'id' in issue) {
            const i = issue as { id: string; title: string; type: string; status: string }
            if (!issueMap.has(i.id)) issueMap.set(i.id, i)
          }
        }
      }

      const company = contact.company as unknown as Record<string, unknown> | null

      return {
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          role: contact.role,
          title: contact.title,
          phone: contact.phone,
          companyName: (company?.name as string) ?? null,
          isChampion: contact.is_champion ?? false,
          notes: contact.notes,
          lastContactedAt: contact.last_contacted_at,
          sessions: (sessions ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            source: s.source,
            messageCount: s.message_count ?? 0,
            createdAt: s.created_at,
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
