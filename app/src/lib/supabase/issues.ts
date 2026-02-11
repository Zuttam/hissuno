/**
 * Issues Database Layer
 *
 * Pure database operations for issues. This layer handles Supabase queries
 * and does NOT handle embeddings or business logic orchestration.
 *
 * For service-level operations (with embeddings), use lib/issues/issues-service.ts
 */

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_.,()]/g, '\\$&')
}
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, isSupabaseConfigured, isServiceRoleConfigured } from './server'
import type {
  IssueRecord,
  IssueWithProject,
  IssueWithSessions,
  IssueFilters,
  UpdateIssueInput,
  ProjectSettingsRecord,
  IssuePriority,
  IssueImpactAnalysis,
  EffortEstimate,
} from '@/types/issue'

const selectIssueWithProject = '*, project:projects(id, name)'
const selectIssueWithSessions = `
  *,
  project:projects(id, name),
  issue_sessions(
    session:sessions(id, user_id, page_url, message_count, created_at, name, source, contact_id, contact:contacts(id, name, email, company:companies(id, name, arr, stage)))
  )
`

// ============================================================================
// Pure DB Operations (accept Supabase client)
// ============================================================================

/**
 * Input for creating an issue at DB level
 */
export interface InsertIssueData {
  projectId: string
  type: 'bug' | 'feature_request' | 'change_request'
  title: string
  description: string
  priority: IssuePriority
  priorityManualOverride?: boolean
  upvoteCount?: number
  status?: 'open' | 'ready' | 'in_progress' | 'resolved' | 'closed'
  // Impact analysis fields
  affectedAreas?: string[]
  impactScore?: number | null
  impactAnalysis?: IssueImpactAnalysis | null
  // Effort estimation fields
  effortEstimate?: EffortEstimate | null
  effortReasoning?: string | null
  affectedFiles?: string[]
}

/**
 * Insert a new issue into the database
 */
export async function insertIssue(
  supabase: SupabaseClient,
  data: InsertIssueData
): Promise<IssueRecord> {
  const { data: issue, error } = await supabase
    .from('issues')
    .insert({
      project_id: data.projectId,
      type: data.type,
      title: data.title,
      description: data.description,
      priority: data.priority,
      priority_manual_override: data.priorityManualOverride ?? false,
      upvote_count: data.upvoteCount ?? 1,
      status: data.status ?? 'open',
      is_archived: false,
      // Impact analysis
      affected_areas: data.affectedAreas ?? [],
      impact_score: data.impactScore ?? null,
      impact_analysis: data.impactAnalysis ?? null,
      // Effort estimation
      effort_estimate: data.effortEstimate ?? null,
      effort_reasoning: data.effortReasoning ?? null,
      affected_files: data.affectedFiles ?? [],
    })
    .select()
    .single()

  if (error || !issue) {
    console.error('[supabase.issues.insertIssue] Failed', error)
    throw new Error(`Failed to insert issue: ${error?.message ?? 'Unknown error'}`)
  }

  return issue as IssueRecord
}

/**
 * Update an existing issue in the database
 */
export async function updateIssueById(
  supabase: SupabaseClient,
  issueId: string,
  data: UpdateIssueInput
): Promise<IssueRecord> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.title !== undefined) updates.title = data.title
  if (data.description !== undefined) updates.description = data.description
  if (data.type !== undefined) updates.type = data.type
  if (data.status !== undefined) updates.status = data.status
  if (data.priority !== undefined) {
    updates.priority = data.priority
    // If priority is being set manually, mark as override unless explicitly set
    if (data.priority_manual_override === undefined) {
      updates.priority_manual_override = true
    }
  }
  if (data.priority_manual_override !== undefined) {
    updates.priority_manual_override = data.priority_manual_override
  }

  const { data: issue, error } = await supabase
    .from('issues')
    .update(updates)
    .eq('id', issueId)
    .select()
    .single()

  if (error || !issue) {
    console.error('[supabase.issues.updateIssueById] Failed', issueId, error)
    throw new Error(`Failed to update issue: ${error?.message ?? 'Unknown error'}`)
  }

  return issue as IssueRecord
}

/**
 * Delete an issue from the database
 */
export async function deleteIssueById(
  supabase: SupabaseClient,
  issueId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('issues')
    .delete()
    .eq('id', issueId)

  if (error) {
    console.error('[supabase.issues.deleteIssueById] Failed', issueId, error)
    throw new Error(`Failed to delete issue: ${error.message}`)
  }

  return true
}

/**
 * Update upvote count and priority for an issue
 */
