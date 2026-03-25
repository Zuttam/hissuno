import { NextRequest, NextResponse } from 'next/server'
import { getProjectById } from '@/lib/projects/keys'
import { getProjectSettings } from '@/lib/db/queries/issues'
import { isDatabaseConfigured } from '@/lib/db/config'
import { isOriginAllowed } from '@/lib/utils/widget-auth'
import { getWidgetRequestOrigin, addWidgetCorsHeaders, createWidgetOptionsResponse } from '@/lib/utils/widget-cors'

export const runtime = 'nodejs'

// Default widget settings
const DEFAULT_WIDGET_SETTINGS = {
  trigger: 'bubble' as const,
  display: 'sidepanel' as const,
  shortcut: 'mod+k',
  drawerBadgeLabel: 'Support',
}

/**
 * GET /api/integrations/widget?projectId=xxx
 *
 * Public endpoint to fetch widget settings for a project.
 * Validates origin against project's allowed_origins list.
 * Used by the widget to auto-fetch default appearance settings.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations/widget] Database must be configured')
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  const projectId = request.nextUrl.searchParams.get('projectId')
  const origin = getWidgetRequestOrigin(request)

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
      trigger: settings?.widget_trigger_type ?? DEFAULT_WIDGET_SETTINGS.trigger,
      display: settings?.widget_display_type ?? DEFAULT_WIDGET_SETTINGS.display,
      shortcut: settings?.widget_shortcut ?? DEFAULT_WIDGET_SETTINGS.shortcut,
      drawerBadgeLabel: settings?.widget_drawer_badge_label ?? DEFAULT_WIDGET_SETTINGS.drawerBadgeLabel,
      // Include whether JWT is required so widget can warn if missing
      tokenRequired: settings?.widget_token_required ?? false,
    })

    return addWidgetCorsHeaders(response, origin)
  } catch (error) {
    console.error('[integrations/widget] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return createWidgetOptionsResponse(request)
}
