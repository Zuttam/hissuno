import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgePackages, compilationRuns, knowledgeSources } from '@/lib/db/schema/app'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { mastra } from '@/mastra'
import type { WorkflowInput } from '@/mastra/workflows/package-compilation/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { packageId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[package.compile.stream]'

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
    'compile-package': 'Compiling knowledge package',
  }
  return stepNames[stepId] ?? stepId
}

/**
 * Reset source statuses from "analyzing" back to "pending" for a failed/cancelled run.
 */
async function resetSourceStatuses(metadata: Record<string, unknown>) {
  const sourceIds = metadata?.sourceIds as string[] | undefined
  if (!sourceIds || sourceIds.length === 0) return

  try {
    await db
      .update(knowledgeSources)
      .set({ status: 'pending', error_message: 'Analysis interrupted' })
      .where(
        and(
          inArray(knowledgeSources.id, sourceIds),
          eq(knowledgeSources.status, 'analyzing')
        )
      )
  } catch (resetErr) {
    console.error(`${LOG_PREFIX} Failed to reset source statuses:`, resetErr)
  }
}

/**
 * GET /api/knowledge/packages/[packageId]/analyze/stream
 * Server-Sent Events endpoint for real-time package analysis progress
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error(`${LOG_PREFIX} Database must be configured`)
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify package exists
    const [pkg] = await db
      .select({ id: knowledgePackages.id, name: knowledgePackages.name })
      .from(knowledgePackages)
      .where(
        and(
          eq(knowledgePackages.id, packageId),
          eq(knowledgePackages.project_id, projectId)
        )
      )
      .limit(1)

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Fetch the latest running analysis for this package
    const [latestAnalysis] = await db
      .select()
      .from(compilationRuns)
      .where(
        and(
          eq(compilationRuns.project_id, projectId),
          eq(compilationRuns.status, 'running')
        )
      )
      .orderBy(desc(compilationRuns.started_at))
      .limit(1)

    if (!latestAnalysis) {
      return NextResponse.json({ error: 'No running analysis found.' }, { status: 404 })
    }

    // Check if this analysis is for the specified package
    const analysisPackageId = (latestAnalysis.metadata as Record<string, unknown>)?.packageId
    if (analysisPackageId !== packageId) {
      return NextResponse.json({ error: 'No running analysis found for this package.' }, { status: 404 })
    }

    const runId = latestAnalysis.run_id

    // Get the workflow
    const workflow = mastra.getWorkflow('packageCompilationWorkflow')
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
        emitEvent('connected', { message: `Connected to compilation stream for "${pkg.name}"` })

        try {
          // Get workflow input from analysis record metadata
          const workflowInput = (latestAnalysis.metadata as Record<string, unknown>)?.workflowInput as WorkflowInput | undefined

          if (!workflowInput) {
            console.error(`${LOG_PREFIX} No workflow input found in analysis record.`)
            await resetSourceStatuses(latestAnalysis.metadata as Record<string, unknown>)
            await db
              .update(compilationRuns)
              .set({ status: 'failed', completed_at: new Date(), error_message: 'No workflow input' })
              .where(eq(compilationRuns.id, latestAnalysis.id))
            emitEvent('error', { message: 'Compilation configuration not found. Please restart the compilation.' })
            close()
            return
          }

          console.log(`${LOG_PREFIX} Found workflow input with ${(workflowInput.sources ?? []).length} source(s), creating run...`)

          // Create a new run and execute the workflow
          const run = await workflow.createRunAsync({ runId })
          console.log(`${LOG_PREFIX} Run created, starting stream...`)

          // Execute the workflow with stream
          const workflowStream = run.stream({ inputData: workflowInput as WorkflowInput })

          let eventCount = 0
          let clientDisconnected = false
          let workflowFinishedInStream = false

          // Process stream events from the workflow execution
          for await (const event of workflowStream.fullStream) {
            eventCount++

            // Stop emitting to client if disconnected, but keep consuming events
            if (isClosed()) {
              if (!clientDisconnected) {
                clientDisconnected = true
                console.log(`${LOG_PREFIX} Client disconnected after ${eventCount} events, continuing workflow...`)
              }
            }

            // Extract step name from payload
            const payload = 'payload' in event ? (event.payload as Record<string, unknown>) : undefined
            const stepId = payload?.stepName as string | undefined

            // Log all events for debugging
            console.log(`${LOG_PREFIX} Event #${eventCount}: ${event.type}${stepId ? ` (${stepId})` : ''}`)

            switch (event.type) {
              case 'workflow-start':
                if (!clientDisconnected) emitEvent('workflow-start', { message: `Compiling package "${pkg.name}"` })
                break

              case 'workflow-step-start':
                if (!clientDisconnected) emitEvent('step-start', {
                  stepId,
                  stepName: getStepDisplayName(stepId ?? ''),
                  message: `Starting: ${getStepDisplayName(stepId ?? '')}`,
                })
                break

              case 'workflow-step-output': {
                const output = (payload?.output as { type?: string; message?: string })
                  ?? (payload as { type?: string; message?: string })

                if (output?.type === 'progress' && !clientDisconnected) {
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
                if (!clientDisconnected) emitEvent('step-finish', {
                  stepId,
                  stepName: getStepDisplayName(stepId ?? ''),
                  message: `Completed: ${getStepDisplayName(stepId ?? '')}`,
                })
                break

              case 'workflow-finish':
              case 'workflow-canceled': {
                workflowFinishedInStream = true
                const workflowStatus = payload?.workflowStatus as string | undefined
                const isError = workflowStatus === 'error' || workflowStatus === 'failed'

                if (isError) {
                  const errorDetails = payload?.error as string | undefined
                  throw new Error(errorDetails || 'Workflow failed during execution')
                } else {
                  if (!clientDisconnected) emitEvent('workflow-finish', { message: `Package "${pkg.name}" compilation completed` })

                  // Mark analysis as completed
                  try {
                    await db
                      .update(compilationRuns)
                      .set({ status: 'completed', completed_at: new Date() })
                      .where(eq(compilationRuns.id, latestAnalysis.id))
                    console.log(`${LOG_PREFIX} Marked compilation run as completed`)
                  } catch (dbError) {
                    console.error(`${LOG_PREFIX} Failed to mark analysis as completed:`, dbError)
                  }
                }
                break
              }
            }
          }

          // If the stream ended without a workflow-finish event (e.g. stream consumed fully),
          // await the result to ensure completion and update the DB record
          if (!workflowFinishedInStream) {
            console.log(`${LOG_PREFIX} Stream ended without workflow-finish, awaiting result...`)
            try {
              const result = await workflowStream.result
              const isSuccess = result?.status === 'success'
              console.log(`${LOG_PREFIX} Workflow result: ${result?.status}`)

              await db
                .update(compilationRuns)
                .set({
                  status: isSuccess ? 'completed' : 'failed',
                  completed_at: new Date(),
                  error_message: isSuccess ? null : 'Workflow did not complete successfully',
                })
                .where(eq(compilationRuns.id, latestAnalysis.id))

              if (!isSuccess) {
                await resetSourceStatuses(latestAnalysis.metadata as Record<string, unknown>)
              }
            } catch (resultErr) {
              console.error(`${LOG_PREFIX} Error awaiting workflow result:`, resultErr)
              await db
                .update(compilationRuns)
                .set({ status: 'failed', completed_at: new Date(), error_message: 'Workflow result error' })
                .where(eq(compilationRuns.id, latestAnalysis.id))
              await resetSourceStatuses(latestAnalysis.metadata as Record<string, unknown>)
            }
          }

          console.log(`${LOG_PREFIX} Workflow stream completed, total events:`, eventCount)
          close()
        } catch (error) {
          console.error(`${LOG_PREFIX} stream error`, error)

          // Mark the analysis as failed
          try {
            await db
              .update(compilationRuns)
              .set({
                status: 'failed',
                completed_at: new Date(),
                error_message: error instanceof Error ? error.message : 'Stream error',
              })
              .where(eq(compilationRuns.id, latestAnalysis.id))
          } catch (dbError) {
            console.error(`${LOG_PREFIX} Failed to update analysis record:`, dbError)
          }

          // Reset any sources stuck in "analyzing" back to "pending"
          await resetSourceStatuses(latestAnalysis.metadata as Record<string, unknown>)

          emitEvent('error', {
            message: 'Compilation encountered an issue. Please try again.',
          })

          close()
        }
      },
    })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error(`${LOG_PREFIX} unexpected error`, error)
    return NextResponse.json({ error: 'Failed to stream compilation.' }, { status: 500 })
  }
}
