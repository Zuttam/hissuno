import { UnauthorizedError } from '@/lib/auth/server'
import { createRequestScopedClient, createAdminClient, isSupabaseConfigured } from '../server'
import type { SupportAgentSettings, SupportAgentSettingsInput } from './types'
import { DEFAULT_SUPPORT_AGENT_SETTINGS } from './types'

/**
 * Gets support agent settings for a project. Requires authenticated user context.
 * Returns default values if no settings exist.
 */
export async function getSupportAgentSettings(projectId: string): Promise<SupportAgentSettings> {
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
      .select('support_agent_package_id')
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings exist, return defaults
        return DEFAULT_SUPPORT_AGENT_SETTINGS
      }
      console.error('[project-settings.support-agent] failed to get settings', projectId, error)
      return DEFAULT_SUPPORT_AGENT_SETTINGS
    }

    return {
      support_agent_package_id: data.support_agent_package_id ?? null,
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.support-agent] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets support agent settings for a project using admin client.
 * Used in widget/chat context where there's no user auth.
 */
export async function getSupportAgentSettingsAdmin(projectId: string): Promise<SupportAgentSettings> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('project_settings')
      .select('support_agent_package_id')
      .eq('project_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings exist, return defaults
        return DEFAULT_SUPPORT_AGENT_SETTINGS
      }
      console.error('[project-settings.support-agent] failed to get settings (admin)', projectId, error)
      return DEFAULT_SUPPORT_AGENT_SETTINGS
    }

    return {
      support_agent_package_id: data.support_agent_package_id ?? null,
    }
  } catch (error) {
    console.error('[project-settings.support-agent] unexpected error (admin)', projectId, error)
    return DEFAULT_SUPPORT_AGENT_SETTINGS
  }
}

/**
 * Updates support agent settings for a project. Requires authenticated user context.
 */
export async function updateSupportAgentSettings(
  projectId: string,
  settings: SupportAgentSettingsInput
): Promise<SupportAgentSettings> {
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

    // If setting a package, verify it belongs to this project
    if (settings.support_agent_package_id) {
      const { data: pkg } = await supabase
        .from('named_knowledge_packages')
        .select('id')
        .eq('id', settings.support_agent_package_id)
        .eq('project_id', projectId)
        .single()

      if (!pkg) {
        throw new Error('Invalid package ID. Package not found or does not belong to this project.')
      }
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
      .select('support_agent_package_id')
      .single()

    if (error) {
      console.error('[project-settings.support-agent] failed to update settings', projectId, error)
      throw new Error('Unable to update support agent settings.')
    }

    return {
      support_agent_package_id: data.support_agent_package_id ?? null,
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.support-agent] unexpected error updating', projectId, error)
    throw error
  }
}
