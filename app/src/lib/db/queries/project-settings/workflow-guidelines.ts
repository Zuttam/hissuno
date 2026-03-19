/**
 * Workflow Guidelines Settings Queries (Drizzle)
 *
 * Manages classification, analysis, and brief guidelines used by
 * the Feedback Review and Issue Analysis workflows.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSettings } from '@/lib/db/schema/app'
import { UnauthorizedError } from '@/lib/auth/server'
import { resolveRequestContext } from '@/lib/db/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import type { PmAgentSettings, PmAgentSettingsInput } from './types'
import { DEFAULT_PM_AGENT_SETTINGS } from './types'

/**
 * Gets workflow guideline settings for a project. Requires authenticated user context.
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
      columns: {
        classification_guidelines: true,
        brief_guidelines: true,
        analysis_guidelines: true,
      },
    })

    if (!row) {
      return DEFAULT_PM_AGENT_SETTINGS
    }

    return {
      classification_guidelines: row.classification_guidelines ?? null,
      brief_guidelines: row.brief_guidelines ?? null,
      analysis_guidelines: row.analysis_guidelines ?? null,
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.workflow-guidelines] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets workflow guideline settings for a project using admin client.
 * Used in workflow context where there's no user auth.
 */
export async function getPmAgentSettingsAdmin(projectId: string): Promise<PmAgentSettings> {
  try {
    const row = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.project_id, projectId),
      columns: {
        classification_guidelines: true,
        brief_guidelines: true,
        analysis_guidelines: true,
      },
    })

    if (!row) {
      return DEFAULT_PM_AGENT_SETTINGS
    }

    return {
      classification_guidelines: row.classification_guidelines ?? null,
      brief_guidelines: row.brief_guidelines ?? null,
      analysis_guidelines: row.analysis_guidelines ?? null,
    }
  } catch (error) {
    console.error('[project-settings.workflow-guidelines] unexpected error (admin)', projectId, error)
    return DEFAULT_PM_AGENT_SETTINGS
  }
}

/**
 * Updates workflow guideline settings for a project. Requires authenticated user context.
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
      })

    if (!row) {
      throw new Error('Unable to update workflow guideline settings.')
    }

    return {
      classification_guidelines: row.classification_guidelines ?? null,
      brief_guidelines: row.brief_guidelines ?? null,
      analysis_guidelines: row.analysis_guidelines ?? null,
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.workflow-guidelines] unexpected error updating', projectId, error)
    throw error
  }
}
