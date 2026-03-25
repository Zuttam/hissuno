/**
 * Support Agent Settings Queries (Drizzle)
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSettings, knowledgePackages } from '@/lib/db/schema/app'
import type { SupportAgentSettings, SupportAgentSettingsInput } from './types'
import { DEFAULT_SUPPORT_AGENT_SETTINGS } from './types'

/**
 * Gets support agent settings for a project.
 * Returns default values if no settings exist.
 */
export async function getSupportAgentSettings(projectId: string): Promise<SupportAgentSettings> {
  try {
    const row = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.project_id, projectId),
      columns: {
        support_agent_package_id: true,
        support_agent_tone: true,
        brand_guidelines: true,
        session_idle_timeout_minutes: true,
        session_goodbye_delay_seconds: true,
        session_idle_response_timeout_seconds: true,
      },
    })

    if (!row) {
      return DEFAULT_SUPPORT_AGENT_SETTINGS
    }

    return {
      support_agent_package_id: row.support_agent_package_id ?? null,
      support_agent_tone: row.support_agent_tone ?? null,
      brand_guidelines: row.brand_guidelines ?? null,
      session_idle_timeout_minutes: row.session_idle_timeout_minutes ?? DEFAULT_SUPPORT_AGENT_SETTINGS.session_idle_timeout_minutes,
      session_goodbye_delay_seconds: row.session_goodbye_delay_seconds ?? DEFAULT_SUPPORT_AGENT_SETTINGS.session_goodbye_delay_seconds,
      session_idle_response_timeout_seconds: row.session_idle_response_timeout_seconds ?? DEFAULT_SUPPORT_AGENT_SETTINGS.session_idle_response_timeout_seconds,
    }
  } catch (error) {
    console.error('[project-settings.support-agent] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets support agent settings with graceful fallback to defaults on error.
 * Used in widget/chat context and workflows.
 */
export async function getSupportAgentSettingsAdmin(projectId: string): Promise<SupportAgentSettings> {
  try {
    return await getSupportAgentSettings(projectId)
  } catch (error) {
    console.error('[project-settings.support-agent] unexpected error (admin)', projectId, error)
    return DEFAULT_SUPPORT_AGENT_SETTINGS
  }
}

/**
 * Updates support agent settings for a project.
 */
export async function updateSupportAgentSettings(
  projectId: string,
  settings: SupportAgentSettingsInput
): Promise<SupportAgentSettings> {
  try {
    // If setting a package, verify it belongs to this project
    if (settings.support_agent_package_id) {
      const pkg = await db.query.knowledgePackages.findFirst({
        where: eq(knowledgePackages.id, settings.support_agent_package_id),
        columns: { id: true, project_id: true },
      })

      if (!pkg || pkg.project_id !== projectId) {
        throw new Error('Invalid package ID. Package not found or does not belong to this project.')
      }
    }

    const [row] = await db
      .insert(projectSettings)
      .values({
        project_id: projectId,
        ...settings,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: projectSettings.project_id,
        set: {
          ...settings,
          updated_at: new Date(),
        },
      })
      .returning({
        support_agent_package_id: projectSettings.support_agent_package_id,
        support_agent_tone: projectSettings.support_agent_tone,
        brand_guidelines: projectSettings.brand_guidelines,
        session_idle_timeout_minutes: projectSettings.session_idle_timeout_minutes,
        session_goodbye_delay_seconds: projectSettings.session_goodbye_delay_seconds,
        session_idle_response_timeout_seconds: projectSettings.session_idle_response_timeout_seconds,
      })

    if (!row) {
      throw new Error('Unable to update support agent settings.')
    }

    return {
      support_agent_package_id: row.support_agent_package_id ?? null,
      support_agent_tone: row.support_agent_tone ?? null,
      brand_guidelines: row.brand_guidelines ?? null,
      session_idle_timeout_minutes: row.session_idle_timeout_minutes ?? DEFAULT_SUPPORT_AGENT_SETTINGS.session_idle_timeout_minutes,
      session_goodbye_delay_seconds: row.session_goodbye_delay_seconds ?? DEFAULT_SUPPORT_AGENT_SETTINGS.session_goodbye_delay_seconds,
      session_idle_response_timeout_seconds: row.session_idle_response_timeout_seconds ?? DEFAULT_SUPPORT_AGENT_SETTINGS.session_idle_response_timeout_seconds,
    }
  } catch (error) {
    console.error('[project-settings.support-agent] unexpected error updating', projectId, error)
    throw error
  }
}
