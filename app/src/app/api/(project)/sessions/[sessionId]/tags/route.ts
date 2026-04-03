import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { sessions } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getSessionById, updateSessionTags } from '@/lib/db/queries/sessions'
import { SESSION_TAGS } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { sessionId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * PATCH /api/sessions/[sessionId]/tags?projectId=...
 * Update tags for a session manually.
 * Requires authenticated user who owns the project.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[sessions.tags] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
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

    // Filter tags to only valid native tags
    const validTagSet = new Set<string>(SESSION_TAGS)
    const tags: string[] = body.tags.filter(
      (t: unknown) => typeof t === 'string' && validTagSet.has(t)
    )

    // Update tags
    const result = await updateSessionTags(sessionId, tags)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update tags.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tags,
      modifiedAt: new Date().toISOString(),
    })
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

    console.error('[sessions.tags] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update tags.' }, { status: 500 })
  }
}

/**
 * GET /api/sessions/[sessionId]/tags?projectId=...
 * Get current tags for a session.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[sessions.tags] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Get session with tags
    const [session] = await db
      .select({
        id: sessions.id,
        tags: sessions.tags,
        project_id: sessions.project_id,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Verify the session belongs to this project
    if (session.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    return NextResponse.json({
      tags: session.tags || [],
    })
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

    console.error('[sessions.tags] unexpected error', error)
    return NextResponse.json({ error: 'Failed to get tags.' }, { status: 500 })
  }
}
