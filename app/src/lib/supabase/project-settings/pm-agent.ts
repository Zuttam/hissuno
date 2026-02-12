import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, isSupabaseConfigured } from '../server'
import type { PmAgentSettings, PmAgentSettingsInput } from './types'
import { DEFAULT_PM_AGENT_SETTINGS } from './types'

const COLUMNS = 'classification_guidelines, spec_guidelines, analysis_guidelines'

/**
 * Gets PM agent settings for a project. Requires authenticated user context.
 * Returns default values if no settings exist.
 */
export async function getPmAgentSettings(projectId: string): Promise<PmAgentSettings> {
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
      .select(COLUMNS)
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return DEFAULT_PM_AGENT_SETTINGS
      }
      console.error('[project-settings.pm-agent] failed to get settings', projectId, error)
      return DEFAULT_PM_AGENT_SETTINGS
    }

    return {
      classification_guidelines: data.classification_guidelines ?? null,
      spec_guidelines: data.spec_guidelines ?? null,
      analysis_guidelines: data.analysis_guidelines ?? null,
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.pm-agent] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets PM agent settings for a project using admin client.
 * Used in workflow context where there's no user auth.
 */
export async function getPmAgentSettingsAdmin(projectId: string): Promise<PmAgentSettings> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('project_settings')
      .select(COLUMNS)
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return DEFAULT_PM_AGENT_SETTINGS
      }
      console.error('[project-settings.pm-agent] failed to get settings (admin)', projectId, error)
      return DEFAULT_PM_AGENT_SETTINGS
    }

    return {
      classification_guidelines: data.classification_guidelines ?? null,
      spec_guidelines: data.spec_guidelines ?? null,
      analysis_guidelines: data.analysis_guidelines ?? null,
    }
  } catch (error) {
    console.error('[project-settings.pm-agent] unexpected error (admin)', projectId, error)
    return DEFAULT_PM_AGENT_SETTINGS
  }
}

/**
 * Updates PM agent settings for a project. Requires authenticated user context.
 */
export async function updatePmAgentSettings(
  projectId: string,
  settings: PmAgentSettingsInput
): Promise<PmAgentSettings> {
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

    // Build update payload with only provided fields
    const updatePayload: Record<string, unknown> = {
      project_id: projectId,
      updated_at: new Date().toISOString(),
    }

    if (settings.classification_guidelines !== undefined) {
      updatePayload.classification_guidelines = settings.classification_guidelines || null
    }
    if (settings.spec_guidelines !== undefined) {
      updatePayload.spec_guidelines = settings.spec_guidelines || null
    }
    if (settings.analysis_guidelines !== undefined) {
      updatePayload.analysis_guidelines = settings.analysis_guidelines || null
    }

    const { data, error } = await supabase
      .from('project_settings')
      .upsert(updatePayload, { onConflict: 'project_id' })
      .select(COLUMNS)
      .single()

    if (error) {
      console.error('[project-settings.pm-agent] failed to update settings', projectId, error)
      throw new Error('Unable to update PM agent settings.')
    }

    return {
      classification_guidelines: data.classification_guidelines ?? null,
      spec_guidelines: data.spec_guidelines ?? null,
      analysis_guidelines: data.analysis_guidelines ?? null,
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.pm-agent] unexpected error updating', projectId, error)
    throw error
  }
}
