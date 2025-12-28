import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { PMReviewStatusResponse, PMReviewResult } from '@/types/issue'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/sessions/[id]/pm-review
 * Get the current PM review status for a session
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.pm-review.status] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params
    const supabase = createAdminClient()

    // Get latest review for this session
    const { data: latestReview, error: reviewError } = await supabase
      .from('pm_reviews')
      .select('*')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (reviewError && reviewError.code !== 'PGRST116') {
      console.error('[sessions.pm-review.status] Failed to fetch review:', reviewError)
      return NextResponse.json({ error: 'Failed to fetch review status.' }, { status: 500 })
    }

    const response: PMReviewStatusResponse = {
      isRunning: latestReview?.status === 'running',
      reviewId: latestReview?.id ?? null,
      runId: latestReview?.run_id ?? null,
      status: latestReview?.status ?? null,
      startedAt: latestReview?.started_at ?? null,
      completedAt: latestReview?.completed_at ?? null,
      result: (latestReview?.result as PMReviewResult) ?? null,
      error: latestReview?.error_message ?? null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[sessions.pm-review.status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch review status.' }, { status: 500 })
  }
}

/**
 * POST /api/sessions/[id]/pm-review
 * Trigger async PM review analysis on a session.
 * Creates a pm_reviews record and returns immediately.
 * The actual analysis runs in the SSE stream endpoint.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.pm-review] Supabase must be configured')
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
      .from('pm_reviews')
      .select('id, run_id')
      .eq('session_id', sessionId)
      .eq('status', 'running')
      .single()

    if (runningError && runningError.code !== 'PGRST116') {
      console.error('[sessions.pm-review] Error checking for running review:', runningError)
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
    const runId = `pm-review-${sessionId}-${Date.now()}`

    const { data: reviewRecord, error: insertError } = await supabase
      .from('pm_reviews')
      .insert({
        session_id: sessionId,
        project_id: session.project_id,
        run_id: runId,
        status: 'running',
        metadata: {
          triggeredBy: 'manual',
          sessionId,
          projectId: session.project_id,
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
      console.error('[sessions.pm-review] Failed to create review record:', insertError)
      return NextResponse.json({ error: 'Failed to start review.' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'PM review started',
      status: 'processing',
      runId,
      reviewId: reviewRecord.id,
    })
  } catch (error) {
    console.error('[sessions.pm-review] unexpected error', error)
    return NextResponse.json({ error: 'Unable to start PM review.' }, { status: 500 })
  }
}
