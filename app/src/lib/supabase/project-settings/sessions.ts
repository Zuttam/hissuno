import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '../server'
import type { SessionSettings, SessionSettingsInput } from './types'
import { DEFAULT_SESSION_SETTINGS } from './types'

/**
 * Gets session lifecycle settings for a project. Requires authenticated user context.
 * Returns default values if no settings exist.
 */
export async function getSessionSettings(projectId: string): Promise<SessionSettings> {
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
      .select('session_idle_timeout_minutes, session_goodbye_delay_seconds, session_idle_response_timeout_seconds')
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings exist, return defaults
        return DEFAULT_SESSION_SETTINGS
      }
      console.error('[project-settings.sessions] failed to get settings', projectId, error)
      return DEFAULT_SESSION_SETTINGS
    }

    return data as SessionSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.sessions] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Updates session lifecycle settings for a project. Requires authenticated user context.
 */
export async function updateSessionSettings(
  projectId: string,
  settings: SessionSettingsInput
): Promise<SessionSettings> {
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
      .select('session_idle_timeout_minutes, session_goodbye_delay_seconds, session_idle_response_timeout_seconds')
      .single()

    if (error) {
      console.error('[project-settings.sessions] failed to update settings', projectId, error)
      throw new Error('Unable to update session settings.')
    }

    return data as SessionSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.sessions] unexpected error updating', projectId, error)
    throw error
  }
}
