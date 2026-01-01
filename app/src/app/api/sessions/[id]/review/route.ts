import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { SessionTag } from '@/types/session'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Session review status response
 */
export interface SessionReviewStatusResponse {
  isRunning: boolean
  reviewId: string | null
  runId: string | null
  status: 'running' | 'completed' | 'failed' | null
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
  thresholdMet?: boolean
  specGenerated?: boolean
}

/**
 * GET /api/sessions/[id]/review
 * Get the current session review status
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.review.status] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params
    const supabase = createAdminClient()

    // Get latest review for this session
    const { data: latestReview, error: reviewError } = await supabase
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
    console.error('[sessions.review.status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch review status.' }, { status: 500 })
  }
}

/**
 * POST /api/sessions/[id]/review
 * Trigger session review (classification + PM review).
 * Creates a review record and returns immediately.
 * The actual analysis runs in the SSE stream endpoint.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.review] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params
    const supabase = createAdminClient()

    // Get session to verify it exists and get project ID
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, project_id, pm_reviewed_at')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Check for existing running review
    const { data: runningReview, error: runningError } = await supabase
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
      return NextResponse.json({
        error: 'Review is already in progress',
        runId: runningReview.run_id,
        reviewId: runningReview.id,
      }, { status: 409 })
    }

    // Generate run ID and create review record
    const runId = `session-review-${sessionId}-${Date.now()}`

    const { data: reviewRecord, error: insertError } = await supabase
      .from('session_reviews')
      .insert({
        session_id: sessionId,
        project_id: session.project_id,
        run_id: runId,
        status: 'running',
        metadata: {
          triggeredBy: 'manual',
          sessionId,
          projectId: session.project_id,
          type: 'session-review', // Distinguish from old pm-review
        },
      })
      .select()
      .single()

    if (insertError) {
      // Check if it's a unique constraint violation (concurrent request)
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: 'Review is already in progress',
        }, { status: 409 })
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
    console.error('[sessions.review] unexpected error', error)
    return NextResponse.json({ error: 'Unable to start session review.' }, { status: 500 })
  }
}
