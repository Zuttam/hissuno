import { NextResponse } from 'next/server'
import { getProjectByPublicKey, validatePublicKey } from '@/lib/projects/keys'
import { getProjectSettings } from '@/lib/supabase/issues'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Default widget settings
const DEFAULT_WIDGET_SETTINGS = {
  variant: 'popup' as const,
  theme: 'light' as const,
  position: 'bottom-right' as const,
  title: 'Support',
  initialMessage: 'Hi! How can I help you today?',
}

/**
 * GET /api/widget-settings?publicKey=pk_live_xxx
 *
 * Public endpoint to fetch widget settings for a project.
 * No authentication required - the public key is sufficient.
 * Used by the widget to auto-fetch default appearance settings.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    console.error('[widget-settings] Supabase must be configured')
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const publicKey = searchParams.get('publicKey')

  if (!publicKey) {
    return NextResponse.json({ error: 'Missing publicKey parameter.' }, { status: 400 })
  }

  if (!validatePublicKey(publicKey)) {
    return NextResponse.json({ error: 'Invalid publicKey format.' }, { status: 400 })
  }

  try {
    // Look up project by public key
    const project = await getProjectByPublicKey(publicKey)

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    // Get project settings
    const settings = await getProjectSettings(project.id)

    // Return widget-specific settings with snake_case to camelCase conversion
    return NextResponse.json({
      variant: settings?.widget_variant ?? DEFAULT_WIDGET_SETTINGS.variant,
      theme: settings?.widget_theme ?? DEFAULT_WIDGET_SETTINGS.theme,
      position: settings?.widget_position ?? DEFAULT_WIDGET_SETTINGS.position,
      title: settings?.widget_title ?? DEFAULT_WIDGET_SETTINGS.title,
      initialMessage: settings?.widget_initial_message ?? DEFAULT_WIDGET_SETTINGS.initialMessage,
    })
  } catch (error) {
    console.error('[widget-settings] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}
