import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, createRequestScopedClient, isSupabaseConfigured, isServiceRoleConfigured } from './server'
import { saveSessionMessage } from './session-messages'
import { ensureSessionName, generateDefaultName } from '@/lib/sessions/name-generator'
import { sendHumanNeededNotification } from '@/lib/notifications/human-needed-notifications'
import type { SessionRecord, SessionWithProject, SessionFilters, SessionLinkedIssue, SessionTag, SessionSource, SessionType, CreateSessionInput, UpdateSessionInput } from '@/types/session'
import { getDefaultSessionType } from '@/types/session'

function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_.,()]/g, '\\$&')
}

/**
 * Searches session messages by content using PostgreSQL full-text search.
 * Returns matching session IDs ranked by relevance.
 */
async function searchSessionsByContent(
  supabase: Awaited<ReturnType<typeof createRequestScopedClient>>['supabase'],
  projectId: string,
  query: string,
  limit = 50,
  offset = 0
): Promise<{ sessionIds: string[] }> {
  const { data, error } = await supabase.rpc('search_sessions_by_content', {
    p_project_id: projectId,
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('[supabase.sessions] full-text search failed', error)
    return { sessionIds: [] }
  }

  return { sessionIds: (data ?? []).map((r: { session_id: string }) => r.session_id) }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const selectSessionWithProject = '*, project:projects(id, name), contact:contacts(id, name, email, company:companies(id, name, domain, arr, stage)), issue_sessions(count)'
const selectSessionWithLinkedIssues = `
  *,
  project:projects(id, name),
  contact:contacts(id, name, email, company:companies(id, name, domain, arr, stage)),
  issue_sessions(
    issue:issues(id, title, type, status, upvote_count)
  )
`

/**
 * Enrich sessions with user profile data when user_id matches a Hissuno platform user.
 * Looks up user_profiles by user_id for any session whose user_id is a valid UUID.
 */
async function enrichSessionsWithUserProfiles(
  sessions: SessionWithProject[],
  supabaseClient?: Awaited<ReturnType<typeof createClient>>
): Promise<SessionWithProject[]> {
  if (sessions.length === 0) return sessions

  const uuidUserIds = [...new Set(
    sessions
      .map((s) => s.user_id)
      .filter((uid): uid is string => Boolean(uid && UUID_REGEX.test(uid)))
  )]

  if (uuidUserIds.length === 0) return sessions

  try {
    const supabase = supabaseClient ?? await createClient()
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', uuidUserIds)

    if (!profiles || profiles.length === 0) return sessions

    const profileMap = new Map(profiles.map((p) => [p.user_id, { full_name: p.full_name }]))

    return sessions.map((s) => ({
      ...s,
      user_profile: (s.user_id && profileMap.get(s.user_id)) || null,
    }))
  } catch (err) {
    console.warn('[supabase.sessions] Failed to enrich sessions with user profiles:', err)
    return sessions
  }
}

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
  sessionType?: SessionType | null
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
          session_type: params.sessionType || getDefaultSessionType(params.source || 'widget'),
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
 * Also triggers name generation after 3+ messages if no name exists.
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  if (!isServiceRoleConfigured()) {
    return
  }

  try {
    const supabase = createAdminClient()

    // First get current session state
    const { data: session } = await supabase
      .from('sessions')
      .select('message_count, first_message_at, name, project_id')
      .eq('id', sessionId)
      .single()

    const newMessageCount = (session?.message_count ?? 0) + 1
    const updates: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
      message_count: newMessageCount,
    }

    // Set first_message_at if not already set
    if (!session?.first_message_at) {
      updates.first_message_at = new Date().toISOString()
    }

    await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)

    // Trigger name generation after 3+ messages if no name exists (fire-and-forget)
    if (newMessageCount >= 3 && !session?.name && session?.project_id) {
      void ensureSessionName({
        sessionId,
        projectId: session.project_id,
      })
    }
  } catch (error) {
    console.error('[supabase.sessions] error updating session activity', sessionId, error)
  }
}

/**
 * Lists sessions with optional filters. Requires authenticated user context.
 * Only returns sessions for projects owned by the current user.
 */
