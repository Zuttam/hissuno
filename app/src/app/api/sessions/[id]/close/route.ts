import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Get CORS headers for response
 */
function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Public-Key',
  }
}

/**
 * OPTIONS /api/sessions/[id]/close
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  })
}

/**
 * POST /api/sessions/[id]/close
 * Closes a session and optionally triggers async PM agent analysis.
 *
 * Request body:
 * - triggerPMReview: boolean (default: true) - whether to run PM analysis
 *
 * Response:
 * - success: boolean
 * - pmReviewTriggered?: boolean - whether PM review was triggered
 * - runId?: string - PM review run ID if triggered
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const corsHeaders = getCorsHeaders(request)

  if (!isSupabaseConfigured()) {
    console.error('[sessions.close] Supabase must be configured')
    return NextResponse.json(
      { error: 'Supabase must be configured.' },
      { status: 500, headers: corsHeaders }
    )
  }

  try {
    const { id: sessionId } = await params
    const body = await request.json().catch(() => ({}))
    const triggerPMReview = body.triggerPMReview ?? true

    const supabase = createAdminClient()

    // Get session to verify it exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, project_id, status')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found.' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Update session status to closed
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('[sessions.close] Failed to close session:', updateError)
      return NextResponse.json(
        { error: 'Failed to close session.' },
        { status: 500, headers: corsHeaders }
      )
    }

    let pmReviewTriggered = false
    let runId: string | undefined

    // Trigger async PM review if requested
    if (triggerPMReview) {
      try {
        // Check if a review is already running
        const { data: existingReview } = await supabase
          .from('pm_reviews')
          .select('id, run_id')
          .eq('session_id', sessionId)
          .eq('status', 'running')
          .single()

        if (existingReview) {
          // Review already in progress
          pmReviewTriggered = true
          runId = existingReview.run_id
        } else {
          // Create new pm_reviews record for async execution
          runId = `pm-review-${sessionId}-${Date.now()}`

          const { error: insertError } = await supabase
            .from('pm_reviews')
            .insert({
              session_id: sessionId,
              project_id: session.project_id,
              run_id: runId,
              status: 'running',
              metadata: {
                triggeredBy: 'session-close',
                sessionId,
                projectId: session.project_id,
              },
            })

          if (insertError) {
            // Check for unique constraint violation (race condition)
            if (insertError.code === '23505') {
              console.log('[sessions.close] PM review already in progress (race condition)')
              pmReviewTriggered = true
            } else {
              console.error('[sessions.close] Failed to create PM review record:', insertError)
              // Don't fail the close operation if PM review trigger fails
            }
          } else {
            pmReviewTriggered = true
          }
        }
      } catch (pmError) {
        console.error('[sessions.close] Failed to trigger PM review:', pmError)
        // Don't fail the close operation if PM review fails
      }
    }

    return NextResponse.json(
      { success: true, pmReviewTriggered, runId },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('[sessions.close] unexpected error', error)
    return NextResponse.json(
      { error: 'Unable to close session.' },
      { status: 500, headers: corsHeaders }
    )
  }
}
