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
 * Closes a session and triggers async session review (classification + PM analysis).
 *
 * Response:
 * - success: boolean
 * - reviewTriggered: boolean - whether session review was triggered
 * - runId?: string - review run ID if triggered
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
    // Consume body (backwards compatible with old widgets that still send it)
    await request.json().catch(() => ({}))

    const supabase = createAdminClient()

    // Get session to verify it exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, project_id, status')
      .eq('id', sessionId)
      .single()

    // If session doesn't exist, return success (idempotent close)
    // This handles the case where close is called before any message was sent
    if (sessionError || !session) {
      return NextResponse.json(
        { success: true, reviewTriggered: false },
        { headers: corsHeaders }
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

    let reviewTriggered = false
    let runId: string | undefined

    // Trigger async session review
    try {
      // Check if a review is already running
      const { data: existingReview } = await supabase
        .from('session_reviews')
        .select('id, run_id')
        .eq('session_id', sessionId)
        .eq('status', 'running')
        .single()

      if (existingReview) {
        // Review already in progress
        reviewTriggered = true
        runId = existingReview.run_id
      } else {
        // Create new review record for async execution
        runId = `session-review-${sessionId}-${Date.now()}`

        const { error: insertError } = await supabase
          .from('session_reviews')
          .insert({
            session_id: sessionId,
            project_id: session.project_id,
            run_id: runId,
            status: 'running',
            metadata: {
              triggeredBy: 'session-close',
              sessionId,
              projectId: session.project_id,
              type: 'session-review',
            },
          })

        if (insertError) {
          // Check for unique constraint violation (race condition)
          if (insertError.code === '23505') {
            console.log('[sessions.close] Session review already in progress (race condition)')
            reviewTriggered = true
          } else {
            console.error('[sessions.close] Failed to create review record:', insertError)
            // Don't fail the close operation if review trigger fails
          }
        } else {
          reviewTriggered = true
        }
      }
    } catch (reviewError) {
      console.error('[sessions.close] Failed to trigger session review:', reviewError)
      // Don't fail the close operation if review fails
    }

    return NextResponse.json(
      { success: true, reviewTriggered, runId },
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
