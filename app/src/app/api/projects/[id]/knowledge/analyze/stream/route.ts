import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { mastra } from '@/mastra'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * SSE event types emitted to the client
 */
type SSEEventType = 
  | 'connected'
  | 'workflow-start'
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'step-error'
  | 'workflow-finish'
  | 'error'

interface SSEEvent {
  type: SSEEventType
  stepId?: string
  stepName?: string
  message?: string
  data?: Record<string, unknown>
  timestamp: string
}

/**
 * Format an SSE message
 */
function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Map step IDs to human-readable names
 */
function getStepDisplayName(stepId: string): string {
  const stepNames: Record<string, string> = {
    'analyze-codebase': 'Analyzing codebase',
    'analyze-sources': 'Analyzing knowledge sources',
    'compile-knowledge': 'Compiling knowledge packages',
    'save-packages': 'Saving knowledge packages',
  }
  return stepNames[stepId] ?? stepId
}

/**
 * GET /api/projects/[id]/knowledge/analyze/stream
 * Server-Sent Events endpoint for real-time workflow progress
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge.analyze.stream] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Fetch the latest running analysis from project_analyses table
    const { data: latestAnalysis, error: analysisError } = await supabase
      .from('project_analyses')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (analysisError && analysisError.code !== 'PGRST116') {
      console.error('[knowledge.analyze.stream] failed to load analysis', projectId, analysisError)
      return NextResponse.json({ error: 'Failed to load analysis.' }, { status: 500 })
    }

    if (!latestAnalysis) {
      return NextResponse.json({ error: 'No running analysis found.' }, { status: 404 })
    }

    const runId = latestAnalysis.run_id

    // Get the workflow
    const workflow = mastra.getWorkflow('knowledgeAnalysisWorkflow')
    if (!workflow) {
      console.error('[knowledge.analyze.stream] workflow not found')
      return NextResponse.json({ error: 'Workflow not configured.' }, { status: 500 })
    }

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Track if controller is closed to prevent writing after close
        let isClosed = false

        // Safe enqueue that checks if controller is still open
        const safeEnqueue = (data: Uint8Array) => {
          if (!isClosed) {
            try {
              controller.enqueue(data)
            } catch {
              // Controller was closed, mark as closed
              isClosed = true
            }
          }
        }

        // Safe close that only closes once
        const safeClose = () => {
          if (!isClosed) {
            isClosed = true
            try {
              controller.close()
            } catch {
              // Already closed, ignore
            }
          }
        }

        // Send initial connected event
        safeEnqueue(encoder.encode(formatSSE({
          type: 'connected',
          message: 'Connected to analysis stream',
          timestamp: new Date().toISOString(),
        })))

        try {
          // Reconnect to the existing workflow run using the same runId
          // This works because the workflow was started with stream() in the POST route
          const run = await workflow.createRunAsync({ runId })
          
          // Use observeStream to watch the running workflow
          const observeStream = await run.observeStreamVNext()

          // Process stream events
          for await (const event of observeStream) {
            // Stop processing if controller is closed (client disconnected)
            if (isClosed) break

            let sseEvent: SSEEvent | null = null

            // Map Mastra events to our SSE events
            // Note: Mastra uses 'id' not 'stepId' in payload
            const stepId = 'payload' in event ? (event.payload as { id?: string })?.id : undefined
            
            switch (event.type) {
              case 'workflow-start':
                sseEvent = {
                  type: 'workflow-start',
                  message: 'Knowledge analysis started',
                  timestamp: new Date().toISOString(),
                }
                break

              case 'workflow-step-start':
                sseEvent = {
                  type: 'step-start',
                  stepId,
                  stepName: getStepDisplayName(stepId ?? ''),
                  message: `Starting: ${getStepDisplayName(stepId ?? '')}`,
                  timestamp: new Date().toISOString(),
                }
                break

              case 'workflow-step-output': {
                // Custom progress events from workflow steps
                const output = 'payload' in event ? (event.payload as { output?: { type?: string; message?: string } })?.output : undefined
                if (output?.type === 'progress') {
                  sseEvent = {
                    type: 'step-progress',
                    stepId,
                    message: output?.message ?? 'Processing...',
                    data: output as Record<string, unknown>,
                    timestamp: new Date().toISOString(),
                  }
                }
                break
              }

              case 'workflow-step-result':
              case 'workflow-step-finish':
                sseEvent = {
                  type: 'step-finish',
                  stepId,
                  stepName: getStepDisplayName(stepId ?? ''),
                  message: `Completed: ${getStepDisplayName(stepId ?? '')}`,
                  timestamp: new Date().toISOString(),
                }
                break

              case 'workflow-finish':
              case 'workflow-canceled':
                sseEvent = {
                  type: 'workflow-finish',
                  message: 'Knowledge analysis completed',
                  timestamp: new Date().toISOString(),
                }
                break
            }

            if (sseEvent) {
              safeEnqueue(encoder.encode(formatSSE(sseEvent)))
            }
          }

          // Stream ended - close the connection
          safeClose()
        } catch (error) {
          console.error('[knowledge.analyze.stream] stream error', error)
          
          // Send error event before closing (if controller still open)
          safeEnqueue(encoder.encode(formatSSE({
            type: 'error',
            message: error instanceof Error ? error.message : 'Stream error',
            timestamp: new Date().toISOString(),
          })))
          
          safeClose()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge.analyze.stream] unexpected error', error)
    return NextResponse.json({ error: 'Failed to stream analysis.' }, { status: 500 })
  }
}
