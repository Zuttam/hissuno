import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getSessionSettings, updateSessionSettings } from '@/lib/supabase/project-settings'
import { syncCustomTags, type SyncTagInput } from '@/lib/supabase/custom-tags'
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
 * session_idle_response_timeout_seconds, custom_tags
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

  // Handle custom tags sync
  let tagsSyncResult = null
  if (Array.isArray(payload.custom_tags)) {
    // Validate tag structure
    const validationError = validateCustomTags(payload.custom_tags)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    try {
      tagsSyncResult = await syncCustomTags(id, payload.custom_tags as SyncTagInput[])
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
      }
      const message = error instanceof Error ? error.message : 'Failed to sync custom tags.'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  // Only require updates if no custom_tags were provided
  if (Object.keys(updates).length === 0 && !tagsSyncResult) {
    return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
  }

  try {
    // Update session settings if there are any
    let settings = null
    if (Object.keys(updates).length > 0) {
      settings = await updateSessionSettings(id, updates)
    }

    return NextResponse.json({
      settings,
      customTags: tagsSyncResult,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[settings.sessions.patch] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to update session settings.' }, { status: 500 })
  }
}

/**
 * Validate custom tags array structure
 */
function validateCustomTags(tags: unknown[]): string | null {
  if (tags.length > 10) {
    return 'Maximum of 10 custom tags per project.'
  }

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]
    if (!tag || typeof tag !== 'object') {
      return `Invalid tag at index ${i}.`
    }

    const t = tag as Record<string, unknown>

    if (typeof t.id !== 'string' || !t.id.trim()) {
      return `Tag at index ${i} must have an id.`
    }

    if (typeof t.name !== 'string' || !t.name.trim()) {
      return `Tag at index ${i} must have a name.`
    }

    if (t.name.length > 50) {
      return `Tag name at index ${i} must be 50 characters or less.`
    }

    if (typeof t.slug !== 'string' || !t.slug.trim()) {
      return `Tag at index ${i} must have a slug.`
    }

    if (!/^[a-z][a-z0-9_]*$/.test(t.slug)) {
      return `Tag slug at index ${i} must start with a letter and contain only lowercase letters, numbers, and underscores.`
    }

    if (typeof t.description !== 'string' || !t.description.trim()) {
      return `Tag at index ${i} must have a description.`
    }

    if (t.description.length > 500) {
      return `Tag description at index ${i} must be 500 characters or less.`
    }

    if (typeof t.color !== 'string') {
      return `Tag at index ${i} must have a color.`
    }

    const validColors = ['info', 'success', 'warning', 'danger', 'default']
    if (!validColors.includes(t.color)) {
      return `Tag color at index ${i} must be one of: ${validColors.join(', ')}.`
    }

    if (typeof t.position !== 'number' || t.position < 0) {
      return `Tag at index ${i} must have a valid position.`
    }
  }

  // Check for duplicate slugs
  const slugs = tags.map((t) => (t as Record<string, unknown>).slug as string)
  const uniqueSlugs = new Set(slugs)
  if (slugs.length !== uniqueSlugs.size) {
    return 'Duplicate tag slugs are not allowed.'
  }

  return null
}
