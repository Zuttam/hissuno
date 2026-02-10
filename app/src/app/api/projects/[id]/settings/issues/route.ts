import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getIssueSettings, updateIssueSettings } from '@/lib/supabase/project-settings'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/settings/issues
 *
 * Get issue tracking settings for a project.
 * Returns default values if no settings exist.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[settings.issues.get] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const settings = await getIssueSettings(id)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[settings.issues.get] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to load issue settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/settings/issues
 *
 * Update issue tracking settings for a project.
 * Supports: issue_tracking_enabled
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[settings.issues.patch] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Validate and extract settings
  const updates: Record<string, unknown> = {}

  if (typeof payload.issue_tracking_enabled === 'boolean') {
    updates.issue_tracking_enabled = payload.issue_tracking_enabled
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
  }

  try {
    const settings = await updateIssueSettings(id, updates)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[settings.issues.patch] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to update issue settings.' }, { status: 500 })
  }
}
