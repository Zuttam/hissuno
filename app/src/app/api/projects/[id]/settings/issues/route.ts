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
 * Supports: issue_tracking_enabled, issue_spec_threshold, spec_guidelines
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
