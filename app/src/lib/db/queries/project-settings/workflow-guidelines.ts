/**
 * Workflow Settings Queries (Drizzle)
 *
 * Manages workflow configuration: guidelines, issue tracking,
 * and deduplication settings used by the Feedback Review and Issue Analysis workflows.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSettings } from '@/lib/db/schema/app'
import { UnauthorizedError } from '@/lib/auth/server'
import { resolveRequestContext } from '@/lib/db/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import type { PmAgentSettings, PmAgentSettingsInput } from './types'
import { DEFAULT_PM_AGENT_SETTINGS } from './types'

const WORKFLOW_COLUMNS = {
  classification_guidelines: true,
  brief_guidelines: true,
  analysis_guidelines: true,
  issue_tracking_enabled: true,
  pm_dedup_include_closed: true,
} as const

function rowToSettings(row: {
  classification_guidelines: string | null
  brief_guidelines: string | null
  analysis_guidelines: string | null
  issue_tracking_enabled: boolean | null
  pm_dedup_include_closed: boolean | null
}): PmAgentSettings {
  return {
    classification_guidelines: row.classification_guidelines ?? null,
    brief_guidelines: row.brief_guidelines ?? null,
    analysis_guidelines: row.analysis_guidelines ?? null,
    issue_tracking_enabled: row.issue_tracking_enabled ?? true,
    pm_dedup_include_closed: row.pm_dedup_include_closed ?? false,
  }
}

/**
 * Gets workflow settings for a project. Requires authenticated user context.
 * Returns default values if no settings exist.
 */
export async function getPmAgentSettings(projectId: string): Promise<PmAgentSettings> {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

    const row = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.project_id, projectId),
      columns: WORKFLOW_COLUMNS,
    })

    if (!row) {
      return DEFAULT_PM_AGENT_SETTINGS
    }

    return rowToSettings(row)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.workflow-guidelines] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets workflow settings for a project using admin context.
 * Used in workflow execution where there's no user auth.
 */
export async function getPmAgentSettingsAdmin(projectId: string): Promise<PmAgentSettings> {
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
    console.error('[project-settings.workflow-guidelines] unexpected error (admin)', projectId, error)
    return DEFAULT_PM_AGENT_SETTINGS
  }
}

/**
 * Updates workflow settings for a project. Requires authenticated user context.
 */
export async function updatePmAgentSettings(
  projectId: string,
  settings: PmAgentSettingsInput
): Promise<PmAgentSettings> {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

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
    if (settings.issue_tracking_enabled !== undefined) {
      updatePayload.issue_tracking_enabled = settings.issue_tracking_enabled
    }
    if (settings.pm_dedup_include_closed !== undefined) {
      updatePayload.pm_dedup_include_closed = settings.pm_dedup_include_closed
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
        issue_tracking_enabled: projectSettings.issue_tracking_enabled,
        pm_dedup_include_closed: projectSettings.pm_dedup_include_closed,
      })

    if (!row) {
      throw new Error('Unable to update workflow settings.')
    }

    return rowToSettings(row)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.workflow-guidelines] unexpected error updating', projectId, error)
    throw error
  }
}
