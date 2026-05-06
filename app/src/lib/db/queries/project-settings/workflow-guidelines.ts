/**
 * Workflow Settings Queries (Drizzle)
 *
 * Manages workflow configuration: guidelines, issue tracking,
 * and deduplication settings used by the Feedback Review and Issue Analysis workflows.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSettings } from '@/lib/db/schema/app'
import type { PmAgentSettings, PmAgentSettingsInput } from './types'
import { DEFAULT_PM_AGENT_SETTINGS } from './types'

const WORKFLOW_COLUMNS = {
  classification_guidelines: true,
  brief_guidelines: true,
  analysis_guidelines: true,
  issue_analysis_enabled: true,
  product_agent_memory_enabled: true,
} as const

function rowToSettings(row: {
  classification_guidelines: string | null
  brief_guidelines: string | null
  analysis_guidelines: string | null
  issue_analysis_enabled: boolean | null
  product_agent_memory_enabled: boolean | null
}): PmAgentSettings {
  return {
    classification_guidelines: row.classification_guidelines ?? null,
    brief_guidelines: row.brief_guidelines ?? null,
    analysis_guidelines: row.analysis_guidelines ?? null,
    issue_analysis_enabled: row.issue_analysis_enabled ?? true,
    product_agent_memory_enabled: row.product_agent_memory_enabled ?? false,
  }
}

/**
 * Gets workflow settings for a project.
 * Returns default values if no settings exist.
 */
export async function getPmAgentSettings(projectId: string): Promise<PmAgentSettings> {
  try {
    const row = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.project_id, projectId),
      columns: WORKFLOW_COLUMNS,
    })

    if (!row) {
      return DEFAULT_PM_AGENT_SETTINGS
    }

    return rowToSettings(row)
  } catch (error) {
    console.error('[project-settings.workflow-guidelines] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets workflow settings with graceful fallback to defaults on error.
 * Used in workflow execution and contexts without user auth.
 */
export async function getPmAgentSettingsAdmin(projectId: string): Promise<PmAgentSettings> {
  try {
    return await getPmAgentSettings(projectId)
  } catch (error) {
    console.error('[project-settings.workflow-guidelines] unexpected error (admin)', projectId, error)
    return DEFAULT_PM_AGENT_SETTINGS
  }
}

/**
 * Updates workflow settings for a project.
 */
export async function updatePmAgentSettings(
  projectId: string,
  settings: PmAgentSettingsInput
): Promise<PmAgentSettings> {
  try {
    // Build update payload with only provided fields
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date(),
    }

    if (settings.classification_guidelines !== undefined) {
      updatePayload.classification_guidelines = settings.classification_guidelines || null
    }
    if (settings.brief_guidelines !== undefined) {
      updatePayload.brief_guidelines = settings.brief_guidelines || null
    }
    if (settings.analysis_guidelines !== undefined) {
      updatePayload.analysis_guidelines = settings.analysis_guidelines || null
    }
    if (settings.issue_analysis_enabled !== undefined) {
      updatePayload.issue_analysis_enabled = settings.issue_analysis_enabled
    }
    if (settings.product_agent_memory_enabled !== undefined) {
      updatePayload.product_agent_memory_enabled = settings.product_agent_memory_enabled
    }

    const [row] = await db
      .insert(projectSettings)
      .values({
        project_id: projectId,
        ...updatePayload,
      })
      .onConflictDoUpdate({
        target: projectSettings.project_id,
        set: updatePayload,
      })
      .returning({
        classification_guidelines: projectSettings.classification_guidelines,
        brief_guidelines: projectSettings.brief_guidelines,
        analysis_guidelines: projectSettings.analysis_guidelines,
        issue_analysis_enabled: projectSettings.issue_analysis_enabled,
        product_agent_memory_enabled: projectSettings.product_agent_memory_enabled,
      })

    if (!row) {
      throw new Error('Unable to update workflow settings.')
    }

    return rowToSettings(row)
  } catch (error) {
    console.error('[project-settings.workflow-guidelines] unexpected error updating', projectId, error)
    throw error
  }
}
