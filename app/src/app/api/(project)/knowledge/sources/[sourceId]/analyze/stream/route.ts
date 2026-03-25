import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { compilationRuns, knowledgeSources } from '@/lib/db/schema/app'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/utils/sse'
import { mastra } from '@/mastra'
import type { SourceAnalysisInput } from '@/mastra/workflows/source-analysis/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { sourceId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[source.analyze.stream]'

type SourceSSEEventType =
  | 'connected'
  | 'workflow-start'
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'step-error'
  | 'workflow-finish'
  | 'error'

interface SourceSSEEvent extends BaseSSEEvent {
  type: SourceSSEEventType
}

function getStepDisplayName(stepId: string): string {
  const stepNames: Record<string, string> = {
    'fetch-content': 'Fetching and analyzing content',
    'sanitize-content': 'Scanning for sensitive information',
    'save-and-embed': 'Saving and generating embeddings',
    'trigger-graph-eval': 'Discovering related entities',
  }
  return stepNames[stepId] ?? stepId
}

/**
 * GET /api/knowledge/sources/[sourceId]/analyze/stream
 * SSE endpoint for real-time source analysis progress
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Fetch the source
    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.project_id, projectId)
        )
      )
      .limit(1)

    if (!source) {
      return NextResponse.json({ error: 'Source not found.' }, { status: 404 })
    }

    // Find the running analysis for this source
    const latestAnalysis = await db
      .select()
      .from(compilationRuns)
      .where(
        and(
          eq(compilationRuns.project_id, projectId),
          eq(compilationRuns.status, 'running')
        )
      )
      .orderBy(desc(compilationRuns.started_at))
      .limit(5)

    const sourceAnalysis = latestAnalysis.find((a) => {
      const metadata = a.metadata as Record<string, unknown> | null
      return metadata?.type === 'source_analysis' && metadata?.sourceId === sourceId
    })

    if (!sourceAnalysis) {
      return NextResponse.json({ error: 'No running analysis found for this source.' }, { status: 404 })
    }

    const workflow = mastra.getWorkflow('sourceAnalysisWorkflow')
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not configured.' }, { status: 500 })
    }

    return createSSEStreamWithExecutor<SourceSSEEvent>({
      logPrefix: LOG_PREFIX,
      executor: async ({ emit, close, isClosed }) => {
        const emitEvent = (
          type: SourceSSEEventType,
          options: Partial<Omit<SourceSSEEvent, 'type' | 'timestamp'>> = {}
        ) => {
          emit(createSSEEvent(type, options) as SourceSSEEvent)
        }

        emitEvent('connected', { message: 'Connected to source analysis stream' })

        try {
          const workflowInput: SourceAnalysisInput = {
            projectId,
            sourceId,
            sourceType: source.type as SourceAnalysisInput['sourceType'],
            url: source.url,
            storagePath: source.storage_path,
            content: source.content,
            analysisScope: source.analysis_scope ?? null,
            notionPageId: source.notion_page_id ?? null,
            origin: (source as Record<string, unknown>).origin as string | null ?? null,
            sourceName: source.name ?? null,
          }

          const run = await workflow.createRunAsync({ runId: sourceAnalysis.run_id })
          const workflowStream = run.stream({ inputData: workflowInput })

          for await (const event of workflowStream.fullStream) {
            if (isClosed()) break

            const payload = 'payload' in event ? (event.payload as Record<string, unknown>) : undefined
            const stepId = payload?.stepName as string | undefined

            switch (event.type) {
              case 'workflow-start':
                emitEvent('workflow-start', { message: 'Source analysis started' })
                break

              case 'workflow-step-start':
                emitEvent('step-start', {
                  stepId,
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
                  })
                }
                break
              }

              case 'workflow-step-result':
              case 'workflow-step-finish':
                emitEvent('step-finish', {
                  stepId,
                  message: `Completed: ${getStepDisplayName(stepId ?? '')}`,
                })
                break

              case 'workflow-finish':
              case 'workflow-canceled': {
                const workflowStatus = payload?.workflowStatus as string | undefined
                const isError = workflowStatus === 'error' || workflowStatus === 'failed'

                if (isError) {
                  throw new Error((payload?.error as string) || 'Workflow failed')
                } else {
                  // Mark analysis as completed
                  await db
                    .update(compilationRuns)
                    .set({
                      status: 'completed',
                      completed_at: new Date(),
                    })
                    .where(eq(compilationRuns.id, sourceAnalysis.id))

                  emitEvent('workflow-finish', { message: 'Source analysis completed' })
                }
                break
              }
            }
          }

          close()
        } catch (error) {
          console.error(`${LOG_PREFIX} stream error`, error)

          try {
            await db
              .update(compilationRuns)
              .set({
                status: 'failed',
                completed_at: new Date(),
                error_message: error instanceof Error ? error.message : 'Stream error',
              })
              .where(eq(compilationRuns.id, sourceAnalysis.id))

            // Also update source status
            await db
              .update(knowledgeSources)
              .set({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Analysis failed',
              })
              .where(eq(knowledgeSources.id, sourceId))
          } catch {
            // Best effort
          }

          emitEvent('error', { message: 'Analysis encountered an issue. Please try again.' })
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
    return NextResponse.json({ error: 'Failed to stream analysis.' }, { status: 500 })
  }
}