export const listSessions = cache(async (filters: SessionFilters = {}): Promise<{ sessions: SessionWithProject[], total: number }> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const { supabase, apiKeyProjectId } = await createRequestScopedClient()

    if (apiKeyProjectId && !filters.projectId) {
      throw new Error('API key requests must include a projectId filter.')
    }

    // Build query - join with projects to filter by user access
    let query = supabase
      .from('sessions')
      .select(selectSessionWithProject, { count: 'exact' })
      .order('last_activity_at', { ascending: false })

    // Filter to only projects accessible by this user (RLS handles membership)
    const projectIds = apiKeyProjectId
      ? [apiKeyProjectId]
      : (await supabase.from('projects').select('id')).data?.map(p => p.id) ?? []

    if (projectIds.length === 0) {
      return { sessions: [], total: 0 }
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
      query = query.ilike('user_id', `%${sanitizeSearchInput(filters.userId)}%`)
    }
    if (filters.sessionId) {
      query = query.ilike('id', `%${sanitizeSearchInput(filters.sessionId)}%`)
    }
    if (filters.name) {
      query = query.ilike('name', `%${sanitizeSearchInput(filters.name)}%`)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.source) {
      query = query.eq('source', filters.source)
    }
    if (filters.sessionType) {
      query = query.eq('session_type', filters.sessionType)
    }
    if (filters.isHumanTakeover) {
      query = query.eq('is_human_takeover', true)
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
    if (filters.contactId) {
      query = query.eq('contact_id', filters.contactId)
    }
    if (filters.isAnalyzed) {
      query = query.not('pm_reviewed_at', 'is', null)
    }
    if (filters.companyId) {
      const { data: companyContacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', filters.companyId)
        .eq('project_id', filters.projectId ?? '')
      const contactIds = companyContacts?.map(c => c.id) ?? []
      if (contactIds.length === 0) {
        return { sessions: [], total: 0 }
      }
      query = query.in('contact_id', contactIds)
    }

    // Full-text search against message content
    if (filters.search && filters.search.trim().length >= 2 && filters.projectId) {
      const { sessionIds } = await searchSessionsByContent(supabase, filters.projectId, filters.search.trim())
      if (sessionIds.length === 0) {
        return { sessions: [], total: 0 }
      }
      query = query.in('id', sessionIds)
    }

    // Apply pagination via .range() (handles both limit and offset in one call)
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0
    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('[supabase.sessions] failed to list sessions', error)
      throw new Error('Unable to load sessions from Supabase.')
    }

    const sessions = await enrichSessionsWithUserProfiles((data ?? []) as SessionWithProject[], supabase)
    return { sessions, total: count ?? 0 }
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
    const { supabase } = await createRequestScopedClient()

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

    // Verify the user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', session.project_id)
      .single()

    if (!project) {
      // Session exists but user doesn't have access to the project
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

    const result = {
      ...session,
      linked_issues,
      issue_sessions: undefined,
    } as unknown as SessionWithProject

    const [enriched] = await enrichSessionsWithUserProfiles([result], supabase)
    return enriched
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
    const { supabase } = await createRequestScopedClient()

    // Verify user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
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

    return enrichSessionsWithUserProfiles((data ?? []) as SessionWithProject[], supabase)
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
  hasAnySessions: boolean // Has ever received any sessions
}

export const getProjectIntegrationStats = cache(async (projectId: string): Promise<IntegrationStats> => {
  if (!isSupabaseConfigured()) {
    return { lastActivityAt: null, isActive: false, hasAnySessions: false }
  }

  let supabase, apiKeyProjectId
  try {
    ({ supabase, apiKeyProjectId } = await createRequestScopedClient())
  } catch {
    return { lastActivityAt: null, isActive: false, hasAnySessions: false }
  }

  try {
    // Verify user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return { lastActivityAt: null, isActive: false, hasAnySessions: false }
    }

    // Get most recent widget session (only widget-originated sessions count)
    const { data: latest } = await supabase
      .from('sessions')
      .select('last_activity_at')
      .eq('project_id', projectId)
      .eq('source', 'widget')
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .single()

    // Check for widget activity in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('source', 'widget')
      .gte('last_activity_at', sevenDaysAgo.toISOString())

    return {
      lastActivityAt: latest?.last_activity_at ?? null,
      isActive: (count ?? 0) > 0,
      hasAnySessions: latest !== null,
    }
  } catch {
    return { lastActivityAt: null, isActive: false, hasAnySessions: false }
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
    const { supabase } = await createRequestScopedClient()

    // Verify user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', input.project_id)
      .single()

    if (!project) {
      throw new UnauthorizedError('You do not have permission to create sessions for this project.')
    }

    // Generate a unique session ID
    const sessionId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const messageCount = input.messages?.length ?? 0
    const now = new Date()

    // Use provided name or generate a default one
    const sessionName =
      input.name ||
      generateDefaultName({
        userId: input.user_id || null,
        source: 'manual',
        createdAt: now.toISOString(),
      })

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        project_id: input.project_id,
        user_id: input.user_id || null,
        user_metadata: input.user_metadata || {},
        page_url: input.page_url || null,
        page_title: input.page_title || null,
        name: sessionName,
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
    const { supabase } = await createRequestScopedClient()

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

/**
 * Updates a session. Requires authenticated user context.
 */
export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput
): Promise<SessionRecord | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const { supabase } = await createRequestScopedClient()

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
      .single()

    if (!project) {
      throw new UnauthorizedError('You do not have permission to update this session.')
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.name !== undefined) updates.name = input.name
    if (input.status !== undefined) updates.status = input.status
    if (input.user_id !== undefined) updates.user_id = input.user_id
    if (input.user_metadata !== undefined) updates.user_metadata = input.user_metadata
    if (input.contact_id !== undefined) updates.contact_id = input.contact_id
    if (input.is_human_takeover !== undefined) {
      updates.is_human_takeover = input.is_human_takeover
      updates.human_takeover_at = input.is_human_takeover ? new Date().toISOString() : null
    }

    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      console.error('[supabase.sessions] failed to update session', sessionId, error)
      throw new Error('Unable to update session.')
    }

    return data as SessionRecord
  } catch (error) {
    console.error('[supabase.sessions] unexpected error updating session', sessionId, error)
    throw error
  }
}

