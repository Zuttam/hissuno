import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { createSSEStreamWithExecutor, createSSEEvent, BaseSSEEvent } from '@/lib/sse'
import { mastra } from '@/mastra'
import type { SessionTag } from '@/types/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[session-review.stream]'

/**
 * Session review SSE event types
 */
export type SessionReviewSSEEventType =
  | 'connected'
  | 'review-start'
  // Classification phase
  | 'classify-start'
  | 'classify-progress'
  | 'classify-finish'
  // PM Review multi-step phase
  | 'prepare-context-start'
  | 'prepare-context-progress'
  | 'prepare-context-finish'
  | 'find-duplicates-start'
  | 'find-duplicates-progress'
  | 'find-duplicates-finish'
  | 'analyze-impact-start'
  | 'analyze-impact-progress'
  | 'analyze-impact-finish'
  | 'estimate-effort-start'
  | 'estimate-effort-progress'
  | 'estimate-effort-finish'
  | 'pm-decision-start'
  | 'pm-decision-progress'
  | 'pm-decision-finish'
  | 'execute-decision-start'
  | 'execute-decision-progress'
  | 'execute-decision-finish'
  // Completion
  | 'review-finish'
  | 'error'

/**
 * Session review SSE event
 */
export interface SessionReviewSSEEvent extends BaseSSEEvent {
  type: SessionReviewSSEEventType
  stepName?: string // Human-readable step name
  tags?: SessionTag[]
  result?: SessionReviewResult
  // Step-specific data
  duplicateCount?: number
  impactScore?: number
  effortEstimate?: string
}

/**
 * Combined result of session review
 */
export interface SessionReviewResult {
  tags: SessionTag[]
  tagsApplied: boolean
  action: 'created' | 'upvoted' | 'skipped'
  issueId?: string
  issueTitle?: string
  skipReason?: string
  thresholdMet?: boolean
  specGenerated?: boolean
}

