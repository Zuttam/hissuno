import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getIssueById } from '@/lib/supabase/issues'
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { mastra } from '@/mastra'
import { getPmAgentSettingsAdmin } from '@/lib/supabase/project-settings/pm-agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string; issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[generate-spec.stream]'

/**
 * SSE event types for spec generation
 */
type SpecSSEEventType =
  | 'connected'
  | 'workflow-start'
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'workflow-finish'
  | 'heartbeat'
  | 'error'

// Heartbeat interval in milliseconds (15 seconds)
const HEARTBEAT_INTERVAL_MS = 15_000

interface SpecSSEEvent extends BaseSSEEvent {
  type: SpecSSEEventType
}

/**
 * Map step IDs to human-readable names
 */
function getStepDisplayName(stepId: string): string {
  const stepNames: Record<string, string> = {
    'prepare-codebase': 'Preparing codebase access',
    'prepare-context': 'Gathering issue context',
    'generate-spec': 'Generating specification',
    'cleanup-codebase': 'Cleaning up',
  }
  return stepNames[stepId] ?? stepId
}

/**
 * GET /api/projects/[id]/issues/[issueId]/generate-spec/stream
 * Server-Sent Events endpoint for real-time spec generation progress
 * Requires runId query parameter to identify the specific spec run
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId, issueId } = await context.params
  const url = new URL(_request.url)
  const runId = url.searchParams.get('runId')

  // Validate runId is provided
  if (!runId) {
    return NextResponse.json({ error: 'runId query parameter is required.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    console.error(`${LOG_PREFIX} Supabase must be configured`)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    const supabase = await createClient()

    // Fetch the specific spec run by runId (exact match, not "latest")
    const { data: specRun, error: specRunError } = await supabase
      .from('issue_spec_runs')
      .select('*')
      .eq('issue_id', issueId)
      .eq('run_id', runId)
      .eq('status', 'running')
      .single()

    if (specRunError && specRunError.code !== 'PGRST116') {
      console.error(`${LOG_PREFIX} failed to load spec run`, issueId, runId, specRunError)
      return NextResponse.json({ error: 'Failed to load spec run.' }, { status: 500 })
    }

    if (!specRun) {
      return NextResponse.json({ error: 'Spec run not found or not running.' }, { status: 404 })
    }

    // Get the workflow
    const workflow = mastra.getWorkflow('specGenerationWorkflow')
    if (!workflow) {
      console.error(`${LOG_PREFIX} Spec generation workflow not found`)
      return NextResponse.json({ error: 'Spec generation workflow not configured.' }, { status: 500 })
    }

    return createSSEStreamWithExecutor<SpecSSEEvent>({
      logPrefix: LOG_PREFIX,
      executor: async ({ emit, close, isClosed }) => {
        // Helper to create typed events
        const emitEvent = (
          type: SpecSSEEventType,
          options: Partial<Omit<SpecSSEEvent, 'type' | 'timestamp'>> = {}
        ) => {
          emit(createSSEEvent(type, options) as SpecSSEEvent)
        }

        // Set up heartbeat interval to keep connection alive
        const heartbeatInterval = setInterval(() => {
          if (!isClosed()) {
            emitEvent('heartbeat', { message: 'keep-alive' })
          }
        }, HEARTBEAT_INTERVAL_MS)

        // Helper to clean up heartbeat and close stream
        const cleanup = () => {
          clearInterval(heartbeatInterval)
          close()
        }

        // Send initial connected event
        console.log(`${LOG_PREFIX} Sending connected event...`)
        emitEvent('connected', { message: 'Connected to spec generation stream' })

        try {
          // Create a new workflow run
          console.log(`${LOG_PREFIX} Creating workflow run with runId:`, runId)
          const run = await workflow.createRunAsync({ runId })

          // Load PM agent settings for spec guidelines
          const pmSettings = await getPmAgentSettingsAdmin(projectId)

          // Prepare workflow input
          const workflowInput = {
            issueId,
            projectId,
            runId,
            specGuidelines: pmSettings.spec_guidelines ?? undefined,
          }

          // Send workflow-start event
          emitEvent('workflow-start', {
            message: 'Starting spec generation workflow',
            data: {
              runId,
              totalSteps: 4, // prepare-codebase, prepare-context, generate-spec, cleanup-codebase
            },
          })

          // Execute the workflow with stream
          console.log(`${LOG_PREFIX} Starting workflow stream...`)
          const workflowStream = run.stream({ inputData: workflowInput })

          let eventCount = 0

          // Process stream events from the workflow execution
          for await (const event of workflowStream.fullStream) {
            eventCount++

            // Stop processing if controller is closed (client disconnected)
            if (isClosed()) break

            // Log event for debugging
            console.log(`${LOG_PREFIX} Event:`, JSON.stringify(event, null, 2))

            // Extract step name from payload
            const payload = 'payload' in event ? (event.payload as Record<string, unknown>) : undefined
            const stepId = payload?.stepName as string | undefined

            switch (event.type) {
              case 'workflow-start':
                // Already sent, skip
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
                const output =
                  (payload?.output as { type?: string; message?: string }) ??
                  (payload as { type?: string; message?: string })

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
                  const errorDetails = payload?.error as string | undefined
                  throw new Error(errorDetails || 'Workflow failed during execution')
                } else {
                  // Check if spec was saved
                  const adminSupabase = createAdminClient()
                  const { data: updatedIssue } = await adminSupabase
                    .from('issues')
                    .select('product_spec, product_spec_generated_at')
                    .eq('id', issueId)
                    .single()

                  if (updatedIssue?.product_spec) {
                    // Update spec run as completed
                    await adminSupabase
                      .from('issue_spec_runs')
                      .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                      })
                      .eq('id', specRun.id)

                    emitEvent('workflow-finish', {
                      message: 'Spec generation completed successfully',
                      data: {
                        specGeneratedAt: updatedIssue.product_spec_generated_at,
                      },
                    })
                  } else {
                    throw new Error('Spec was not saved to database')
                  }
                }
                break
              }
            }
          }

          console.log(`${LOG_PREFIX} Workflow stream completed, total events:`, eventCount)
          cleanup()
        } catch (error) {
          console.error(`${LOG_PREFIX} stream error`, error)

          // Mark the spec run as failed in the database
          try {
            const adminSupabase = createAdminClient()
            await adminSupabase
              .from('issue_spec_runs')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: error instanceof Error ? error.message : 'Stream error',
              })
              .eq('id', specRun.id)
          } catch (dbError) {
            console.error(`${LOG_PREFIX} Failed to update spec run record:`, dbError)
          }

          // Send user-friendly error event
          emitEvent('error', {
            message: 'Spec generation encountered an issue. Please try again.',
          })

          cleanup()
        }
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error(`${LOG_PREFIX} unexpected error`, error)
    return NextResponse.json({ error: 'Failed to stream spec generation.' }, { status: 500 })
  }
}
