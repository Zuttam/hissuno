import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, isSupabaseConfigured, isServiceRoleConfigured } from './server'
import { saveSessionMessage } from './session-messages'
import type { SessionRecord, SessionWithProject, SessionFilters, SessionLinkedIssue, SessionTag, SessionSource, CreateSessionInput } from '@/types/session'

const selectSessionWithProject = '*, project:projects(id, name)'
const selectSessionWithLinkedIssues = `
  *,
  project:projects(id, name),
  issue_sessions(
    issue:issues(id, title, type, status, upvote_count)
  )
`

/**
 * Upserts a session record. Uses admin client since this is called
 * from the copilotkit route which doesn't have user auth context.
 *
 * Note: Limits are enforced at analysis time (PM review), not at session creation.
 */
export async function upsertSession(params: {
  id: string
  projectId: string
  userId?: string | null
  userMetadata?: Record<string, string> | null
  pageUrl?: string | null
  pageTitle?: string | null
  source?: SessionSource | null
}): Promise<void> {
  if (!isServiceRoleConfigured()) {
    console.warn('[supabase.sessions] Service role not configured, skipping session upsert')
    return
  }

  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('sessions')
      .upsert(
        {
          id: params.id,
          project_id: params.projectId,
          user_id: params.userId || null,
          user_metadata: params.userMetadata || {},
          page_url: params.pageUrl || null,
          page_title: params.pageTitle || null,
          source: params.source || 'widget',
          last_activity_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        }
      )

    if (error) {
      console.error('[supabase.sessions] failed to upsert session', params.id, error)
    }
  } catch (error) {
    console.error('[supabase.sessions] unexpected error upserting session', params.id, error)
  }
}

/**
 * Updates the last activity timestamp and increments message count for a session.
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  if (!isServiceRoleConfigured()) {
    return
  }

  try {
    const supabase = createAdminClient()
    
    // First get current message count
    const { data: session } = await supabase
      .from('sessions')
      .select('message_count, first_message_at')
      .eq('id', sessionId)
      .single()

    const updates: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
      message_count: (session?.message_count ?? 0) + 1,
    }

    // Set first_message_at if not already set
    if (!session?.first_message_at) {
      updates.first_message_at = new Date().toISOString()
    }

    await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
  } catch (error) {
    console.error('[supabase.sessions] error updating session activity', sessionId, error)
  }
}

/**
 * Lists sessions with optional filters. Requires authenticated user context.
 * Only returns sessions for projects owned by the current user.
 */
export const listSessions = cache(async (filters: SessionFilters = {}): Promise<SessionWithProject[]> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('[supabase.sessions] failed to resolve user for listSessions', userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    // Build query - join with projects to filter by user ownership
    let query = supabase
      .from('sessions')
      .select(selectSessionWithProject)
      .order('last_activity_at', { ascending: false })

    // Filter to only projects owned by this user
    // We need to use a subquery approach via inner join
    const { data: userProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id)

    const projectIds = userProjects?.map(p => p.id) ?? []
    
    if (projectIds.length === 0) {
      return []
    }

    query = query.in('project_id', projectIds)

    // Filter archived sessions (hidden by default)
    if (!filters.showArchived) {
      query = query.eq('is_archived', false)
    }

    // Apply filters
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }
    if (filters.userId) {
      query = query.ilike('user_id', `%${filters.userId}%`)
    }
    if (filters.sessionId) {
      query = query.ilike('id', `%${filters.sessionId}%`)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags)
    }
    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }
    if (filters.limit) {
      query = query.limit(filters.limit)
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[supabase.sessions] failed to list sessions', error)
      throw new Error('Unable to load sessions from Supabase.')
    }

    return (data ?? []) as SessionWithProject[]
  } catch (error) {
    console.error('[supabase.sessions] unexpected error listing sessions', error)
    throw error
  }
})

/**
 * Gets a session by ID. Requires authenticated user context.
 * Only returns the session if it belongs to a project owned by the current user.
 * Includes linked issues from PM review.
 */
export const getSessionById = cache(async (sessionId: string): Promise<SessionWithProject | null> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('[supabase.sessions] failed to resolve user for getSessionById', sessionId, userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    // Get session with project info and linked issues
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(selectSessionWithLinkedIssues)
      .eq('id', sessionId)
      .single()

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return null
      }
      console.error('[supabase.sessions] failed to get session', sessionId, sessionError)
      throw new Error('Unable to load session from Supabase.')
    }

    // Verify the session belongs to a project owned by this user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', session.project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      // Session exists but user doesn't own the project
      return null
    }

    // Transform the nested issue_sessions to flat linked_issues array
    const issueSessionsData = (session as { issue_sessions?: Array<{ issue: unknown }> }).issue_sessions ?? []
    const linked_issues: SessionLinkedIssue[] = issueSessionsData
      .map((is) => {
        const issue = Array.isArray(is.issue) ? is.issue[0] : is.issue
        return issue as SessionLinkedIssue | null
      })
      .filter((issue): issue is SessionLinkedIssue => issue !== null)

    return {
      ...session,
      linked_issues,
      issue_sessions: undefined,
    } as unknown as SessionWithProject
  } catch (error) {
    console.error('[supabase.sessions] unexpected error getting session', sessionId, error)
    throw error
  }
})

