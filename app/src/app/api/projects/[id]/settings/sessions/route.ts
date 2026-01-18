import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getSessionSettings, updateSessionSettings } from '@/lib/supabase/project-settings'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/settings/sessions
 *
 * Get session lifecycle settings for a project.
 * Returns default values if no settings exist.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[settings.sessions.get] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const settings = await getSessionSettings(id)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[settings.sessions.get] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to load session settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/settings/sessions
 *
 * Update session lifecycle settings for a project.
 * Supports: session_idle_timeout_minutes, session_goodbye_delay_seconds,
 * session_idle_response_timeout_seconds
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[settings.sessions.patch] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Validate and extract settings
  const updates: Record<string, unknown> = {}

  if (typeof payload.session_idle_timeout_minutes === 'number') {
    if (payload.session_idle_timeout_minutes < 1 || payload.session_idle_timeout_minutes > 60) {
      return NextResponse.json({ error: 'Idle timeout must be between 1 and 60 minutes.' }, { status: 400 })
    }
    updates.session_idle_timeout_minutes = payload.session_idle_timeout_minutes
  }

  if (typeof payload.session_goodbye_delay_seconds === 'number') {
    if (payload.session_goodbye_delay_seconds < 0 || payload.session_goodbye_delay_seconds > 300) {
      return NextResponse.json({ error: 'Goodbye delay must be between 0 and 300 seconds.' }, { status: 400 })
    }
    updates.session_goodbye_delay_seconds = payload.session_goodbye_delay_seconds
  }

  if (typeof payload.session_idle_response_timeout_seconds === 'number') {
    if (payload.session_idle_response_timeout_seconds < 10 || payload.session_idle_response_timeout_seconds > 300) {
      return NextResponse.json({ error: 'Response timeout must be between 10 and 300 seconds.' }, { status: 400 })
    }
    updates.session_idle_response_timeout_seconds = payload.session_idle_response_timeout_seconds
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
  }

  try {
    const settings = await updateSessionSettings(id, updates)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[settings.sessions.patch] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to update session settings.' }, { status: 500 })
  }
}
