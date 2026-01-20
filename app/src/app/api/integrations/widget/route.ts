import { NextRequest, NextResponse } from 'next/server'
import { getProjectById } from '@/lib/projects/keys'
import { getProjectSettings } from '@/lib/supabase/issues'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { isOriginAllowed } from '@/lib/utils/widget-auth'

export const runtime = 'nodejs'

// Default widget settings
const DEFAULT_WIDGET_SETTINGS = {
  trigger: 'bubble' as const,
  display: 'sidepanel' as const,
  shortcut: 'mod+k',
  drawerBadgeLabel: 'Support',
  // Legacy field for backwards compatibility
  variant: 'sidepanel' as const,
  theme: 'light' as const,
  position: 'bottom-right' as const,
  title: 'Support',
  initialMessage: 'Hi! How can I help you today?',
}

/**
 * Get the request origin from headers
 * Uses Origin header if present, otherwise falls back to request URL origin
 */
function getRequestOrigin(request: NextRequest): string {
  return request.headers.get('Origin') || request.nextUrl.origin
}

/**
 * GET /api/integrations/widget?projectId=xxx
 *
 * Public endpoint to fetch widget settings for a project.
 * Validates origin against project's allowed_origins list.
 * Used by the widget to auto-fetch default appearance settings.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations/widget] Supabase must be configured')
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  const projectId = request.nextUrl.searchParams.get('projectId')
  const origin = getRequestOrigin(request)

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId parameter.' }, { status: 400 })
  }

  try {
    // Look up project by ID
    const project = await getProjectById(projectId)

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    // Check if origin is allowed
    if (!isOriginAllowed(origin, project.allowed_origins)) {
      console.warn(`[integrations/widget] Origin not allowed: ${origin} for project ${projectId}`)
      return NextResponse.json(
        { error: 'Origin not allowed.', blocked: true },
        { status: 403 }
      )
    }

    // Get project settings
    const settings = await getProjectSettings(project.id)

    // Build response with CORS headers
    const response = NextResponse.json({
      // New trigger/display model
      trigger: settings?.widget_trigger_type ?? DEFAULT_WIDGET_SETTINGS.trigger,
      display: settings?.widget_display_type ?? DEFAULT_WIDGET_SETTINGS.display,
      shortcut: settings?.widget_shortcut ?? DEFAULT_WIDGET_SETTINGS.shortcut,
      drawerBadgeLabel: settings?.widget_drawer_badge_label ?? DEFAULT_WIDGET_SETTINGS.drawerBadgeLabel,
      // Legacy field for backwards compatibility
      variant: settings?.widget_variant ?? DEFAULT_WIDGET_SETTINGS.variant,
      // Shared settings
      theme: settings?.widget_theme ?? DEFAULT_WIDGET_SETTINGS.theme,
      position: settings?.widget_position ?? DEFAULT_WIDGET_SETTINGS.position,
      title: settings?.widget_title ?? DEFAULT_WIDGET_SETTINGS.title,
      initialMessage: settings?.widget_initial_message ?? DEFAULT_WIDGET_SETTINGS.initialMessage,
      // Include whether JWT is required so widget can warn if missing
      tokenRequired: settings?.widget_token_required ?? false,
    })

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', origin)

    return response
  } catch (error) {
    console.error('[integrations/widget] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = getRequestOrigin(request)

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
