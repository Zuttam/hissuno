import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { linkSessionToIssue, unlinkSessionFromIssue } from '@/lib/db/queries/issues'

export const runtime = 'nodejs'

type RouteParams = { issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/issues/[issueId]/sessions?projectId=...
 * Links a session to an issue.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const sessionId = body.session_id

    if (typeof sessionId !== 'string' || !sessionId) {
      return NextResponse.json({ error: 'session_id (string) is required.' }, { status: 400 })
    }

    await linkSessionToIssue(issueId, sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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
 * DELETE /api/issues/[issueId]/sessions?projectId=...
 * Unlinks a session from an issue.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const sessionId = body.session_id

    if (typeof sessionId !== 'string' || !sessionId) {
      return NextResponse.json({ error: 'session_id (string) is required.' }, { status: 400 })
    }

    await unlinkSessionFromIssue(issueId, sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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
