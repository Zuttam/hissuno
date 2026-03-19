/**
 * Widget Settings Queries (Drizzle)
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { widgetIntegrations } from '@/lib/db/schema/app'
import { UnauthorizedError } from '@/lib/auth/server'
import { resolveRequestContext } from '@/lib/db/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import type { WidgetSettings, WidgetSettingsInput } from '@/lib/db/queries/project-settings/types'
import { DEFAULT_WIDGET_SETTINGS } from '@/lib/db/queries/project-settings/types'

/**
 * Gets widget settings for a project. Requires authenticated user context.
 * Returns default values if no settings exist.
 */
export async function getWidgetSettings(projectId: string): Promise<WidgetSettings> {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

    const row = await db.query.widgetIntegrations.findFirst({
      where: eq(widgetIntegrations.project_id, projectId),
      columns: {
        trigger_type: true,
        display_type: true,
        shortcut: true,
        drawer_badge_label: true,
        theme: true,
        title: true,
        initial_message: true,
        allowed_origins: true,
        token_required: true,
      },
    })

    if (!row) {
      return DEFAULT_WIDGET_SETTINGS
    }

    return row as WidgetSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[widget-integration] unexpected error', projectId, error)
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
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

    const [row] = await db
      .insert(widgetIntegrations)
      .values({
        project_id: projectId,
        ...settings,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: widgetIntegrations.project_id,
        set: {
          ...settings,
          updated_at: new Date(),
        },
      })
      .returning({
        trigger_type: widgetIntegrations.trigger_type,
        display_type: widgetIntegrations.display_type,
        shortcut: widgetIntegrations.shortcut,
        drawer_badge_label: widgetIntegrations.drawer_badge_label,
        theme: widgetIntegrations.theme,
        title: widgetIntegrations.title,
        initial_message: widgetIntegrations.initial_message,
        allowed_origins: widgetIntegrations.allowed_origins,
        token_required: widgetIntegrations.token_required,
      })

    if (!row) {
      throw new Error('Unable to update widget settings.')
    }

    return row as WidgetSettings
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[widget-integration] unexpected error updating', projectId, error)
    throw error
  }
}