export async function updateIssueUpvote(
  supabase: SupabaseClient,
  issueId: string,
  newUpvoteCount: number,
  newPriority: IssuePriority
): Promise<IssueRecord> {
  const { data: issue, error } = await supabase
    .from('issues')
    .update({
      upvote_count: newUpvoteCount,
      priority: newPriority,
      updated_at: new Date().toISOString(),
    })
    .eq('id', issueId)
    .select()
    .single()

  if (error || !issue) {
    console.error('[supabase.issues.updateIssueUpvote] Failed', issueId, error)
    throw new Error(`Failed to update issue upvote: ${error?.message ?? 'Unknown error'}`)
  }

  return issue as IssueRecord
}

/**
 * Link a session to an issue
 */
export async function linkSessionToIssue(
  supabase: SupabaseClient,
  issueId: string,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from('issue_sessions')
    .insert({ issue_id: issueId, session_id: sessionId })
    .select()
    .maybeSingle()

  if (error && !error.message.includes('duplicate')) {
    console.error('[supabase.issues.linkSessionToIssue] Failed', { issueId, sessionId }, error)
    // Don't throw - this is non-critical
  }
}

/**
 * Mark a session as PM reviewed
 */
export async function markSessionPMReviewed(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ pm_reviewed_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) {
    console.error('[supabase.issues.markSessionPMReviewed] Failed', sessionId, error)
  }
}

/**
 * Get an issue by ID with minimal fields (for upvote operations)
 */
export async function getIssueForUpvote(
  supabase: SupabaseClient,
  issueId: string
): Promise<{
  id: string
  title: string
  projectId: string
  upvoteCount: number
  priorityManualOverride: boolean
  priority: IssuePriority
  productSpec: string | null
} | null> {
  const { data, error } = await supabase
    .from('issues')
    .select('id, title, project_id, upvote_count, priority_manual_override, priority, product_spec')
    .eq('id', issueId)
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('[supabase.issues.getIssueForUpvote] Failed', issueId, error)
    }
    return null
  }

  return {
    id: data.id,
    title: data.title,
    projectId: data.project_id,
    upvoteCount: data.upvote_count ?? 1,
    priorityManualOverride: data.priority_manual_override,
    priority: data.priority as IssuePriority,
    productSpec: data.product_spec,
  }
}

/**
 * Get issue with current title/description for embedding comparison
 */
export async function getIssueForEmbedding(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ projectId: string; title: string; description: string } | null> {
  const { data, error } = await supabase
    .from('issues')
    .select('project_id, title, description')
    .eq('id', issueId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    projectId: data.project_id,
    title: data.title,
    description: data.description,
  }
}

/**
 * Update issue archive status
 */
export async function updateIssueArchiveStatusById(
  supabase: SupabaseClient,
  issueId: string,
  isArchived: boolean
): Promise<IssueRecord> {
  const { data, error } = await supabase
    .from('issues')
    .update({
      is_archived: isArchived,
      updated_at: new Date().toISOString(),
    })
    .eq('id', issueId)
    .select()
    .single()

  if (error || !data) {
    console.error('[supabase.issues.updateIssueArchiveStatusById] Failed', issueId, error)
    throw new Error(`Failed to update issue archive status: ${error?.message ?? 'Unknown error'}`)
  }

  return data as IssueRecord
}

// ============================================================================
// Query Functions (use user-authenticated client, with caching)
// ============================================================================

/**
 * Lists issues with optional filters. Requires authenticated user context.
 * Only returns issues for projects owned by the current user.
 */