/**
 * Sets the human takeover flag on a session. Uses admin client for agent/integration use.
 * When enabling takeover, sends a notification to the project owner.
 */
export async function setSessionHumanTakeover(
  sessionId: string,
  enabled: boolean
): Promise<void> {
  if (!isServiceRoleConfigured()) {
    console.warn('[supabase.sessions] Service role not configured, skipping human takeover update')
    return
  }

  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('sessions')
      .update({
        is_human_takeover: enabled,
        human_takeover_at: enabled ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      console.error('[supabase.sessions] failed to set human takeover', sessionId, error)
      return
    }

    // Send notification when enabling human takeover (fire-and-forget)
    if (enabled) {
      const { data: session } = await supabase
        .from('sessions')
        .select('project_id, name')
        .eq('id', sessionId)
        .single()

      if (session) {
        void sendHumanNeededNotification({
          sessionId,
          projectId: session.project_id,
          sessionName: session.name,
        }).catch((err) => {
          console.error('[supabase.sessions] failed to send human needed notification', err)
        })
      }
    }
  } catch (error) {
    console.error('[supabase.sessions] unexpected error setting human takeover', sessionId, error)
  }
}

/**
 * Checks if a session is in human takeover mode. Uses admin client for widget route use.
 */
/**
 * Gets closed sessions that haven't been PM reviewed yet (pending reviews).
 * Returns limited results plus total count for the badge.
 */
export async function getPendingPMReviews(
  projectId: string,
  limit = 8
): Promise<{ sessions: { id: string; name: string | null; user_id: string | null; user_metadata: Record<string, string> | null; source: SessionSource; message_count: number; created_at: string }[]; count: number }> {
  if (!isSupabaseConfigured()) {
    return { sessions: [], count: 0 }
  }

  let supabase
  try {
    ({ supabase } = await createRequestScopedClient())
  } catch {
    return { sessions: [], count: 0 }
  }

  try {
    const { data, count, error } = await supabase
      .from('sessions')
      .select('id, name, user_id, user_metadata, source, message_count, created_at', { count: 'exact' })
      .eq('project_id', projectId)
      .is('pm_reviewed_at', null)
      .eq('status', 'closed')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[supabase.sessions.getPendingPMReviews] Failed', projectId, error)
      return { sessions: [], count: 0 }
    }

    return {
      sessions: (data ?? []) as { id: string; name: string | null; user_id: string | null; user_metadata: Record<string, string> | null; source: SessionSource; message_count: number; created_at: string }[],
      count: count ?? 0,
    }
  } catch (error) {
    console.error('[supabase.sessions.getPendingPMReviews] Unexpected error', projectId, error)
    return { sessions: [], count: 0 }
  }
}

export async function isSessionInHumanTakeover(sessionId: string): Promise<boolean> {
  if (!isServiceRoleConfigured()) {
    return false
  }

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('sessions')
      .select('is_human_takeover')
      .eq('id', sessionId)
      .single()

    if (error || !data) {
      return false
    }

    return data.is_human_takeover === true
  } catch {
    return false
  }
}
