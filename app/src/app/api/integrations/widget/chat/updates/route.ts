import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getProjectById } from '@/lib/projects/keys'
import { isOriginAllowed } from '@/lib/utils/widget-auth'
import { SSE_HEADERS } from '@/lib/sse'
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
 * Get the request origin from headers
 * Uses Origin header if present, otherwise falls back to request URL origin
 */
function getRequestOrigin(request: NextRequest): string {
  return request.headers.get('Origin') || request.nextUrl.origin
}

/**
 * Add CORS headers to SSE response
 */
function addCorsToSSEHeaders(origin: string): Record<string, string> {
  return {
    ...SSE_HEADERS,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

/**
 * GET /api/integrations/widget/chat/updates?sessionId=xxx&projectId=xxx
 * SSE endpoint for real-time session updates (human messages, status changes)
 * Widget connects to receive updates in real-time.
 */
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request)
  const projectId = request.nextUrl.searchParams.get('projectId')
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': origin } }
    )
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': origin } }
    )
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': origin } }
    )
  }

  // Validate project ID and get project
  const project = await getProjectById(projectId)
  if (!project) {
    return NextResponse.json(
      { error: 'Invalid project ID' },
      { status: 401, headers: { 'Access-Control-Allow-Origin': origin } }
    )
  }

  // Check origin
  if (!isOriginAllowed(origin, project.allowed_origins)) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403, headers: { 'Access-Control-Allow-Origin': origin } }
    )
  }

  const corsHeaders = addCorsToSSEHeaders(origin)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false
      let lastMessageId: string | null = null
      let lastStatus: string | null = null

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

      const supabase = createAdminClient()

      // Polling function to check for new messages and status changes
      const poll = async () => {
        if (isClosed) return

        try {
          // Check for new human agent messages only (ai/user messages are handled by the stream)
          let query = supabase
            .from('session_messages')
            .select('id, content, sender_type, created_at')
            .eq('session_id', sessionId)
            .eq('sender_type', 'human_agent')
            .order('created_at', { ascending: true })

          if (lastMessageId) {
            // Get messages after the last one we sent
            const { data: lastMsg } = await supabase
              .from('session_messages')
              .select('created_at')
              .eq('id', lastMessageId)
              .single()

            if (lastMsg) {
              query = query.gt('created_at', lastMsg.created_at)
            }
          }

          const { data: messages } = await query

          if (messages && messages.length > 0) {
            for (const msg of messages) {
              const chatMessage: ChatMessage = {
                id: msg.id,
                role: 'assistant',
                content: msg.content,
                createdAt: msg.created_at,
                senderType: msg.sender_type === 'human_agent' ? 'human_agent' : 'system',
              }
              emitEvent('message', { message: chatMessage })
              lastMessageId = msg.id
            }
          }

          // Check for session status changes
          const { data: session } = await supabase
            .from('sessions')
            .select('status')
            .eq('id', sessionId)
            .single()

          if (session && session.status !== lastStatus) {
            if (lastStatus !== null) {
              // Only emit if status actually changed (not on first poll)
              emitEvent('status-change', { status: session.status })
            }
            lastStatus = session.status

            // Close stream if session is closed
            if (session.status === 'closed') {
              safeClose()
              return
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
  const origin = getRequestOrigin(request)

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
