import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getProjectSettingsWithAuth, upsertProjectSettings } from '@/lib/supabase/issues'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/settings
 * 
 * Get project settings (issue tracking config).
 * Returns default values if no settings exist.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[projects.settings.get] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const settings = await getProjectSettingsWithAuth(id)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.settings.get] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

const VALID_WIDGET_VARIANTS: string[] = ['popup', 'sidepanel']
const VALID_WIDGET_THEMES: string[] = ['light', 'dark', 'auto']
const VALID_WIDGET_POSITIONS: string[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left']

/**
 * PATCH /api/projects/[id]/settings
 *
 * Update project settings.
 * Supports: issue_tracking_enabled, issue_spec_threshold, spec_guidelines,
 * widget_variant, widget_theme, widget_position, widget_title, widget_initial_message
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[projects.settings.patch] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Validate and extract settings
  const updates: {
    issue_tracking_enabled?: boolean
    issue_spec_threshold?: number
    spec_guidelines?: string | null
    widget_variant?: 'popup' | 'sidepanel'
    widget_theme?: 'light' | 'dark' | 'auto'
    widget_position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    widget_title?: string
    widget_initial_message?: string
  } = {}

  if (typeof payload.issue_tracking_enabled === 'boolean') {
    updates.issue_tracking_enabled = payload.issue_tracking_enabled
  }

  if (typeof payload.issue_spec_threshold === 'number') {
    if (payload.issue_spec_threshold < 1 || payload.issue_spec_threshold > 100) {
      return NextResponse.json({ error: 'Threshold must be between 1 and 100.' }, { status: 400 })
    }
    updates.issue_spec_threshold = payload.issue_spec_threshold
  }

  if (typeof payload.spec_guidelines === 'string') {
    const trimmed = payload.spec_guidelines.trim()
    updates.spec_guidelines = trimmed.length > 0 ? trimmed : null
  } else if (payload.spec_guidelines === null) {
    updates.spec_guidelines = null
  }

  // Widget settings validation
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

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
  }

  try {
    const settings = await upsertProjectSettings(id, updates)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.settings.patch] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })
  }
}
