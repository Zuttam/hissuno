import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { sessionMessages, sessions } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getSessionById } from '@/lib/db/queries/sessions'
import type { ChatMessage } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { sessionId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/sessions/[sessionId]/messages?projectId=...
 * Sends a human agent message to the session.
 * Requires authenticated user who owns the project.
 *
 * Request body:
 * - content: string - the message content
 *
 * Response:
 * - message: ChatMessage - the created message
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[sessions.messages] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 })
    }

    // Verify the session belongs to this project and exists
    const session = await getSessionById(sessionId)
    if (!session || session.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Check if session is still active (not closed)
    if (session.status === 'closed') {
      return NextResponse.json({ error: 'Cannot send messages to a closed session.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const messageId = crypto.randomUUID()
    const senderUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    // Insert message into session_messages table
    try {
      await db.insert(sessionMessages).values({
        id: messageId,
        session_id: sessionId,
        project_id: projectId,
        sender_type: 'human_agent',
        sender_user_id: senderUserId,
        content: content.trim(),
        created_at: new Date(now),
      })
    } catch (insertError) {
      console.error('[sessions.messages] Failed to insert message:', insertError)
      return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 })
    }

    // Update session last_activity_at
    await db.update(sessions).set({ last_activity_at: new Date(now) }).where(eq(sessions.id, sessionId))

    // Return the message in ChatMessage format
    const senderName = identity.type === 'user' ? (identity.email || 'Hissuno Agent') : 'Hissuno Agent'
    const chatMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: content.trim(),
      createdAt: now,
      senderType: 'human_agent',
      senderName,
    }

    return NextResponse.json({ message: chatMessage })
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

    console.error('[sessions.messages] unexpected error', error)
    return NextResponse.json({ error: 'Unable to send message.' }, { status: 500 })
  }
}
