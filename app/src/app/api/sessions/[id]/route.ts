import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getSessionById, updateSession } from '@/lib/supabase/sessions'
import { getSessionMessages } from '@/lib/supabase/session-messages'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { ChatMessage, UpdateSessionInput } from '@/types/session'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/sessions/[id]
 * Gets session details including messages from Mastra storage.
 * Only accessible if the user owns the project this session belongs to.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.getById] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params

    // Get session metadata from Supabase
    const session = await getSessionById(sessionId)

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Fetch messages from session_messages table
    const messages: ChatMessage[] = await getSessionMessages(sessionId)

    return NextResponse.json({ session, messages })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.getById] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load session.' }, { status: 500 })
  }
}

/**
 * PATCH /api/sessions/[id]
 * Updates session details (name, status, user_id).
 * Only accessible if the user owns the project this session belongs to.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.update] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params
    const body = await request.json()

    // Validate input
    const input: UpdateSessionInput = {}
    if (body.name !== undefined) input.name = body.name
    if (body.status !== undefined) input.status = body.status
    if (body.user_id !== undefined) input.user_id = body.user_id
    if (body.user_metadata !== undefined) input.user_metadata = body.user_metadata

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
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update session.' }, { status: 500 })
  }
}
