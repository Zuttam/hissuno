import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { cleanupAnalysisCodebase } from '@/lib/knowledge/analysis-service'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { mastra } from '@/mastra'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[knowledge.analyze.stream]'

/**
 * SSE event types for knowledge analysis
 */
type KnowledgeSSEEventType =
  | 'connected'
  | 'workflow-start'
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'step-error'
  | 'workflow-finish'
  | 'error'

interface KnowledgeSSEEvent extends BaseSSEEvent {
  type: KnowledgeSSEEventType
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
    console.error(`${LOG_PREFIX} Supabase must be configured`)
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
      console.error(`${LOG_PREFIX} failed to load analysis`, projectId, analysisError)
      return NextResponse.json({ error: 'Failed to load analysis.' }, { status: 500 })
    }

    if (!latestAnalysis) {
      return NextResponse.json({ error: 'No running analysis found.' }, { status: 404 })
    }

    const runId = latestAnalysis.run_id

    // Get the workflow
    const workflow = mastra.getWorkflow('knowledgeAnalysisWorkflow')
    if (!workflow) {
      console.error(`${LOG_PREFIX} workflow not found`)
      return NextResponse.json({ error: 'Workflow not configured.' }, { status: 500 })
    }

    return createSSEStreamWithExecutor<KnowledgeSSEEvent>({
      logPrefix: LOG_PREFIX,
      executor: async ({ emit, close, isClosed }) => {
        // Helper to create typed events
        const emitEvent = (
          type: KnowledgeSSEEventType,
          options: Partial<Omit<KnowledgeSSEEvent, 'type' | 'timestamp'>> = {}
        ) => {
          emit(createSSEEvent(type, options) as KnowledgeSSEEvent)
        }

        // Send initial connected event
        console.log(`${LOG_PREFIX} Sending connected event...`)
        emitEvent('connected', { message: 'Connected to analysis stream' })

        try {
          // Get workflow input from analysis record metadata
          console.log(`${LOG_PREFIX} Analysis record metadata:`, JSON.stringify(latestAnalysis.metadata, null, 2))
          const workflowInput = latestAnalysis.metadata?.workflowInput

          if (!workflowInput) {
            console.error(`${LOG_PREFIX} No workflow input found in analysis record. Metadata keys:`, Object.keys(latestAnalysis.metadata ?? {}))
            emitEvent('error', { message: 'Analysis configuration not found. Please restart the analysis.' })
            close()
            return
          }

          console.log(`${LOG_PREFIX} Found workflow input with projectId:`, workflowInput.projectId)

          // Create a new run and execute the workflow directly with streamVNext
          console.log(`${LOG_PREFIX} Creating run with runId:`, runId)
          const run = await workflow.createRunAsync({ runId })

          // Execute the workflow with streamVNext
          console.log(`${LOG_PREFIX} Calling streamVNext to execute workflow...`)
          const workflowStream = run.streamVNext({ inputData: workflowInput })
          console.log(`${LOG_PREFIX} streamVNext started, iterating events...`)

          let eventCount = 0

          // Process stream events from the workflow execution
          for await (const event of workflowStream) {
            eventCount++

            // Stop processing if controller is closed (client disconnected)
            if (isClosed()) break

            // Log event for debugging
            console.log(`${LOG_PREFIX} Event:`, JSON.stringify(event, null, 2))

            // Extract step name from payload - Mastra uses 'stepName' in event payloads
            const payload = 'payload' in event ? (event.payload as Record<string, unknown>) : undefined
            const stepId = payload?.stepName as string | undefined

            switch (event.type) {
              case 'workflow-start':
                emitEvent('workflow-start', { message: 'Knowledge analysis started' })
                break

              case 'workflow-step-start':
                emitEvent('step-start', {
                  stepId,
                  stepName: getStepDisplayName(stepId ?? ''),
                  message: `Starting: ${getStepDisplayName(stepId ?? '')}`,
                })
                break

              case 'workflow-step-output': {
                // Custom progress events from workflow steps via writer.write()
                const output = (payload?.output as { type?: string; message?: string })
                  ?? (payload as { type?: string; message?: string })

                if (output?.type === 'progress') {
                  emitEvent('step-progress', {
                    stepId,
                    message: output?.message ?? 'Processing...',
                    data: output as Record<string, unknown>,
                  })
                }
                break
              }

              case 'workflow-step-result':
              case 'workflow-step-finish':
                emitEvent('step-finish', {
                  stepId,
                  stepName: getStepDisplayName(stepId ?? ''),
                  message: `Completed: ${getStepDisplayName(stepId ?? '')}`,
                })
                break

              case 'workflow-finish':
              case 'workflow-canceled': {
                // Check if the workflow finished with an error
                const workflowStatus = payload?.workflowStatus as string | undefined
                const isError = workflowStatus === 'error' || workflowStatus === 'failed'

                if (isError) {
                  // Throw to let the catch block handle error logging, DB update, and SSE error event
                  const errorDetails = payload?.error as string | undefined
                  throw new Error(errorDetails || 'Workflow failed during execution')
                } else {
                  emitEvent('workflow-finish', { message: 'Knowledge analysis completed' })
                }
                break
              }
            }
          }

          console.log(`${LOG_PREFIX} Workflow stream completed, total events:`, eventCount)

          // Cleanup local codebase directory after successful analysis
          const branch = latestAnalysis.metadata?.branch as string | undefined
          if (branch) {
            await cleanupAnalysisCodebase(projectId, branch)
          }

          // Stream ended - close the connection
          close()
        } catch (error) {
          console.error(`${LOG_PREFIX} stream error`, error)

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
            console.error(`${LOG_PREFIX} Failed to update analysis record:`, dbError)
          }

          // Cleanup local codebase directory on error
          const branch = latestAnalysis.metadata?.branch as string | undefined
          if (branch) {
            await cleanupAnalysisCodebase(projectId, branch)
          }

          // Send user-friendly error event
          emitEvent('error', {
            message: 'Analysis encountered an issue. Please try again or contact support if the problem persists.',
          })

          close()
        }
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error(`${LOG_PREFIX} unexpected error`, error)
    return NextResponse.json({ error: 'Failed to stream analysis.' }, { status: 500 })
  }
}
