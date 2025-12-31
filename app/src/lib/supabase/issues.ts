import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, isSupabaseConfigured, isServiceRoleConfigured } from './server'
import type {
  IssueRecord,
  IssueWithProject,
  IssueWithSessions,
  IssueFilters,
  UpdateIssueInput,
  ProjectSettingsRecord,
} from '@/types/issue'

const selectIssueWithProject = '*, project:projects(id, name)'
const selectIssueWithSessions = `
  *,
  project:projects(id, name),
  issue_sessions(
    session:sessions(id, user_id, page_url, message_count, created_at)
  )
`

/**
 * Lists issues with optional filters. Requires authenticated user context.
 * Only returns issues for projects owned by the current user.
 */
export const listIssues = cache(async (filters: IssueFilters = {}): Promise<IssueWithProject[]> => {
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
      return []
    }

    // Build query
    let query = supabase
      .from('issues')
      .select(selectIssueWithProject)
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false })

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
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    if (filters.limit) {
      query = query.limit(filters.limit)
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[supabase.issues] failed to list issues', error)
      throw new Error('Unable to load issues from Supabase.')
    }

    return (data ?? []) as IssueWithProject[]
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
 * Updates an issue. Requires authenticated user context.
 */
export async function updateIssue(issueId: string, input: UpdateIssueInput): Promise<IssueRecord | null> {
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

    // Verify user owns the project this issue belongs to
    const { data: issue } = await supabase
      .from('issues')
      .select('project_id')
      .eq('id', issueId)
      .single()

    if (!issue) {
      return null
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', issue.project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      throw new UnauthorizedError('You do not have permission to update this issue.')
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.title !== undefined) updates.title = input.title
    if (input.description !== undefined) updates.description = input.description
    if (input.type !== undefined) updates.type = input.type
    if (input.status !== undefined) updates.status = input.status
    if (input.priority !== undefined) {
      updates.priority = input.priority
      // If priority is being set manually, mark as override
      if (input.priority_manual_override === undefined) {
        updates.priority_manual_override = true
      }
    }
    if (input.priority_manual_override !== undefined) {
      updates.priority_manual_override = input.priority_manual_override
    }

    const { data, error } = await supabase
      .from('issues')
      .update(updates)
      .eq('id', issueId)
      .select()
      .single()

    if (error) {
      console.error('[supabase.issues] failed to update issue', issueId, error)
      throw new Error('Unable to update issue.')
    }

    return data as IssueRecord
  } catch (error) {
    console.error('[supabase.issues] unexpected error updating issue', issueId, error)
    throw error
  }
}

/**
 * Deletes an issue. Requires authenticated user context.
 */
export async function deleteIssue(issueId: string): Promise<boolean> {
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

    // Verify user owns the project this issue belongs to
    const { data: issue } = await supabase
      .from('issues')
      .select('project_id')
      .eq('id', issueId)
      .single()

    if (!issue) {
      return false
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', issue.project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      throw new UnauthorizedError('You do not have permission to delete this issue.')
    }

    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', issueId)

    if (error) {
      console.error('[supabase.issues] failed to delete issue', issueId, error)
      throw new Error('Unable to delete issue.')
    }

    return true
  } catch (error) {
    console.error('[supabase.issues] unexpected error deleting issue', issueId, error)
    throw error
  }
}

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
 * Gets project settings with user authentication.
 * Returns default values if no settings exist.
 */
export async function getProjectSettingsWithAuth(projectId: string): Promise<ProjectSettingsRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  const defaults: ProjectSettingsRecord = {
    project_id: projectId,
    issue_spec_threshold: 3,
    issue_tracking_enabled: true,
    spec_guidelines: null,
    // Widget defaults
    widget_variant: 'popup',
    widget_theme: 'light',
    widget_position: 'bottom-right',
    widget_title: 'Support',
    widget_initial_message: 'Hi! How can I help you today?',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
      throw new UnauthorizedError('You do not have permission to access this project.')
    }

    const { data, error } = await supabase
      .from('project_settings')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings exist, return defaults
        return defaults
      }
      console.error('[supabase.issues] failed to get project settings with auth', projectId, error)
      return defaults
    }

    return data as ProjectSettingsRecord
  } catch (error) {
    console.error('[supabase.issues] unexpected error getting project settings with auth', projectId, error)
    throw error
  }
}

/**
 * Updates or creates project settings.
 */
export async function upsertProjectSettings(
  projectId: string,
  settings: Partial<Pick<ProjectSettingsRecord,
    | 'issue_spec_threshold'
    | 'issue_tracking_enabled'
    | 'spec_guidelines'
    | 'widget_variant'
    | 'widget_theme'
    | 'widget_position'
    | 'widget_title'
    | 'widget_initial_message'
  >>
): Promise<ProjectSettingsRecord | null> {
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
      throw new UnauthorizedError('You do not have permission to update this project.')
    }

    const { data, error } = await supabase
      .from('project_settings')
      .upsert(
        {
          project_id: projectId,
          ...settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[supabase.issues] failed to upsert project settings', projectId, error)
      throw new Error('Unable to update project settings.')
    }

    return data as ProjectSettingsRecord
  } catch (error) {
    console.error('[supabase.issues] unexpected error upserting project settings', projectId, error)
    throw error
  }
}

/**
 * Gets issues count by status for a project.
 */
export const getProjectIssueStats = cache(async (projectId: string): Promise<{
  total: number
  open: number
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
      inProgress: issues.filter(i => i.status === 'in_progress').length,
      resolved: issues.filter(i => i.status === 'resolved').length,
      closed: issues.filter(i => i.status === 'closed').length,
    }
  } catch (error) {
    console.error('[supabase.issues] unexpected error getting issue stats', projectId, error)
    throw error
  }
})
