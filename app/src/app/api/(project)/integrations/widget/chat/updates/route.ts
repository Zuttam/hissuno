import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UUID_REGEX } from '@/lib/db/server'
import { sessions, sessionMessages } from '@/lib/db/schema/app'
import { eq, and, gt } from 'drizzle-orm'
import { getProjectById } from '@/lib/projects/keys'
import { isOriginAllowed } from '@/lib/utils/widget-auth'
import { SSE_HEADERS } from '@/lib/utils/sse'
import { getWidgetRequestOrigin, createWidgetCorsHeaders, createWidgetOptionsResponse } from '@/lib/utils/widget-cors'
import type { ChatMessage } from '@/types/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[widget/chat/updates]'
const POLL_INTERVAL = 2000 // 2 seconds

/**
 * SSE event types for session updates
 */
type UpdateSSEEventType = 'connected' | 'message' | 'status-change' | 'error' | 'heartbeat'

interface UpdateSSEEvent {
  type: UpdateSSEEventType
  message?: ChatMessage
  status?: string
  error?: string
  timestamp: string
}

/**
 * Merge SSE headers with widget CORS headers.
 */
function getSSECorsHeaders(origin: string): Record<string, string> {
  return {
    ...SSE_HEADERS,
    ...createWidgetCorsHeaders(origin),
  }
}

/**
 * GET /api/integrations/widget/chat/updates?sessionId=xxx&projectId=xxx
 * SSE endpoint for real-time session updates (human messages, status changes)
 * Widget connects to receive updates in real-time.
 */
export async function GET(request: NextRequest) {
  const origin = getWidgetRequestOrigin(request)
  const projectId = request.nextUrl.searchParams.get('projectId')
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400, headers: createWidgetCorsHeaders(origin) }
    )
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400, headers: createWidgetCorsHeaders(origin) }
    )
  }

  if (!UUID_REGEX.test(sessionId)) {
    return NextResponse.json(
      { error: 'Invalid session ID format' },
      { status: 400, headers: createWidgetCorsHeaders(origin) }
    )
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500, headers: createWidgetCorsHeaders(origin) }
    )
  }

  // Validate project ID and get project
  const project = await getProjectById(projectId)
  if (!project) {
    return NextResponse.json(
      { error: 'Invalid project ID' },
      { status: 401, headers: createWidgetCorsHeaders(origin) }
    )
  }

  // Check origin
  if (!isOriginAllowed(origin, project.allowed_origins)) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403, headers: createWidgetCorsHeaders(origin) }
    )
  }

  const corsHeaders = getSSECorsHeaders(origin)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false
      let lastMessageId: string | null = null
      let lastStatus: string | null = null
      let lastHumanTakeover: boolean | null = null

      const safeEnqueue = (data: Uint8Array) => {
        if (!isClosed) {
          try {
            controller.enqueue(data)
          } catch {
            isClosed = true
          }
        }
      }

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true
          try {
            controller.close()
          } catch {
            // Already closed
          }
        }
      }

      const formatSSE = (event: UpdateSSEEvent): string => {
        return `event: message\ndata: ${JSON.stringify(event)}\n\n`
      }

      const emit = (event: UpdateSSEEvent) => {
        safeEnqueue(encoder.encode(formatSSE(event)))
      }

      const emitEvent = (
        type: UpdateSSEEventType,
        options: Partial<Omit<UpdateSSEEvent, 'type' | 'timestamp'>> = {}
      ) => {
        emit({
          type,
          ...options,
          timestamp: new Date().toISOString(),
        })
      }

      // Send connected event
      emitEvent('connected')

      // Polling function to check for new messages and status changes
      const poll = async () => {
        if (isClosed) return

        try {
          // Check for new human agent messages only (ai/user messages are handled by the stream)
          // Build conditions for the query
          const conditions = [
            eq(sessionMessages.session_id, sessionId),
            eq(sessionMessages.sender_type, 'human_agent'),
          ]

          if (lastMessageId) {
            // Get messages after the last one we sent
            const [lastMsg] = await db
              .select({ created_at: sessionMessages.created_at })
              .from(sessionMessages)
              .where(eq(sessionMessages.id, lastMessageId))
              .limit(1)

            if (lastMsg?.created_at) {
              conditions.push(gt(sessionMessages.created_at, lastMsg.created_at))
            }
          }

          const messages = await db
            .select({
              id: sessionMessages.id,
              content: sessionMessages.content,
              sender_type: sessionMessages.sender_type,
              created_at: sessionMessages.created_at,
            })
            .from(sessionMessages)
            .where(and(...conditions))
            .orderBy(sessionMessages.created_at)

          if (messages.length > 0) {
            for (const msg of messages) {
              const chatMessage: ChatMessage = {
                id: msg.id,
                role: 'assistant',
                content: msg.content,
                createdAt: msg.created_at?.toISOString() ?? new Date().toISOString(),
                senderType: msg.sender_type === 'human_agent' ? 'human_agent' : 'system',
              }
              emitEvent('message', { message: chatMessage })
              lastMessageId = msg.id
            }
          }

          // Check for session status changes and human takeover flag
          const [session] = await db
            .select({ status: sessions.status, is_human_takeover: sessions.is_human_takeover })
            .from(sessions)
            .where(eq(sessions.id, sessionId))
            .limit(1)

          if (session) {
            // Emit human takeover changes
            if (lastHumanTakeover !== null && session.is_human_takeover !== lastHumanTakeover) {
              if (session.is_human_takeover) {
                emitEvent('status-change', { status: 'human_takeover' })
              } else {
                emitEvent('status-change', { status: session.status ?? undefined })
              }
            }
            lastHumanTakeover = session.is_human_takeover

            // Emit session status changes
            if (session.status !== lastStatus) {
              if (lastStatus !== null) {
                emitEvent('status-change', { status: session.status ?? undefined })
              }
              lastStatus = session.status

              // Close stream if session is closed
              if (session.status === 'closed') {
                safeClose()
                return
              }
            }
          }

          // Send heartbeat to keep connection alive
          emitEvent('heartbeat')
        } catch (error) {
          console.error(`${LOG_PREFIX} Poll error:`, error)
          emitEvent('error', { error: 'Connection error' })
        }

        // Schedule next poll
        if (!isClosed) {
          setTimeout(poll, POLL_INTERVAL)
        }
      }

      // Start polling
      poll()

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`${LOG_PREFIX} Client disconnected`)
        safeClose()
      })
    },
  })

  return new Response(stream, { headers: corsHeaders })
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return createWidgetOptionsResponse(request)
}
