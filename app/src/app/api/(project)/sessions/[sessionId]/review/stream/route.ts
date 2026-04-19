import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { sessions, sessionReviews } from '@/lib/db/schema/app'
import { eq, and, desc } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getSessionById } from '@/lib/db/queries/sessions'
import { getSessionMessages } from '@/lib/db/queries/session-messages'
import { getGraphEvaluationSettingsAdmin } from '@/lib/db/queries/graph-evaluation-settings'
import { evaluateEntityRelationships } from '@/mastra/workflows/graph-evaluation'
import type { CreationContext } from '@/mastra/workflows/graph-evaluation/schemas'
import { createSSEStreamWithExecutor, createSSEEvent, BaseSSEEvent } from '@/lib/utils/sse'
import type { SessionTag } from '@/types/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { sessionId: string }

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
  | 'graph-eval-start'
  | 'graph-eval-progress'
  | 'graph-eval-finish'
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
}

/**
 * Combined result of session review
 */
export interface SessionReviewResult {
  tags: SessionTag[]
  tagsApplied: boolean
  action: 'created' | 'linked' | 'skipped'
  issueId?: string
  issueName?: string
  issueResults?: Array<{
    action: 'created' | 'linked' | 'skipped'
    issueId?: string
    issueName?: string
  }>
  skipReason?: string
}


/**
 * GET /api/sessions/[sessionId]/review/stream?projectId=...
 * Server-Sent Events endpoint for real-time session review progress
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error(`${LOG_PREFIX} Database must be configured`)
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify the session belongs to this project
    const existingSession = await getSessionById(sessionId)
    if (!existingSession || existingSession.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Fetch the running review for this session
    const [runningReview] = await db
      .select()
      .from(sessionReviews)
      .where(
        and(
          eq(sessionReviews.session_id, sessionId),
          eq(sessionReviews.status, 'running'),
        )
      )
      .orderBy(desc(sessionReviews.started_at))
      .limit(1)

    if (!runningReview) {
      return NextResponse.json({ error: 'No running review found.' }, { status: 404 })
    }

    return createSSEStreamWithExecutor<SessionReviewSSEEvent>({
      logPrefix: LOG_PREFIX,
      executor: async ({ emit, close, isClosed }) => {
        const emitEvent = (
          type: SessionReviewSSEEventType,
          options: Partial<Omit<SessionReviewSSEEvent, 'type' | 'timestamp'>> = {}
        ) => {
          emit(createSSEEvent(type, options) as SessionReviewSSEEvent)
        }

        console.log(`${LOG_PREFIX} Sending connected event...`)
        emitEvent('connected', { message: 'Connected to session review stream' })

        try {
          emitEvent('review-start', { message: 'Starting session review...' })

          // Fetch session data and messages in parallel
          emitEvent('graph-eval-start', { stepName: 'Graph Evaluation', message: 'Loading session data...' })

          const [sessionRow, messages, graphConfig] = await Promise.all([
            db.query.sessions.findFirst({
              where: eq(sessions.id, sessionId),
              columns: { tags: true, user_metadata: true },
            }),
            getSessionMessages(sessionId),
            getGraphEvaluationSettingsAdmin(projectId),
          ])

          if (isClosed()) return

          const tags = ((sessionRow?.tags ?? []) as SessionTag[])
          const userMetadata = (sessionRow?.user_metadata as Record<string, string> | null) ?? null

          // Always build creation context for sessions; per-entity gating lives inside the workflow.
          const creationContext: CreationContext = {
            tags,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
            userMetadata,
          }

          emitEvent('graph-eval-progress', { stepName: 'Graph Evaluation', message: 'Evaluating relationships...' })

          // Run unified graph evaluation with creation policies (or discovery only)
          const evalResult = await evaluateEntityRelationships(projectId, 'session', sessionId, creationContext, graphConfig)

          if (isClosed()) return

          emitEvent('graph-eval-finish', { stepName: 'Graph Evaluation', message: 'Evaluation complete' })

          // Build review result from graph eval output
          const action: SessionReviewResult['action'] = evalResult.pmAction ?? 'skipped'
          const evalIssueResults = evalResult.issueResults ?? []
          const firstResult = evalIssueResults[0]

          const reviewResult: SessionReviewResult = {
            tags,
            tagsApplied: tags.length > 0,
            action,
            issueId: firstResult?.issueId ?? undefined,
            issueName: firstResult?.issueName ?? undefined,
            skipReason: evalResult.pmSkipReason ?? undefined,
          }

          if (evalIssueResults.length > 0) {
            reviewResult.issueResults = evalIssueResults.map(r => ({
              action: r.action,
              issueId: r.issueId ?? undefined,
              issueName: r.issueName ?? undefined,
            }))
          }

          // Update review record
          await db
            .update(sessionReviews)
            .set({ status: 'completed', completed_at: new Date(), result: reviewResult })
            .where(eq(sessionReviews.id, runningReview.id))

          emitEvent('review-finish', { message: 'Session review completed', result: reviewResult })
          close()
        } catch (error) {
          console.error(`${LOG_PREFIX} Error:`, error)
          await db
            .update(sessionReviews)
            .set({ status: 'failed', completed_at: new Date(), error_message: error instanceof Error ? error.message : 'Unknown error' })
            .where(eq(sessionReviews.id, runningReview.id))
          emitEvent('error', { message: 'Session review failed. Please try again.' })
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
    return NextResponse.json({ error: 'Failed to stream session review.' }, { status: 500 })
  }
}
