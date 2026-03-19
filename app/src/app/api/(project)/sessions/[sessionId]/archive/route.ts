import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getSessionById, updateSessionArchiveStatus } from '@/lib/db/queries/sessions'
import { isDatabaseConfigured } from '@/lib/db/config'

export const runtime = 'nodejs'

type RouteParams = { sessionId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * PATCH /api/sessions/[sessionId]/archive?projectId=...
 * Toggles the archive status of a session.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[sessions.archive] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // First verify the session belongs to this project
    const existingSession = await getSessionById(sessionId)
    if (!existingSession || existingSession.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    const body = await request.json()
    const isArchived = body.is_archived

    if (typeof isArchived !== 'boolean') {
      return NextResponse.json({ error: 'is_archived (boolean) is required.' }, { status: 400 })
    }

    const session = await updateSessionArchiveStatus(sessionId, isArchived)

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    return NextResponse.json({ session })
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

    console.error('[sessions.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update session.' }, { status: 500 })
  }
}
