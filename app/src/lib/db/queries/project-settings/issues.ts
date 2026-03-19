/**
 * Issue Tracking Settings Queries (Drizzle)
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSettings } from '@/lib/db/schema/app'
import { UnauthorizedError } from '@/lib/auth/server'
import { resolveRequestContext } from '@/lib/db/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import type { IssueSettings, IssueSettingsInput } from './types'
import { DEFAULT_ISSUE_SETTINGS } from './types'

/**
 * Gets issue tracking settings for a project. Requires authenticated user context.
 * Returns default values if no settings exist.
 */
export async function getIssueSettings(projectId: string): Promise<IssueSettings> {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

    const row = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.project_id, projectId),
      columns: {
        issue_tracking_enabled: true,
        pm_dedup_include_closed: true,
      },
    })

    if (!row) {
      return DEFAULT_ISSUE_SETTINGS
    }

    return row as IssueSettings
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
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
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
        issue_tracking_enabled: projectSettings.issue_tracking_enabled,
        pm_dedup_include_closed: projectSettings.pm_dedup_include_closed,
      })

    if (!row) {
      throw new Error('Unable to update issue settings.')
    }

    return row as IssueSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.issues] unexpected error updating', projectId, error)
    throw error
  }
}
