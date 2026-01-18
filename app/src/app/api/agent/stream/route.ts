import { NextRequest, NextResponse } from 'next/server'
import type { CoreMessage } from 'ai'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { getProjectById } from '@/lib/projects/keys'
import { createAdminClient } from '@/lib/supabase/server'
import { updateSessionActivity } from '@/lib/supabase/sessions'
import { saveSessionMessage } from '@/lib/supabase/session-messages'
import { getRunningChatRun, updateChatRunStatus } from '@/lib/agent/chat-run-service'
import { type BaseSSEEvent, SSE_HEADERS } from '@/lib/sse'
import { mastra } from '@/mastra'
import { isOriginAllowed } from '@/lib/utils/widget-auth'
import type { SupportAgentContext } from '../route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[agent.stream]'

/**
 * SSE event types for agent chat streaming
 */
type ChatSSEEventType =
  | 'connected'
  | 'message-start'
  | 'message-chunk'
  | 'message-complete'
  | 'error'

interface ChatSSEEvent extends BaseSSEEvent {
  type: ChatSSEEventType
  content?: string // For message-chunk events
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
 * GET /api/agent/stream?projectId=xxx&sessionId=xxx
 * SSE endpoint for real-time chat streaming
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

  // Use admin client since this is public-facing (no user auth)
  const supabase = createAdminClient()

  // Fetch the latest running chat run
  const chatRun = await getRunningChatRun({ sessionId, supabase })

  if (!chatRun) {
    return NextResponse.json(
      { error: 'No running chat found. Start a new chat first.' },
      { status: 404, headers: { 'Access-Control-Allow-Origin': origin } }
    )
  }

  // Get messages from metadata
  const messages = chatRun.metadata?.messages as { role: string; content: string }[] || []

  if (!messages.length) {
    return NextResponse.json(
      { error: 'No messages found for this chat run.' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': origin } }
    )
  }

  // Get the support agent
  const agent = mastra.getAgent('supportAgent')
  if (!agent) {
    console.error(`${LOG_PREFIX} supportAgent not found`)
    return NextResponse.json(
      { error: 'Support agent not available.' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': origin } }
    )
  }

  // Create SSE stream with CORS headers
  const corsHeaders = addCorsToSSEHeaders(origin)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false

      const safeEnqueue = (data: Uint8Array, eventType?: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(data)
            // Only log non-chunk events to avoid terminal spam
            if (eventType && eventType !== 'message-chunk') {
              console.log(`${LOG_PREFIX} Enqueued event:`, eventType)
            }
          } catch (enqueueError) {
            console.error(`${LOG_PREFIX} Failed to enqueue:`, enqueueError)
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

      const formatSSE = (event: ChatSSEEvent): string => {
        return `event: message\ndata: ${JSON.stringify(event)}\n\n`
      }

      const emit = (event: ChatSSEEvent) => {
        safeEnqueue(encoder.encode(formatSSE(event)), event.type)
      }

      const emitEvent = (
        type: ChatSSEEventType,
        options: Partial<Omit<ChatSSEEvent, 'type' | 'timestamp'>> = {}
      ) => {
        emit({
          type,
          ...options,
          timestamp: new Date().toISOString(),
        })
      }

      try {
        // Send connected event
        console.log(`${LOG_PREFIX} Sending connected event...`)
        emitEvent('connected', { message: 'Connected to chat stream' })

        // Build runtime context
        const runtimeContext = new RuntimeContext<SupportAgentContext>()
        runtimeContext.set('projectId', projectId)
        runtimeContext.set('userId', chatRun.metadata?.userId || null)
        runtimeContext.set('userMetadata', chatRun.metadata?.userMetadata || null)
        runtimeContext.set('sessionId', sessionId)

        // Convert messages to CoreMessage format
        const mastraMessages: CoreMessage[] = messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }))

        // Signal message start
        emitEvent('message-start', { message: 'Starting response generation' })

        // Check for cancellation
        const checkCancellation = async (): Promise<boolean> => {
          const { data } = await supabase
            .from('chat_runs')
            .select('status')
            .eq('id', chatRun.id)
            .single()
          return data?.status === 'cancelled'
        }

        // Stream the response
        const agentStream = await agent.stream(mastraMessages, {
          runtimeContext,
          memory: {
            thread: sessionId,
            resource: chatRun.metadata?.userId || 'anonymous',
          },
        })

        // Update session activity (fire and forget)
        updateSessionActivity(sessionId).catch((error) => {
          console.error(`${LOG_PREFIX} failed to update session activity`, error)
        })

        let fullContent = ''
        let chunkCount = 0

        for await (const chunk of agentStream.textStream) {
          // Check cancellation every 10 chunks
          if (chunkCount % 10 === 0) {
            const cancelled = await checkCancellation()
            if (cancelled || isClosed) {
              console.log(`${LOG_PREFIX} Chat cancelled or stream closed`)
              safeClose()
              return
            }
          }

          fullContent += chunk
          emitEvent('message-chunk', { content: chunk })
          chunkCount++
        }

        if (isClosed) {
          safeClose()
          return
        }

        // Send message-complete IMMEDIATELY to release UI
        emitEvent('message-complete', {
          message: 'Response complete',
          data: { contentLength: fullContent.length },
        })

        safeClose()

        // Do post-completion DB updates in background (don't block the client)
        const postCompletionTasks = async () => {
          try {
            // Save AI response to session_messages
            await saveSessionMessage({
              sessionId,
              projectId,
              senderType: 'ai',
              content: fullContent,
            })

            // Check for goodbye marker and handle session lifecycle
            const GOODBYE_MARKER = '[SESSION_GOODBYE]'
            if (fullContent.includes(GOODBYE_MARKER)) {
              console.log(`${LOG_PREFIX} Goodbye marker detected, scheduling session close`)

              // Get project settings for goodbye delay
              const { data: session } = await supabase
                .from('sessions')
                .select('project_id')
                .eq('id', sessionId)
                .single()

              let goodbyeDelaySeconds = 90 // Default 90 seconds
              if (session?.project_id) {
                const { data: settings } = await supabase
                  .from('project_settings')
                  .select('session_goodbye_delay_seconds')
                  .eq('project_id', session.project_id)
                  .single()
                if (settings?.session_goodbye_delay_seconds) {
                  goodbyeDelaySeconds = settings.session_goodbye_delay_seconds
                }
              }

              const scheduledCloseAt = new Date(Date.now() + goodbyeDelaySeconds * 1000).toISOString()

              await supabase
                .from('sessions')
                .update({
                  status: 'closing_soon',
                  goodbye_detected_at: new Date().toISOString(),
                  scheduled_close_at: scheduledCloseAt,
                })
                .eq('id', sessionId)
            }

            // Update chat run as completed
            await updateChatRunStatus({
              chatRunId: chatRun.id,
              status: 'completed',
              supabase,
            })
          } catch (err) {
            console.error(`${LOG_PREFIX} Post-completion tasks error:`, err)
          }
        }

        // Fire and forget - don't await
        postCompletionTasks()
      } catch (error) {
        console.error(`${LOG_PREFIX} stream error`, error)

        // Mark chat run as failed
        await updateChatRunStatus({
          chatRunId: chatRun.id,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Stream error',
          supabase,
        })

        emitEvent('error', {
          message: 'Chat encountered an issue. Please try again.',
        })

        safeClose()
      }
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