/**
 * Gets recent sessions for a specific project.
 */
export const getProjectSessions = cache(async (projectId: string, limit = 5): Promise<SessionWithProject[]> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    // Verify user owns this project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return []
    }

    const { data, error } = await supabase
      .from('sessions')
      .select(selectSessionWithProject)
      .eq('project_id', projectId)
      .order('last_activity_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[supabase.sessions] failed to get project sessions', projectId, error)
      throw new Error('Unable to load project sessions.')
    }

    return (data ?? []) as SessionWithProject[]
  } catch (error) {
    console.error('[supabase.sessions] unexpected error getting project sessions', projectId, error)
    throw error
  }
})

/**
 * Updates tags for a session. Uses admin client for workflow/API use.
 * Accepts both native SessionTag values and custom label slugs as strings.
 */
export async function updateSessionTags(
  sessionId: string,
  tags: string[],
  autoApplied = false
): Promise<{ success: boolean; error?: string }> {
  if (!isServiceRoleConfigured()) {
    return { success: false, error: 'Service role not configured' }
  }

  try {
    const supabase = createAdminClient()

    const updates: Record<string, unknown> = {
      tags,
      updated_at: new Date().toISOString(),
    }

    if (autoApplied) {
      updates.tags_auto_applied_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)

    if (error) {
      console.error('[supabase.sessions] failed to update session tags', sessionId, error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[supabase.sessions] unexpected error updating session tags', sessionId, error)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Gets integration stats for a project (for widget status indicator).
 * Returns last activity timestamp and whether there's been recent activity.
 */
export interface IntegrationStats {
  lastActivityAt: string | null
  isActive: boolean // Has sessions in last 7 days
}

export const getProjectIntegrationStats = cache(async (projectId: string): Promise<IntegrationStats> => {
  if (!isSupabaseConfigured()) {
    return { lastActivityAt: null, isActive: false }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { lastActivityAt: null, isActive: false }
    }

    // Verify user owns this project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return { lastActivityAt: null, isActive: false }
    }

    // Get most recent session
    const { data: latest } = await supabase
      .from('sessions')
      .select('last_activity_at')
      .eq('project_id', projectId)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .single()

    // Check for activity in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .gte('last_activity_at', sevenDaysAgo.toISOString())

    return {
      lastActivityAt: latest?.last_activity_at ?? null,
      isActive: (count ?? 0) > 0,
    }
  } catch {
    return { lastActivityAt: null, isActive: false }
  }
})

/**
 * Creates a manual session. Requires authenticated user context.
 */
export async function createManualSession(input: CreateSessionInput): Promise<SessionWithProject | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    // Verify user owns the project
    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', input.project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      throw new UnauthorizedError('You do not have permission to create sessions for this project.')
    }

    // Generate a unique session ID
    const sessionId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const messageCount = input.messages?.length ?? 0
    const now = new Date()

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        project_id: input.project_id,
        user_id: input.user_id || null,
        page_url: input.page_url || null,
        page_title: input.page_title || null,
        source: 'manual',
        status: 'active',
        message_count: messageCount,
        tags: input.tags ?? [],
        is_archived: false,
        first_message_at: messageCount > 0 ? now.toISOString() : null,
        last_activity_at: now.toISOString(),
      })
      .select(selectSessionWithProject)
      .single()

    if (error) {
      console.error('[supabase.sessions] failed to create manual session', error)
      throw new Error('Unable to create session.')
    }

    // Store messages in session_messages table if provided
    if (input.messages && input.messages.length > 0) {
      try {
        for (const msg of input.messages) {
          await saveSessionMessage({
            sessionId,
            projectId: input.project_id,
            senderType: msg.role === 'user' ? 'user' : 'ai',
            content: msg.content,
          })
        }
      } catch (msgError) {
        console.error('[supabase.sessions] Failed to store messages:', msgError)
        // Continue even if message storage fails - the session is created
      }
    }

    return data as SessionWithProject
  } catch (error) {
    console.error('[supabase.sessions] unexpected error creating manual session', error)
    throw error
  }
}

/**
 * Updates the archive status of a session. Requires authenticated user context.
 */
export async function updateSessionArchiveStatus(
  sessionId: string,
  isArchived: boolean
): Promise<SessionRecord | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    // Get session and verify ownership
    const { data: session } = await supabase
      .from('sessions')
      .select('project_id')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return null
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', session.project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      throw new UnauthorizedError('You do not have permission to update this session.')
    }

    const { data, error } = await supabase
      .from('sessions')
      .update({
        is_archived: isArchived,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      console.error('[supabase.sessions] failed to update session archive status', sessionId, error)
      throw new Error('Unable to update session.')
    }

    return data as SessionRecord
  } catch (error) {
    console.error('[supabase.sessions] unexpected error updating session archive status', sessionId, error)
    throw error
  }
}
