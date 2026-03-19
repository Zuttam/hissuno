import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getWidgetSettings, updateWidgetSettings } from '@/lib/db/queries/widget-integration'
import { isDatabaseConfigured } from '@/lib/db/config'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

const VALID_WIDGET_TRIGGERS = ['bubble', 'drawer-badge', 'headless'] as const
const VALID_WIDGET_DISPLAYS = ['popup', 'sidepanel', 'dialog'] as const
const VALID_WIDGET_THEMES = ['light', 'dark', 'auto'] as const
const VALID_WIDGET_POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const

/**
 * GET /api/integrations/widget/settings?projectId=...
 *
 * Get widget settings for a project.
 * Returns default values if no settings exist.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.widget.settings.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const settings = await getWidgetSettings(projectId)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[integrations.widget.settings.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load widget settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/integrations/widget/settings?projectId=...
 *
 * Update widget settings for a project.
 * Accepts both prefixed (widget_*) and unprefixed field names for backwards compatibility.
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.widget.settings.patch] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const payload = await request.json().catch(() => null)

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    // Validate and extract settings
    const updates: Record<string, unknown> = {}

    // Trigger type (accept both widget_trigger_type and trigger_type)
    const triggerType = payload.widget_trigger_type ?? payload.trigger_type
    if (typeof triggerType === 'string') {
      if (!VALID_WIDGET_TRIGGERS.includes(triggerType as typeof VALID_WIDGET_TRIGGERS[number])) {
        return NextResponse.json({ error: 'Invalid widget trigger type.' }, { status: 400 })
      }
      updates.trigger_type = triggerType
    }

    // Display type
    const displayType = payload.widget_display_type ?? payload.display_type
    if (typeof displayType === 'string') {
      if (!VALID_WIDGET_DISPLAYS.includes(displayType as typeof VALID_WIDGET_DISPLAYS[number])) {
        return NextResponse.json({ error: 'Invalid widget display type.' }, { status: 400 })
      }
      updates.display_type = displayType
    }

    // Shortcut
    const shortcutVal = payload.widget_shortcut ?? payload.shortcut
    if (shortcutVal !== undefined) {
      if (typeof shortcutVal === 'string') {
        updates.shortcut = shortcutVal.trim() || null
      } else if (shortcutVal === null || shortcutVal === false) {
        updates.shortcut = null
      }
    }

    // Drawer badge label
    const drawerLabel = payload.widget_drawer_badge_label ?? payload.drawer_badge_label
    if (typeof drawerLabel === 'string') {
      const trimmed = drawerLabel.trim()
      updates.drawer_badge_label = trimmed || 'Support'
    }

    // Theme
    const themeVal = payload.widget_theme ?? payload.theme
    if (typeof themeVal === 'string') {
      if (!VALID_WIDGET_THEMES.includes(themeVal as typeof VALID_WIDGET_THEMES[number])) {
        return NextResponse.json({ error: 'Invalid widget theme.' }, { status: 400 })
      }
      updates.theme = themeVal
    }

    // Position
    const positionVal = payload.widget_position ?? payload.position
    if (typeof positionVal === 'string') {
      if (!VALID_WIDGET_POSITIONS.includes(positionVal as typeof VALID_WIDGET_POSITIONS[number])) {
        return NextResponse.json({ error: 'Invalid widget position.' }, { status: 400 })
      }
      updates.position = positionVal
    }

    // Title
    const titleVal = payload.widget_title ?? payload.title
    if (typeof titleVal === 'string') {
      const trimmed = titleVal.trim()
      if (trimmed.length > 0) {
        updates.title = trimmed
      }
    }

    // Initial message
    const msgVal = payload.widget_initial_message ?? payload.initial_message
    if (typeof msgVal === 'string') {
      const trimmed = msgVal.trim()
      if (trimmed.length > 0) {
        updates.initial_message = trimmed
      }
    }

    // Handle allowed_origins array
    if (Array.isArray(payload.allowed_origins)) {
      const origins = payload.allowed_origins
        .filter((origin: unknown) => typeof origin === 'string' && origin.trim().length > 0)
        .map((origin: string) => origin.trim())
      updates.allowed_origins = origins.length > 0 ? origins : []
    } else if (payload.allowed_origins === null) {
      updates.allowed_origins = []
    }

    // Handle token_required boolean (accept both widget_token_required and token_required)
    const tokenReq = payload.widget_token_required ?? payload.token_required
    if (typeof tokenReq === 'boolean') {
      updates.token_required = tokenReq
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
    }

    const settings = await updateWidgetSettings(projectId, updates)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[integrations.widget.settings.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update widget settings.' }, { status: 500 })
  }
}
