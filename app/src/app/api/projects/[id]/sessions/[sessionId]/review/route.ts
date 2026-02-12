import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getSessionById } from '@/lib/supabase/sessions'
import { enforceLimit, LimitExceededError } from '@/lib/billing/enforcement-service'
import type { SessionTag } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { id: string; sessionId: string }

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
 * GET /api/projects/[id]/sessions/[sessionId]/review
 * Get the current session review status
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: projectId, sessionId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[sessions.review.status] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Verify the session belongs to this project
    const existingSession = await getSessionById(sessionId)
    if (!existingSession || existingSession.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // Get latest review for this session
    const { data: latestReview, error: reviewError } = await adminClient
      .from('session_reviews')
      .select('*')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (reviewError && reviewError.code !== 'PGRST116') {
      console.error('[sessions.review.status] Failed to fetch review:', reviewError)
      return NextResponse.json({ error: 'Failed to fetch review status.' }, { status: 500 })
    }

    const response: SessionReviewStatusResponse = {
      isRunning: latestReview?.status === 'running',
      reviewId: latestReview?.id ?? null,
      runId: latestReview?.run_id ?? null,
      status: latestReview?.status ?? null,
      startedAt: latestReview?.started_at ?? null,
      completedAt: latestReview?.completed_at ?? null,
      result: (latestReview?.result as SessionReviewResult) ?? null,
      error: latestReview?.error_message ?? null,
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.review.status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch review status.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/sessions/[sessionId]/review
 * Trigger session review (classification + PM review).
 * Creates a review record and returns immediately.
 * The actual analysis runs in the SSE stream endpoint.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { id: projectId, sessionId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[sessions.review] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Verify the session belongs to this project
    const existingSession = await getSessionById(sessionId)
    if (!existingSession || existingSession.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Enforce analyzed sessions limit for project owner
    try {
      await enforceLimit({
        userId: user.id,
        dimension: 'analyzed_sessions',
      })
    } catch (error) {
      if (error instanceof LimitExceededError) {
        return NextResponse.json(error.toResponse(), { status: 429 })
      }
      throw error
    }

    const adminClient = createAdminClient()

    // Check for existing running review
    const { data: runningReview, error: runningError } = await adminClient
      .from('session_reviews')
      .select('id, run_id')
      .eq('session_id', sessionId)
      .eq('status', 'running')
      .single()

    if (runningError && runningError.code !== 'PGRST116') {
      console.error('[sessions.review] Error checking for running review:', runningError)
      return NextResponse.json({ error: 'Failed to check review status.' }, { status: 500 })
    }

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

    const { data: reviewRecord, error: insertError } = await adminClient
      .from('session_reviews')
      .insert({
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
      .select()
      .single()

    if (insertError) {
      // Check if it's a unique constraint violation (concurrent request)
      if (insertError.code === '23505') {
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

    return NextResponse.json({
      message: 'Session review started',
      status: 'processing',
      runId,
      reviewId: reviewRecord.id,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.review] unexpected error', error)
    return NextResponse.json({ error: 'Unable to start session review.' }, { status: 500 })
  }
}
