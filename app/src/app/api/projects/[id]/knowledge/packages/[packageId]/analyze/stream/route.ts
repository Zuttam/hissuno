import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { mastra } from '@/mastra'
import type { WorkflowInput } from '@/mastra/workflows/knowledge-analysis/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string; packageId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[package.analyze.stream]'

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

/**
 * Map step IDs to human-readable names
 */
function getStepDisplayName(stepId: string): string {
  const stepNames: Record<string, string> = {
    'prepare-codebase': 'Preparing codebase access',
    'analyze-codebase': 'Analyzing codebase',
    'analyze-sources': 'Analyzing knowledge sources',
    'compile-knowledge': 'Compiling knowledge packages',
    'sanitize-knowledge': 'Sanitizing sensitive information',
    'save-packages': 'Saving knowledge packages',
    'embed-knowledge': 'Generating semantic embeddings',
    'cleanup-codebase': 'Cleaning up',
  }
  return stepNames[stepId] ?? stepId
}

/**
 * GET /api/projects/[id]/knowledge/packages/[packageId]/analyze/stream
 * Server-Sent Events endpoint for real-time package analysis progress
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error(`${LOG_PREFIX} Supabase must be configured`)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    // Verify package exists
    const { data: pkg, error: pkgError } = await supabase
      .from('named_knowledge_packages')
      .select('id, name')
      .eq('id', packageId)
      .eq('project_id', projectId)
      .single()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Fetch the latest running analysis for this package
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

    // Check if this analysis is for the specified package
    const analysisPackageId = (latestAnalysis.metadata as Record<string, unknown>)?.namedPackageId
    if (analysisPackageId !== packageId) {
      return NextResponse.json({ error: 'No running analysis found for this package.' }, { status: 404 })
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
        console.log(`${LOG_PREFIX} Sending connected event for package ${pkg.name}...`)
        emitEvent('connected', { message: `Connected to analysis stream for "${pkg.name}"` })

        try {
          // Get workflow input from analysis record metadata
          const workflowInput = (latestAnalysis.metadata as Record<string, unknown>)?.workflowInput as WorkflowInput | undefined

          if (!workflowInput) {
            console.error(`${LOG_PREFIX} No workflow input found in analysis record.`)
            emitEvent('error', { message: 'Analysis configuration not found. Please restart the analysis.' })
            close()
            return
          }

          console.log(`${LOG_PREFIX} Found workflow input, creating run...`)

          // Create a new run and execute the workflow
          const run = await workflow.createRunAsync({ runId })

          // Execute the workflow with stream
          const workflowStream = run.stream({ inputData: workflowInput as WorkflowInput })

          let eventCount = 0

          // Process stream events from the workflow execution
          for await (const event of workflowStream.fullStream) {
            eventCount++

            // Stop processing if controller is closed (client disconnected)
            if (isClosed()) break

            // Extract step name from payload
            const payload = 'payload' in event ? (event.payload as Record<string, unknown>) : undefined
            const stepId = payload?.stepName as string | undefined

            switch (event.type) {
              case 'workflow-start':
                emitEvent('workflow-start', { message: `Package "${pkg.name}" analysis started` })
                break

              case 'workflow-step-start':
                emitEvent('step-start', {
                  stepId,
                  stepName: getStepDisplayName(stepId ?? ''),
                  message: `Starting: ${getStepDisplayName(stepId ?? '')}`,
                })
                break

              case 'workflow-step-output': {
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
                const workflowStatus = payload?.workflowStatus as string | undefined
                const isError = workflowStatus === 'error' || workflowStatus === 'failed'

                if (isError) {
                  const errorDetails = payload?.error as string | undefined
                  throw new Error(errorDetails || 'Workflow failed during execution')
                } else {
                  emitEvent('workflow-finish', { message: `Package "${pkg.name}" analysis completed` })
                }
                break
              }
            }
          }

          console.log(`${LOG_PREFIX} Workflow stream completed, total events:`, eventCount)
          close()
        } catch (error) {
          console.error(`${LOG_PREFIX} stream error`, error)

          // Mark the analysis as failed
          try {
            const supabaseForError = await getClientForIdentity(identity)
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

          emitEvent('error', {
            message: 'Analysis encountered an issue. Please try again.',
          })

          close()
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
    return NextResponse.json({ error: 'Failed to stream analysis.' }, { status: 500 })
  }
}
