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
import { createAdminClient, createRequestScopedClient, isSupabaseConfigured, isServiceRoleConfigured } from './server'
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
  MetricLevel,
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
    const { supabase, apiKeyProjectId } = await createRequestScopedClient()

    if (apiKeyProjectId && !filters.projectId) {
      throw new Error('API key requests must include a projectId filter.')
    }

    // Get projects accessible by this user (RLS handles membership)
    const projectIds = apiKeyProjectId
      ? [apiKeyProjectId]
      : (await supabase.from('projects').select('id')).data?.map(p => p.id) ?? []

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
    if (filters.velocityLevel) {
      const [min, max] = metricLevelToRange(filters.velocityLevel)
      query = query.gte('velocity_score', min).lte('velocity_score', max)
    }
    if (filters.impactLevel) {
      const [min, max] = metricLevelToRange(filters.impactLevel)
      query = query.gte('impact_score', min).lte('impact_score', max)
    }
    if (filters.effortLevel) {
      const [min, max] = metricLevelToRange(filters.effortLevel)
      query = query.gte('effort_score', min).lte('effort_score', max)
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
 * Gets an issue by ID with linked feedback. Requires authenticated user context.
 * Only returns the issue if it belongs to a project owned by the current user.
 */
export const getIssueById = cache(async (issueId: string): Promise<IssueWithSessions | null> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const { supabase } = await createRequestScopedClient()

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

    // Verify the user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', issue.project_id)
      .single()

    if (!project) {
      // Issue exists but user doesn't have access to the project
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
    const { supabase } = await createRequestScopedClient()

    const statuses = ['open', 'ready', 'in_progress', 'resolved', 'closed'] as const
    const results = await Promise.all(
      statuses.map(status =>
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq('status', status)
      )
    )

    const failed = results.find(r => r.error)
    if (failed?.error) {
      console.error('[supabase.issues] failed to get issue stats', projectId, failed.error)
      throw new Error('Unable to load issue stats.')
    }

    const [open, ready, inProgress, resolved, closed] = results.map(r => r.count ?? 0)
    return {
      total: open + ready + inProgress + resolved + closed,
      open,
      ready,
      inProgress,
      resolved,
      closed,
    }
  } catch (error) {
    console.error('[supabase.issues] unexpected error getting issue stats', projectId, error)
    throw error
  }
})

// ============================================================================
// Analysis helpers
// ============================================================================

/**
 * Map metric level to score range: high=4-5, medium=2-3, low=1
 */
function metricLevelToRange(level: MetricLevel): [number, number] {
  switch (level) {
    case 'high': return [4, 5]
    case 'medium': return [2, 3]
    case 'low': return [1, 1]
  }
}

/**
 * Get session timestamps linked to an issue (for velocity computation)
 */
export async function getIssueSessionTimestamps(
  supabase: SupabaseClient,
  issueId: string
): Promise<Date[]> {
  const { data, error } = await supabase
    .from('issue_sessions')
    .select('created_at')
    .eq('issue_id', issueId)

  if (error) {
    console.error('[supabase.issues.getIssueSessionTimestamps] Failed', issueId, error)
    return []
  }

  return (data ?? []).map((row) => new Date(row.created_at))
}

/**
 * Get issue with sessions data for analysis (admin client)
 */
export async function getIssueForAnalysisAdmin(
  issueId: string
): Promise<{
  id: string
  projectId: string
  title: string
  description: string
  type: string
  upvoteCount: number
  impactScore: number | null
  effortEstimate: string | null
  priorityManualOverride: boolean
  sessions: Array<{
    id: string
    createdAt: string
    contactId: string | null
    contact: {
      id: string
      company: {
        id: string
        arr: number | null
        stage: string
      } | null
    } | null
  }>
} | null> {
  if (!isServiceRoleConfigured()) return null

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('issues')
    .select(`
      id, project_id, title, description, type, upvote_count,
      impact_score, effort_estimate, priority_manual_override,
      issue_sessions(
        session:sessions(id, created_at, contact_id, contact:contacts(id, company:companies(id, arr, stage)))
      )
    `)
    .eq('id', issueId)
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('[supabase.issues.getIssueForAnalysisAdmin] Failed', issueId, error)
    }
    return null
  }

  // Transform nested issue_sessions
  const sessions = (data.issue_sessions ?? [])
    .map((is: { session: unknown }) => {
      const session = Array.isArray(is.session) ? is.session[0] : is.session
      return session
    })
    .filter(Boolean)
    .map((s: Record<string, unknown>) => ({
      id: s.id as string,
      createdAt: s.created_at as string,
      contactId: s.contact_id as string | null,
      contact: s.contact as { id: string; company: { id: string; arr: number | null; stage: string } | null } | null,
    }))

  return {
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    description: data.description ?? '',
    type: data.type,
    upvoteCount: data.upvote_count ?? 1,
    impactScore: data.impact_score,
    effortEstimate: data.effort_estimate,
    priorityManualOverride: data.priority_manual_override,
    sessions,
  }
}

/**
 * Update issue analysis columns
 */
export async function updateIssueAnalysis(
  supabase: SupabaseClient,
  issueId: string,
  data: {
    velocityScore?: number | null
    velocityReasoning?: string | null
    impactScore?: number | null
    impactAnalysis?: IssueImpactAnalysis | null
    effortScore?: number | null
    effortEstimate?: EffortEstimate | null
    effortReasoning?: string | null
    affectedFiles?: string[]
    affectedAreas?: string[]
    priority?: IssuePriority
    analysisComputedAt?: string
  }
): Promise<IssueRecord> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (data.velocityScore !== undefined) updates.velocity_score = data.velocityScore
  if (data.velocityReasoning !== undefined) updates.velocity_reasoning = data.velocityReasoning
  if (data.impactScore !== undefined) updates.impact_score = data.impactScore
  if (data.impactAnalysis !== undefined) updates.impact_analysis = data.impactAnalysis
  if (data.effortScore !== undefined) updates.effort_score = data.effortScore
  if (data.effortEstimate !== undefined) updates.effort_estimate = data.effortEstimate
  if (data.effortReasoning !== undefined) updates.effort_reasoning = data.effortReasoning
  if (data.affectedFiles !== undefined) updates.affected_files = data.affectedFiles
  if (data.affectedAreas !== undefined) updates.affected_areas = data.affectedAreas
  if (data.priority !== undefined) updates.priority = data.priority
  if (data.analysisComputedAt !== undefined) updates.analysis_computed_at = data.analysisComputedAt

  const { data: issue, error } = await supabase
    .from('issues')
    .update(updates)
    .eq('id', issueId)
    .select()
    .single()

  if (error || !issue) {
    console.error('[supabase.issues.updateIssueAnalysis] Failed', issueId, error)
    throw new Error(`Failed to update issue analysis: ${error?.message ?? 'Unknown error'}`)
  }

  return issue as IssueRecord
}

// ============================================================================
// Auth helpers for service layer
// ============================================================================

/**
 * Verify user has access to a project. Returns project info if accessible, null otherwise.
 * RLS handles membership-based access control.
 */
export async function verifyProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
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

  let supabase
  try {
    ({ supabase } = await createRequestScopedClient())
  } catch {
    return []
  }

  const { data, error } = await supabase
    .from('issues')
    .select(selectIssueWithProject)
    .eq('project_id', projectId)
    .eq('is_archived', false)
    .not('status', 'in', '("closed")')
    .order('upvote_count', { ascending: false })
    .limit(50)

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
