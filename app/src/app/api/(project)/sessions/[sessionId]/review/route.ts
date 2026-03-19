import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { isUniqueViolation } from '@/lib/db/errors'
import { sessionReviews } from '@/lib/db/schema/app'
import { eq, and, desc } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getSessionById } from '@/lib/db/queries/sessions'
import type { SessionTag } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { sessionId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * Session review status response
 */
export interface SessionReviewStatusResponse {
  isRunning: boolean
  reviewId: string | null
  runId: string | null
  status: 'running' | 'completed' | 'failed' | 'skipped' | null
  startedAt: string | null
  completedAt: string | null
  result: SessionReviewResult | null
  error: string | null
}

/**
 * Combined result of session review (classification + PM review)
 */
export interface SessionReviewResult {
  // Classification
  tags: SessionTag[]
  tagsApplied: boolean
  // PM Review
  action: 'created' | 'upvoted' | 'skipped'
  issueId?: string
  issueTitle?: string
  skipReason?: string
}

/**
 * GET /api/sessions/[sessionId]/review?projectId=...
 * Get the current session review status
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[sessions.review.status] Database must be configured')
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

    // Get latest review for this session
    const [latestReview] = await db
      .select()
      .from(sessionReviews)
      .where(eq(sessionReviews.session_id, sessionId))
      .orderBy(desc(sessionReviews.started_at))
      .limit(1)

    const response: SessionReviewStatusResponse = {
      isRunning: latestReview?.status === 'running',
      reviewId: latestReview?.id ?? null,
      runId: latestReview?.run_id ?? null,
      status: latestReview?.status as SessionReviewStatusResponse['status'] ?? null,
      startedAt: latestReview?.started_at?.toISOString() ?? null,
      completedAt: latestReview?.completed_at?.toISOString() ?? null,
      result: (latestReview?.result as SessionReviewResult) ?? null,
      error: latestReview?.error_message ?? null,
    }

    return NextResponse.json(response)
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

    console.error('[sessions.review.status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch review status.' }, { status: 500 })
  }
}

/**
 * POST /api/sessions/[sessionId]/review?projectId=...
 * Trigger session review (classification + PM review).
 * Creates a review record and returns immediately.
 * The actual analysis runs in the SSE stream endpoint.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[sessions.review] Database must be configured')
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

    // Check for existing running review
    const [runningReview] = await db
      .select({ id: sessionReviews.id, run_id: sessionReviews.run_id })
      .from(sessionReviews)
      .where(
        and(
          eq(sessionReviews.session_id, sessionId),
          eq(sessionReviews.status, 'running'),
        )
      )
      .limit(1)

    if (runningReview) {
      return NextResponse.json(
        {
          error: 'Review is already in progress',
          runId: runningReview.run_id,
          reviewId: runningReview.id,
        },
        { status: 409 }
      )
    }

    // Generate run ID and create review record
    const runId = `session-review-${sessionId}-${Date.now()}`

    try {
      const [reviewRecord] = await db
        .insert(sessionReviews)
        .values({
          session_id: sessionId,
          project_id: projectId,
          run_id: runId,
          status: 'running',
          metadata: {
            triggeredBy: 'manual',
            sessionId,
            projectId,
            type: 'session-review', // Distinguish from old pm-review
          },
        })
        .returning()

      return NextResponse.json({
        message: 'Session review started',
        status: 'processing',
        runId,
        reviewId: reviewRecord.id,
      })
    } catch (insertError: unknown) {
      // Check if it's a unique constraint violation (concurrent request)
      if (isUniqueViolation(insertError)) {
        return NextResponse.json(
          {
            error: 'Review is already in progress',
          },
          { status: 409 }
        )
      }
      console.error('[sessions.review] Failed to create review record:', insertError)
      return NextResponse.json({ error: 'Failed to start review.' }, { status: 500 })
    }
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

    console.error('[sessions.review] unexpected error', error)
    return NextResponse.json({ error: 'Unable to start session review.' }, { status: 500 })
  }
}
