import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import type { ChatMessage } from '@/types/session'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/sessions/[id]/messages
 * Sends a human agent message to the session.
 * Requires authenticated user who owns the project.
 *
 * Request body:
 * - content: string - the message content
 *
 * Response:
 * - message: ChatMessage - the created message
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.messages] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params
    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('[sessions.messages] failed to resolve user', userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    // Get session and verify user owns the project
    const adminClient = createAdminClient()
    const { data: session, error: sessionError } = await adminClient
      .from('sessions')
      .select('id, project_id, status')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', session.project_id)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }

    // Check if session is still active (not closed)
    if (session.status === 'closed') {
      return NextResponse.json({ error: 'Cannot send messages to a closed session.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const messageId = crypto.randomUUID()

    // Insert message into session_messages table
    const { data: dbMessage, error: insertError } = await adminClient
      .from('session_messages')
      .insert({
        id: messageId,
        session_id: sessionId,
        project_id: session.project_id,
        sender_type: 'human_agent',
        sender_user_id: user.id,
        content: content.trim(),
        created_at: now,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[sessions.messages] Failed to insert message:', insertError)
      return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 })
    }

    // Update session last_activity_at
    await adminClient
      .from('sessions')
      .update({ last_activity_at: now })
      .eq('id', sessionId)

    // Return the message in ChatMessage format
    const chatMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: content.trim(),
      createdAt: now,
      senderType: 'human_agent',
      senderName: user.email || 'Support Agent',
    }

    return NextResponse.json({ message: chatMessage })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.messages] unexpected error', error)
    return NextResponse.json({ error: 'Unable to send message.' }, { status: 500 })
  }
}
