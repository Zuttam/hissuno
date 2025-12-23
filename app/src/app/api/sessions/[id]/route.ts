import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getSessionById } from '@/lib/supabase/sessions'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { mastra } from '@/mastra'
import { parseMastraMessages } from '@/lib/utils/mastra/parse-messages'
import type { ChatMessage } from '@/types/session'

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

    // Fetch messages from Mastra storage
    let messages: ChatMessage[] = []
    try {
      const storage = mastra.getStorage()
      if (storage) {
        const mastraMessages = await storage.getMessages({ threadId: sessionId })
        messages = parseMastraMessages(mastraMessages)
      }
    } catch (mastraError) {
      console.error('[sessions.getById] Failed to fetch messages from Mastra:', mastraError)
      // Continue without messages rather than failing the entire request
    }

    return NextResponse.json({ session, messages })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.getById] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load session.' }, { status: 500 })
  }
}
