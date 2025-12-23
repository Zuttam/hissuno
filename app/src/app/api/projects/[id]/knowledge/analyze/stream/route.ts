import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { mastra } from '@/mastra'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
 * Uses explicit event type for better browser compatibility
 */
function formatSSE(event: SSEEvent): string {
  // SSE format: event type (optional), data, and double newline to end
  return `event: message\ndata: ${JSON.stringify(event)}\n\n`
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
        const safeEnqueue = (data: Uint8Array, eventType?: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(data)
              console.log('[knowledge.analyze.stream] Enqueued event:', eventType ?? 'unknown')
            } catch (enqueueError) {
              // Controller was closed, mark as closed
              console.error('[knowledge.analyze.stream] Failed to enqueue:', enqueueError)
              isClosed = true
            }
          } else {
            console.log('[knowledge.analyze.stream] Skipped (closed):', eventType ?? 'unknown')
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
        console.log('[knowledge.analyze.stream] Sending connected event...')
        safeEnqueue(encoder.encode(formatSSE({
          type: 'connected',
          message: 'Connected to analysis stream',
          timestamp: new Date().toISOString(),
        })), 'connected')

        try {
          // Get workflow input from analysis record metadata
          console.log('[knowledge.analyze.stream] Analysis record metadata:', JSON.stringify(latestAnalysis.metadata, null, 2))
          const workflowInput = latestAnalysis.metadata?.workflowInput
          
          if (!workflowInput) {
            console.error('[knowledge.analyze.stream] No workflow input found in analysis record. Metadata keys:', Object.keys(latestAnalysis.metadata ?? {}))
            safeEnqueue(encoder.encode(formatSSE({
              type: 'error',
              message: 'Analysis configuration not found. Please restart the analysis.',
              timestamp: new Date().toISOString(),
            })), 'error')
            safeClose()
            return
          }
          
          console.log('[knowledge.analyze.stream] Found workflow input with projectId:', workflowInput.projectId)

          // Create a new run and execute the workflow directly with streamVNext
          // This is the proper way to stream workflow events - executing it here in the SSE route
          console.log('[knowledge.analyze.stream] Creating run with runId:', runId)
          const run = await workflow.createRunAsync({ runId })
          
          // Execute the workflow with streamVNext - this actually runs the workflow and streams events
          console.log('[knowledge.analyze.stream] Calling streamVNext to execute workflow...')
          const workflowStream = run.streamVNext({ inputData: workflowInput })
          console.log('[knowledge.analyze.stream] streamVNext started, iterating events...')

          let eventCount = 0
          
          // Process stream events from the workflow execution
          for await (const event of workflowStream) {
            eventCount++
            
            // Stop processing if controller is closed (client disconnected)
            if (isClosed) break

            let sseEvent: SSEEvent | null = null

            // Log event for debugging
            console.log('[knowledge.analyze.stream] Event:', JSON.stringify(event, null, 2))

            // Extract step name from payload - Mastra uses 'stepName' in event payloads
            const payload = 'payload' in event ? (event.payload as Record<string, unknown>) : undefined
            const stepId = payload?.stepName as string | undefined
            
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
                // Custom progress events from workflow steps via writer.write()
                // The payload for step-output events contains the data written by writer.write()
                // Check both payload.output (nested) and payload directly (if data is at root level)
                const output = (payload?.output as { type?: string; message?: string }) 
                  ?? (payload as { type?: string; message?: string })
                
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
              safeEnqueue(encoder.encode(formatSSE(sseEvent)), sseEvent.type)
            }
          }

          console.log('[knowledge.analyze.stream] Workflow stream completed, total events:', eventCount)
          
          // Stream ended - close the connection
          safeClose()
        } catch (error) {
          console.error('[knowledge.analyze.stream] stream error', error)
          
          // Mark the analysis as failed in the database
          try {
            const supabaseForError = await createClient()
            await supabaseForError
              .from('project_analyses')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: error instanceof Error ? error.message : 'Stream error',
              })
              .eq('id', latestAnalysis.id)
          } catch (dbError) {
            console.error('[knowledge.analyze.stream] Failed to update analysis record:', dbError)
          }
          
          // Send error event before closing (if controller still open)
          safeEnqueue(encoder.encode(formatSSE({
            type: 'error',
            message: error instanceof Error ? error.message : 'Stream error',
            timestamp: new Date().toISOString(),
          })), 'error')
          
          safeClose()
        }
      },
    })

    console.log('[knowledge.analyze.stream] Returning SSE response for runId:', runId)
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
