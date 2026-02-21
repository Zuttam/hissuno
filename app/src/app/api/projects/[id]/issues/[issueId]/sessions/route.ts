import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, getClientForIdentity, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { linkSessionToIssue, unlinkSessionFromIssue } from '@/lib/supabase/issues'

export const runtime = 'nodejs'

type RouteParams = { id: string; issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/projects/[id]/issues/[issueId]/sessions
 * Links a session to an issue.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    const body = await request.json()
    const sessionId = body.session_id

    if (typeof sessionId !== 'string' || !sessionId) {
      return NextResponse.json({ error: 'session_id (string) is required.' }, { status: 400 })
    }

    await linkSessionToIssue(supabase, issueId, sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[issues.sessions.POST] unexpected error', error)
    return NextResponse.json({ error: 'Unable to link session.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/issues/[issueId]/sessions
 * Unlinks a session from an issue.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    const body = await request.json()
    const sessionId = body.session_id

    if (typeof sessionId !== 'string' || !sessionId) {
      return NextResponse.json({ error: 'session_id (string) is required.' }, { status: 400 })
    }

    await unlinkSessionFromIssue(supabase, issueId, sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[issues.sessions.DELETE] unexpected error', error)
    return NextResponse.json({ error: 'Unable to unlink session.' }, { status: 500 })
  }
}
