import { UnauthorizedError } from '@/lib/auth/server'
import { createRequestScopedClient, isSupabaseConfigured } from '../server'
import type { IssueSettings, IssueSettingsInput } from './types'
import { DEFAULT_ISSUE_SETTINGS } from './types'

/**
 * Gets issue tracking settings for a project. Requires authenticated user context.
 * Returns default values if no settings exist.
 */
export async function getIssueSettings(projectId: string): Promise<IssueSettings> {
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
      throw new UnauthorizedError('You do not have permission to access this project.')
    }

    const { data, error } = await supabase
      .from('project_settings')
      .select('issue_tracking_enabled, pm_dedup_include_closed')
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings exist, return defaults
        return DEFAULT_ISSUE_SETTINGS
      }
      console.error('[project-settings.issues] failed to get settings', projectId, error)
      return DEFAULT_ISSUE_SETTINGS
    }

    return data as IssueSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.issues] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Updates issue tracking settings for a project. Requires authenticated user context.
 */
export async function updateIssueSettings(
  projectId: string,
  settings: IssueSettingsInput
): Promise<IssueSettings> {
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
      .select('issue_tracking_enabled, pm_dedup_include_closed')
      .single()

    if (error) {
      console.error('[project-settings.issues] failed to update settings', projectId, error)
      throw new Error('Unable to update issue settings.')
    }

    return data as IssueSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.issues] unexpected error updating', projectId, error)
    throw error
  }
}
