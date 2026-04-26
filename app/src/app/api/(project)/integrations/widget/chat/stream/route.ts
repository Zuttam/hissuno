import { NextRequest, NextResponse } from 'next/server'
import type { ModelMessage } from 'ai'
import { RequestContext } from '@mastra/core/request-context'
import { getProjectById } from '@/lib/projects/keys'
import { db } from '@/lib/db'
import { chatRuns as chatRunsTable, sessions as sessionsTable, projectSettings } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { updateSessionActivity, setSessionHumanTakeover } from '@/lib/db/queries/sessions'
import { saveSessionMessage } from '@/lib/db/queries/session-messages'
import { getRunningChatRun, updateChatRunStatus } from '@/lib/agent/chat-run-service'
import { getSupportAgentSettingsAdmin } from '@/lib/db/queries/project-settings/support-agent'
import {
  type BaseSSEEvent,
  createSSEStreamWithExecutor,
  createSSEEvent,
} from '@/lib/utils/sse'
import { resolveAgent } from '@/mastra/agents/router'
import { isOriginAllowed } from '@/lib/utils/widget-auth'
import { getWidgetRequestOrigin, createWidgetCorsHeaders, createWidgetOptionsResponse } from '@/lib/utils/widget-cors'
import type { SupportAgentContext } from '@/types/agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[widget/chat/stream]'

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
 * GET /api/integrations/widget/chat/stream?projectId=xxx&sessionId=xxx
 * SSE endpoint for real-time chat streaming
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

  // Fetch the latest running chat run
  const chatRun = await getRunningChatRun({ sessionId })

  if (!chatRun) {
    return NextResponse.json(
      { error: 'No running chat found. Start a new chat first.' },
      { status: 404, headers: createWidgetCorsHeaders(origin) }
    )
  }

  // Get messages from metadata
  const metadata = chatRun.metadata as Record<string, unknown> | null
  const messages = ((metadata?.messages ?? []) as { role: string; content: string }[])

  if (!messages.length) {
    return NextResponse.json(
      { error: 'No messages found for this chat run.' },
      { status: 400, headers: createWidgetCorsHeaders(origin) }
    )
  }

  // Resolve the agent via router
  const widgetContactId = (metadata?.contactId as string) ?? null

  // Create SSE stream with CORS headers using shared utilities
  const corsHeaders = createWidgetCorsHeaders(origin)

  return createSSEStreamWithExecutor<ChatSSEEvent>({
    logPrefix: LOG_PREFIX,
    headers: corsHeaders,
    executor: async ({ emit, close, isClosed }) => {
      // Helper to create typed events
      const emitEvent = (
        type: ChatSSEEventType,
        options: Partial<Omit<ChatSSEEvent, 'type' | 'timestamp'>> = {}
      ) => {
        emit(createSSEEvent(type, options) as ChatSSEEvent)
      }

      try {
        // Send connected event
        console.log(`${LOG_PREFIX} Sending connected event...`)
        emitEvent('connected', { message: 'Connected to chat stream' })

        // Get the knowledge package ID - use override from metadata if provided, otherwise fetch from settings
        let supportPackageId: string | null = metadata?.packageId as string | null
        if (!supportPackageId) {
          const agentSettings = await getSupportAgentSettingsAdmin(projectId)
          supportPackageId = agentSettings.support_agent_package_id
        }

        // Resolve agent via router (support or PM based on contactId)
        const { agent, systemMessages } = await resolveAgent({
          contactId: widgetContactId,
          supportPackageId,
          projectId,
        })

        // Build runtime context
        const requestContext = new RequestContext<SupportAgentContext>()
        requestContext.set('projectId', projectId)
        requestContext.set('userId', (metadata?.userId as string) || null)
        requestContext.set('userMetadata', (metadata?.userMetadata as Record<string, string>) || null)
        requestContext.set('sessionId', sessionId)
        requestContext.set('supportPackageId', supportPackageId)
        requestContext.set('contactId', widgetContactId)

        // Convert messages to ModelMessage format, with knowledge injected as system messages
        const mastraMessages: ModelMessage[] = [
          ...systemMessages,
          ...messages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        ]

        // Signal message start
        emitEvent('message-start', { message: 'Starting response generation' })

        // Check for cancellation
        const checkCancellation = async (): Promise<boolean> => {
          const [row] = await db
            .select({ status: chatRunsTable.status })
            .from(chatRunsTable)
            .where(eq(chatRunsTable.id, chatRun.id))
            .limit(1)
          return row?.status === 'cancelled'
        }

        // Stream the response — tools are baked into the agent
        const agentStream = await agent.stream(mastraMessages, {
          requestContext,
          memory: {
            thread: sessionId,
            resource: (metadata?.userId as string) || 'anonymous',
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
            if (cancelled || isClosed()) {
              console.log(`${LOG_PREFIX} Chat cancelled or stream closed`)
              close()
              return
            }
          }

          fullContent += chunk
          emitEvent('message-chunk', { content: chunk })
          chunkCount++
        }

        if (isClosed()) {
          close()
          return
        }

        // Send message-complete IMMEDIATELY to release UI
        emitEvent('message-complete', {
          message: 'Response complete',
          data: { contentLength: fullContent.length },
        })

        close()

        // Do post-completion DB updates in background (don't block the client)
        const postCompletionTasks = async () => {
          try {
            // Check for human takeover marker and strip it before saving
            const HUMAN_TAKEOVER_MARKER = '[HUMAN_TAKEOVER]'
            if (fullContent.includes(HUMAN_TAKEOVER_MARKER)) {
              console.log(`${LOG_PREFIX} Human takeover marker detected, setting flag`)
              fullContent = fullContent.replace(HUMAN_TAKEOVER_MARKER, '').trim()
              await setSessionHumanTakeover(sessionId, true)
            }

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
              const [session] = await db
                .select({ project_id: sessionsTable.project_id })
                .from(sessionsTable)
                .where(eq(sessionsTable.id, sessionId))
                .limit(1)

              let goodbyeDelaySeconds = 90 // Default 90 seconds
              if (session?.project_id) {
                const [settings] = await db
                  .select({ session_goodbye_delay_seconds: projectSettings.session_goodbye_delay_seconds })
                  .from(projectSettings)
                  .where(eq(projectSettings.project_id, session.project_id))
                  .limit(1)
                if (settings?.session_goodbye_delay_seconds) {
                  goodbyeDelaySeconds = settings.session_goodbye_delay_seconds
                }
              }

              const scheduledCloseAt = new Date(Date.now() + goodbyeDelaySeconds * 1000)

              await db
                .update(sessionsTable)
                .set({
                  status: 'closing_soon',
                  goodbye_detected_at: new Date(),
                  scheduled_close_at: scheduledCloseAt,
                })
                .where(eq(sessionsTable.id, sessionId))
            }

            // Update chat run as completed
            await updateChatRunStatus({
              chatRunId: chatRun.id,
              status: 'completed',
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
        })

        emitEvent('error', {
          message: 'Chat encountered an issue. Please try again.',
        })

        close()
      }
    },
  });
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return createWidgetOptionsResponse(request)
}
