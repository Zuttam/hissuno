import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getSessionById, updateSessionTags } from '@/lib/supabase/sessions'
import { getProjectCustomTags } from '@/lib/supabase/custom-tags'
import { SESSION_TAGS } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { id: string; sessionId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * PATCH /api/projects/[id]/sessions/[sessionId]/tags
 * Update tags for a session manually.
 * Requires authenticated user who owns the project.
 * Supports both native tags and project-specific custom tags.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, sessionId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[sessions.tags] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()

    // Validate tags is an array
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: 'Tags must be an array.' }, { status: 400 })
    }

    // Verify the session belongs to this project
    const existingSession = await getSessionById(sessionId)
    if (!existingSession || existingSession.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Build valid tag set: native tags + project's custom tags
    const validTagSet = new Set<string>(SESSION_TAGS)
    const customTags = await getProjectCustomTags(projectId)
    for (const tag of customTags) {
      validTagSet.add(tag.slug)
    }

    // Filter tags to only valid ones
    const tags: string[] = body.tags.filter(
      (t: unknown) => typeof t === 'string' && validTagSet.has(t)
    )

    // Update tags
    const result = await updateSessionTags(sessionId, tags, false)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update tags.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tags,
      modifiedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[sessions.tags] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update tags.' }, { status: 500 })
  }
}

/**
 * GET /api/projects/[id]/sessions/[sessionId]/tags
 * Get current tags for a session.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: projectId, sessionId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[sessions.tags] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Get session with tags
    const supabase = await createClient()
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, tags, tags_auto_applied_at, project_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Verify the session belongs to this project
    if (session.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    return NextResponse.json({
      tags: session.tags || [],
      autoAppliedAt: session.tags_auto_applied_at,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[sessions.tags] unexpected error', error)
    return NextResponse.json({ error: 'Failed to get tags.' }, { status: 500 })
  }
}
