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
          const { analyzeSource } = await import('@/lib/knowledge/knowledge-service')

          emitEvent('workflow-start', { message: 'Source analysis started' })

          const result = await analyzeSource(
            {
              projectId,
              sourceId,
              sourceType: source.type as 'website' | 'docs_portal' | 'uploaded_doc' | 'raw_text' | 'codebase' | 'notion',
              url: source.url,
              storagePath: source.storage_path,
              content: source.content,
              analysisScope: source.analysis_scope ?? null,
              notionPageId: source.notion_page_id ?? null,
              origin: (source as Record<string, unknown>).origin as string | null ?? null,
              sourceName: source.name ?? null,
            },
            {
              onProgress: (step, message) => {
                if (!isClosed()) {
                  emitEvent('step-progress', { stepId: step, message })
                }
              },
            }
          )

          // Mark compilation run as completed
          await db
            .update(compilationRuns)
            .set({ status: 'completed', completed_at: new Date() })
            .where(eq(compilationRuns.id, sourceAnalysis.id))

          if (result.errors.length > 0) {
            emitEvent('step-progress', { message: `Completed with ${result.errors.length} warning(s)` })
          }
          emitEvent('workflow-finish', { message: 'Source analysis completed' })
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
