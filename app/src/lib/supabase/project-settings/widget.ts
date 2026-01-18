import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '../server'
import type { WidgetSettings, WidgetSettingsInput } from './types'
import { DEFAULT_WIDGET_SETTINGS } from './types'

/**
 * Gets widget settings for a project. Requires authenticated user context.
 * Returns default values if no settings exist.
 */
export async function getWidgetSettings(projectId: string): Promise<WidgetSettings> {
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
      throw new UnauthorizedError('You do not have permission to access this project.')
    }

    const { data, error } = await supabase
      .from('project_settings')
      .select('widget_variant, widget_theme, widget_position, widget_title, widget_initial_message, allowed_origins, widget_token_required')
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings exist, return defaults
        return DEFAULT_WIDGET_SETTINGS
      }
      console.error('[project-settings.widget] failed to get settings', projectId, error)
      return DEFAULT_WIDGET_SETTINGS
    }

    return data as WidgetSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.widget] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Updates widget settings for a project. Requires authenticated user context.
 */
export async function updateWidgetSettings(
  projectId: string,
  settings: WidgetSettingsInput
): Promise<WidgetSettings> {
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
      .select('widget_variant, widget_theme, widget_position, widget_title, widget_initial_message, allowed_origins, widget_token_required')
      .single()

    if (error) {
      console.error('[project-settings.widget] failed to update settings', projectId, error)
      throw new Error('Unable to update widget settings.')
    }

    return data as WidgetSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.widget] unexpected error updating', projectId, error)
    throw error
  }
}
