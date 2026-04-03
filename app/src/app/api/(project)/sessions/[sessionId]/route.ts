import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getSessionById, updateSession } from '@/lib/db/queries/sessions'
import { getSessionMessages } from '@/lib/db/queries/session-messages'
import { isDatabaseConfigured } from '@/lib/db/config'
import type { ChatMessage, UpdateSessionInput } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { sessionId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/sessions/[sessionId]?projectId=...
 * Gets session details including messages from Mastra storage.
 * Only accessible if the user owns the project this session belongs to.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[sessions.getById] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Get session metadata
    const session = await getSessionById(sessionId)

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Verify the session belongs to this project
    if (session.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Fetch messages from session_messages table
    const messages: ChatMessage[] = await getSessionMessages(sessionId)

    return NextResponse.json({ session, messages })
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

    console.error('[sessions.getById] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load session.' }, { status: 500 })
  }
}

/**
 * PATCH /api/sessions/[sessionId]?projectId=...
 * Updates session details (name, status, user_id).
 * Only accessible if the user owns the project this session belongs to.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[sessions.update] Database must be configured')
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

    // Validate input
    const input: UpdateSessionInput = {}
    if (body.name !== undefined) input.name = body.name
    if (body.description !== undefined) input.description = body.description
    if (body.status !== undefined) input.status = body.status
    if (body.user_metadata !== undefined) input.user_metadata = body.user_metadata
    if (body.contact_id !== undefined) input.contact_id = body.contact_id
    if (body.is_human_takeover !== undefined) input.is_human_takeover = body.is_human_takeover
    if (body.custom_fields !== undefined) input.custom_fields = body.custom_fields

    // Check if there's anything to update
    if (Object.keys(input).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
    }

    const session = await updateSession(sessionId, input)

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

    console.error('[sessions.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update session.' }, { status: 500 })
  }
}