/**
 * GET /api/sessions/[id]/review/stream
 * Server-Sent Events endpoint for real-time session review progress
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: sessionId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error(`${LOG_PREFIX} Supabase must be configured`)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const supabase = createAdminClient()

  // Fetch the running review for this session
  const { data: runningReview, error: reviewError } = await supabase
    .from('session_reviews')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (reviewError && reviewError.code !== 'PGRST116') {
    console.error(`${LOG_PREFIX} failed to load review`, sessionId, reviewError)
    return NextResponse.json({ error: 'Failed to load review.' }, { status: 500 })
  }

  if (!runningReview) {
    return NextResponse.json({ error: 'No running review found.' }, { status: 404 })
  }

  // Get session details for the review
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, project_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    console.error(`${LOG_PREFIX} Session not found`, sessionId)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  }
  
  const runId = runningReview.run_id

  // Get the workflow
  const workflow = mastra.getWorkflow('sessionReviewWorkflow')
  if (!workflow) {
    console.error(`${LOG_PREFIX} workflow not found`)
    return NextResponse.json({ error: 'Workflow not configured.' }, { status: 500 })
  }

  return createSSEStreamWithExecutor<SessionReviewSSEEvent>({
    logPrefix: LOG_PREFIX,
    executor: async ({ emit, close, isClosed }) => {
      // Helper to create typed events
      const emitEvent = (
        type: SessionReviewSSEEventType,
        options: Partial<Omit<SessionReviewSSEEvent, 'type' | 'timestamp'>> = {}
      ) => {
        emit(createSSEEvent(type, options) as SessionReviewSSEEvent)
      }

      // Send connected event
      console.log(`${LOG_PREFIX} Sending connected event...`)
      emitEvent('connected', { message: 'Connected to session review stream' })

      try {
        // Create workflow run and start streaming
        console.log(`${LOG_PREFIX} Creating run with runId:`, runId)
        const run = await workflow.createRunAsync({ runId })

        console.log(`${LOG_PREFIX} Calling stream to execute workflow...`)
        const workflowStream = run.stream({
          inputData: {
            sessionId,
            projectId: session.project_id,
          },
        })

        let eventCount = 0
        let finalResult: SessionReviewResult | undefined
        let currentTags: SessionTag[] = []

        // Process stream events from the workflow execution
        for await (const event of workflowStream.fullStream) {
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
              emitEvent('review-start', { message: 'Starting session review' })
              break

            case 'workflow-step-start':
              switch (stepId) {
                case 'classify-session':
                  emitEvent('classify-start', { stepId, stepName: 'Classification', message: 'Analyzing session...' })
                  break
                case 'prepare-pm-context':
                  emitEvent('prepare-context-start', { stepId, stepName: 'Preparing Context', message: 'Loading session data...' })
                  break
                case 'find-duplicates':
                  emitEvent('find-duplicates-start', { stepId, stepName: 'Finding Duplicates', message: 'Searching similar issues...' })
                  break
                case 'analyze-impact':
                  emitEvent('analyze-impact-start', { stepId, stepName: 'Impact Analysis', message: 'Analyzing system impact...' })
                  break
                case 'estimate-effort':
                  emitEvent('estimate-effort-start', { stepId, stepName: 'Effort Estimation', message: 'Estimating complexity...' })
                  break
                case 'pm-decision':
                  emitEvent('pm-decision-start', { stepId, stepName: 'PM Decision', message: 'Making decision...' })
                  break
                case 'execute-decision':
                  emitEvent('execute-decision-start', { stepId, stepName: 'Executing', message: 'Applying decision...' })
                  break
              }
              break

            case 'workflow-step-output': {
              // Custom progress events from workflow steps via writer.write()
              const output =
                (payload?.output as { type?: string; message?: string }) ??
                (payload as { type?: string; message?: string })

              if (output?.type === 'progress') {
                const progressMessage = output?.message ?? 'Processing...'
                switch (stepId) {
                  case 'classify-session':
                    emitEvent('classify-progress', { stepId, stepName: 'Classification', message: progressMessage })
                    break
                  case 'prepare-pm-context':
                    emitEvent('prepare-context-progress', { stepId, stepName: 'Preparing Context', message: progressMessage })
                    break
                  case 'find-duplicates':
                    emitEvent('find-duplicates-progress', { stepId, stepName: 'Finding Duplicates', message: progressMessage })
                    break
                  case 'analyze-impact':
                    emitEvent('analyze-impact-progress', { stepId, stepName: 'Impact Analysis', message: progressMessage })
                    break
                  case 'estimate-effort':
                    emitEvent('estimate-effort-progress', { stepId, stepName: 'Effort Estimation', message: progressMessage })
                    break
                  case 'pm-decision':
                    emitEvent('pm-decision-progress', { stepId, stepName: 'PM Decision', message: progressMessage })
                    break
                  case 'execute-decision':
                    emitEvent('execute-decision-progress', { stepId, stepName: 'Executing', message: progressMessage })
                    break
                }
              }
              break
            }

            case 'workflow-step-result':
            case 'workflow-step-finish': {
              const stepResult = payload?.result as Record<string, unknown> | undefined
              switch (stepId) {
                case 'classify-session': {
                  currentTags = (stepResult?.tags as SessionTag[]) ?? []
                  emitEvent('classify-finish', {
                    stepId,
                    stepName: 'Classification',
                    message: `Applied ${currentTags.length} tag(s)`,
                    tags: currentTags,
                  })
                  break
                }
                case 'prepare-pm-context':
                  emitEvent('prepare-context-finish', {
                    stepId,
                    stepName: 'Preparing Context',
                    message: 'Context loaded',
                  })
                  break
                case 'find-duplicates': {
                  const similarIssues = (stepResult?.similarIssues as unknown[]) ?? []
                  emitEvent('find-duplicates-finish', {
                    stepId,
                    stepName: 'Finding Duplicates',
                    message: `Found ${similarIssues.length} similar issue(s)`,
                    duplicateCount: similarIssues.length,
                  })
                  break
                }
                case 'analyze-impact': {
                  const impact = stepResult?.impactAnalysis as { impactScore?: number } | null
                  emitEvent('analyze-impact-finish', {
                    stepId,
                    stepName: 'Impact Analysis',
                    message: impact?.impactScore ? `Impact: ${impact.impactScore}/5` : 'Impact analyzed',
                    impactScore: impact?.impactScore,
                  })
                  break
                }
                case 'estimate-effort': {
                  const effort = stepResult?.effortEstimation as { estimate?: string } | null
                  emitEvent('estimate-effort-finish', {
                    stepId,
                    stepName: 'Effort Estimation',
                    message: effort?.estimate ? `Effort: ${effort.estimate}` : 'Effort estimated',
                    effortEstimate: effort?.estimate,
                  })
                  break
                }
                case 'pm-decision':
                  emitEvent('pm-decision-finish', {
                    stepId,
                    stepName: 'PM Decision',
                    message: 'Decision made',
                  })
                  break
                case 'execute-decision':
                  emitEvent('execute-decision-finish', {
                    stepId,
                    stepName: 'Executing',
                    message: 'Decision applied',
                  })
                  break
              }
              break
            }

            case 'workflow-finish':
            case 'workflow-canceled': {
              // Check if the workflow finished with an error
              const workflowStatus = payload?.workflowStatus as string | undefined
              const isError = workflowStatus === 'error' || workflowStatus === 'failed'

              if (isError) {
                const errorDetails = payload?.error as string | undefined
                throw new Error(errorDetails || 'Workflow failed during execution')
              }

              // Extract final result
              finalResult = payload?.result as SessionReviewResult | undefined
              break
            }
          }
        }

        console.log(`${LOG_PREFIX} Workflow stream completed, total events:`, eventCount)

        // Build the review result
        const reviewResult: SessionReviewResult = finalResult ?? {
          tags: currentTags,
          tagsApplied: currentTags.length > 0,
          action: 'skipped',
          skipReason: 'No result from workflow',
        }

        // Update the review record with result
        await supabase
          .from('session_reviews')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: reviewResult,
          })
          .eq('id', runningReview.id)

        // Send completion event with result
        emitEvent('review-finish', {
          message: 'Session review completed',
          result: reviewResult,
        })

        close()
      } catch (error) {
        console.error(`${LOG_PREFIX} Error:`, error)

        // Mark as failed
        await supabase
          .from('session_reviews')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', runningReview.id)

        emitEvent('error', {
          message: 'Session review failed. Please try again.',
        })

        close()
      }
    },
  })
}