export const listIssues = cache(async (filters: IssueFilters = {}): Promise<{ issues: IssueWithProject[], total: number }> => {
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
      console.error('[supabase.issues] failed to resolve user for listIssues', userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    // Get projects owned by this user
    const { data: userProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id)

    const projectIds = userProjects?.map(p => p.id) ?? []

    if (projectIds.length === 0) {
      return { issues: [], total: 0 }
    }

    // Build query
    let query = supabase
      .from('issues')
      .select(selectIssueWithProject, { count: 'exact' })
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false })

    // Filter archived issues (hidden by default)
    if (!filters.showArchived) {
      query = query.eq('is_archived', false)
    }

    // Apply filters
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }
    if (filters.type) {
      query = query.eq('type', filters.type)
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.search) {
      const s = sanitizeSearchInput(filters.search)
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`)
    }

    // Apply pagination via .range()
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0
    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('[supabase.issues] failed to list issues', error)
      throw new Error('Unable to load issues from Supabase.')
    }

    return { issues: (data ?? []) as IssueWithProject[], total: count ?? 0 }
  } catch (error) {
    console.error('[supabase.issues] unexpected error listing issues', error)
    throw error
  }
})

/**
 * Gets an issue by ID with linked sessions. Requires authenticated user context.
 * Only returns the issue if it belongs to a project owned by the current user.
 */
export const getIssueById = cache(async (issueId: string): Promise<IssueWithSessions | null> => {
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
      console.error('[supabase.issues] failed to resolve user for getIssueById', issueId, userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    // Get issue with project and sessions
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select(selectIssueWithSessions)
      .eq('id', issueId)
      .single()

    if (issueError) {
      if (issueError.code === 'PGRST116') {
        return null
      }
      console.error('[supabase.issues] failed to get issue', issueId, issueError)
      throw new Error('Unable to load issue from Supabase.')
    }

    // Verify the issue belongs to a project owned by this user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', issue.project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      // Issue exists but user doesn't own the project
      return null
    }

    // Transform the nested issue_sessions to flat sessions array
    const sessions = (issue.issue_sessions ?? [])
      .map((is: { session: unknown }) => {
        const session = Array.isArray(is.session) ? is.session[0] : is.session
        return session
      })
      .filter(Boolean)

    return {
      ...issue,
      sessions,
      issue_sessions: undefined,
    } as unknown as IssueWithSessions
  } catch (error) {
    console.error('[supabase.issues] unexpected error getting issue', issueId, error)
    throw error
  }
})

/**
 * Gets issues for a specific project.
 */
export const getProjectIssues = cache(async (projectId: string, limit = 20): Promise<IssueWithProject[]> => {
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
      .from('issues')
      .select(selectIssueWithProject)
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[supabase.issues] failed to get project issues', projectId, error)
      throw new Error('Unable to load project issues.')
    }

    return (data ?? []) as IssueWithProject[]
  } catch (error) {
    console.error('[supabase.issues] unexpected error getting project issues', projectId, error)
    throw error
  }
})

/**
 * Gets project settings. Uses admin client.
 */
export async function getProjectSettings(projectId: string): Promise<ProjectSettingsRecord | null> {
  if (!isServiceRoleConfigured()) {
    return null
  }

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('project_settings')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings exist, return defaults
        return null
      }
      console.error('[supabase.issues] failed to get project settings', projectId, error)
      return null
    }

    return data as ProjectSettingsRecord
  } catch (error) {
    console.error('[supabase.issues] unexpected error getting project settings', projectId, error)
    return null
  }
}

/**
 * Gets issues count by status for a project.
 */
export const getProjectIssueStats = cache(async (projectId: string): Promise<{
  total: number
  open: number
  ready: number
  inProgress: number
  resolved: number
  closed: number
}> => {
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

    const { data, error } = await supabase
      .from('issues')
      .select('status')
      .eq('project_id', projectId)

    if (error) {
      console.error('[supabase.issues] failed to get issue stats', projectId, error)
      throw new Error('Unable to load issue stats.')
    }

    const issues = data ?? []
    return {
      total: issues.length,
      open: issues.filter(i => i.status === 'open').length,
      ready: issues.filter(i => i.status === 'ready').length,
      inProgress: issues.filter(i => i.status === 'in_progress').length,
      resolved: issues.filter(i => i.status === 'resolved').length,
      closed: issues.filter(i => i.status === 'closed').length,
    }
  } catch (error) {
    console.error('[supabase.issues] unexpected error getting issue stats', projectId, error)
    throw error
  }
})

// ============================================================================
// Auth helpers for service layer
// ============================================================================

/**
 * Verify user owns a project. Returns project info if owned, null otherwise.
 */
export async function verifyProjectOwnership(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  return data ?? null
}

/**
 * Get project_id for an issue
 */
export async function getIssueProjectId(
  supabase: SupabaseClient,
  issueId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('issues')
    .select('project_id')
    .eq('id', issueId)
    .single()

  return data?.project_id ?? null
}

/**
 * Gets top ranked issues for a project, sorted by combined score.
 * Score = (upvote_count * 2) + (impact_score ?? 0) + priorityWeight(priority)
 */
export async function getTopRankedIssues(
  projectId: string,
  limit = 5
): Promise<IssueWithProject[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return []
  }

  const { data, error } = await supabase
    .from('issues')
    .select(selectIssueWithProject)
    .eq('project_id', projectId)
    .eq('is_archived', false)
    .not('status', 'in', '("closed")')
    .order('updated_at', { ascending: false })

  if (error || !data) {
    console.error('[supabase.issues.getTopRankedIssues] Failed', projectId, error)
    return []
  }

  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 }

  const scored = (data as IssueWithProject[]).map((issue) => ({
    issue,
    score:
      (issue.upvote_count ?? 0) * 2 +
      (issue.impact_score ?? 0) +
      (priorityWeight[issue.priority] ?? 0),
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((s) => s.issue)
}
