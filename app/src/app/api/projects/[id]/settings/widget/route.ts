import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getWidgetSettings, updateWidgetSettings } from '@/lib/supabase/project-settings'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const VALID_WIDGET_TRIGGERS = ['bubble', 'drawer-badge', 'headless'] as const
const VALID_WIDGET_DISPLAYS = ['popup', 'sidepanel', 'dialog'] as const
const VALID_WIDGET_VARIANTS = ['popup', 'sidepanel'] as const // Legacy
const VALID_WIDGET_THEMES = ['light', 'dark', 'auto'] as const
const VALID_WIDGET_POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const

/**
 * GET /api/projects/[id]/settings/widget
 *
 * Get widget settings for a project.
 * Returns default values if no settings exist.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[settings.widget.get] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const settings = await getWidgetSettings(id)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[settings.widget.get] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to load widget settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/settings/widget
 *
 * Update widget settings for a project.
 * Supports: widget_variant, widget_theme, widget_position, widget_title,
 * widget_initial_message, allowed_origins, widget_token_required
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[settings.widget.patch] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Validate and extract settings
  const updates: Record<string, unknown> = {}

  // New trigger/display model
  if (typeof payload.widget_trigger_type === 'string') {
    if (!VALID_WIDGET_TRIGGERS.includes(payload.widget_trigger_type)) {
      return NextResponse.json({ error: 'Invalid widget trigger type.' }, { status: 400 })
    }
    updates.widget_trigger_type = payload.widget_trigger_type
  }

  if (typeof payload.widget_display_type === 'string') {
    if (!VALID_WIDGET_DISPLAYS.includes(payload.widget_display_type)) {
      return NextResponse.json({ error: 'Invalid widget display type.' }, { status: 400 })
    }
    updates.widget_display_type = payload.widget_display_type
  }

  if (payload.widget_shortcut !== undefined) {
    if (typeof payload.widget_shortcut === 'string') {
      updates.widget_shortcut = payload.widget_shortcut.trim() || null
    } else if (payload.widget_shortcut === null || payload.widget_shortcut === false) {
      updates.widget_shortcut = null
    }
  }

  if (typeof payload.widget_drawer_badge_label === 'string') {
    const trimmed = payload.widget_drawer_badge_label.trim()
    updates.widget_drawer_badge_label = trimmed || 'Support'
  }

  // Legacy variant support
  if (typeof payload.widget_variant === 'string') {
    if (!VALID_WIDGET_VARIANTS.includes(payload.widget_variant)) {
      return NextResponse.json({ error: 'Invalid widget variant.' }, { status: 400 })
    }
    updates.widget_variant = payload.widget_variant
  }

  if (typeof payload.widget_theme === 'string') {
    if (!VALID_WIDGET_THEMES.includes(payload.widget_theme)) {
      return NextResponse.json({ error: 'Invalid widget theme.' }, { status: 400 })
    }
    updates.widget_theme = payload.widget_theme
  }

  if (typeof payload.widget_position === 'string') {
    if (!VALID_WIDGET_POSITIONS.includes(payload.widget_position)) {
      return NextResponse.json({ error: 'Invalid widget position.' }, { status: 400 })
    }
    updates.widget_position = payload.widget_position
  }

  if (typeof payload.widget_title === 'string') {
    const trimmed = payload.widget_title.trim()
    if (trimmed.length > 0) {
      updates.widget_title = trimmed
    }
  }

  if (typeof payload.widget_initial_message === 'string') {
    const trimmed = payload.widget_initial_message.trim()
    if (trimmed.length > 0) {
      updates.widget_initial_message = trimmed
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

  // Handle widget_token_required boolean
  if (typeof payload.widget_token_required === 'boolean') {
    updates.widget_token_required = payload.widget_token_required
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
  }

  try {
    const settings = await updateWidgetSettings(id, updates)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[settings.widget.patch] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to update widget settings.' }, { status: 500 })
  }
}
