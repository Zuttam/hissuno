import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { checkEnforcement } from '@/lib/billing/enforcement-service'
import { getProjectById } from '@/lib/projects/keys'
import { isOriginAllowed, verifyWidgetJWT } from '@/lib/utils/widget-auth'

export const runtime = 'nodejs'

interface CloseRequestBody {
  sessionId: string
  projectId: string
  widgetToken?: string
}

/**
 * Get the request origin from headers
 * Uses Origin header if present, otherwise falls back to request URL origin
 */
function getRequestOrigin(request: NextRequest): string {
  return request.headers.get('Origin') || request.nextUrl.origin
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, origin: string): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

/**
 * OPTIONS /api/agent/session/close
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const origin = getRequestOrigin(request)

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/**
 * POST /api/agent/session/close
 * Closes a session and triggers async session review (classification + PM analysis).
 *
 * Request Body:
 * - sessionId: string
 * - projectId: string
 * - widgetToken?: string (optional JWT token for authentication)
 *
 * Response:
 * - success: boolean
 * - reviewTriggered: boolean - whether session review was triggered
 * - runId?: string - review run ID if triggered
 */
export async function POST(request: NextRequest) {
  const origin = getRequestOrigin(request)

  if (!isSupabaseConfigured()) {
    console.error('[agent/session/close] Supabase must be configured')
    return addCorsHeaders(
      NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 }),
      origin
    )
  }

  try {
    const body = (await request.json()) as CloseRequestBody
    const { sessionId, projectId, widgetToken } = body

    if (!sessionId) {
      return addCorsHeaders(
        NextResponse.json({ error: 'sessionId is required' }, { status: 400 }),
        origin
      )
    }

    if (!projectId) {
      return addCorsHeaders(
        NextResponse.json({ error: 'projectId is required' }, { status: 400 }),
        origin
      )
    }

    // Validate project
    const project = await getProjectById(projectId)
    if (!project) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Invalid project ID' }, { status: 401 }),
        origin
      )
    }

    // Check origin
    if (!isOriginAllowed(origin, project.allowed_origins)) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Origin not allowed' }, { status: 403 }),
        origin
      )
    }

    // JWT verification if required
    if (project.secret_key) {
      if (project.widget_token_required && !widgetToken) {
        return addCorsHeaders(
          NextResponse.json({ error: 'Widget token is required' }, { status: 401 }),
          origin
        )
      }

      if (widgetToken) {
        const verifyResult = verifyWidgetJWT(widgetToken, project.secret_key)
        if (!verifyResult.valid) {
          return addCorsHeaders(
            NextResponse.json({ error: verifyResult.error }, { status: 401 }),
            origin
          )
        }
      }
    }

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
      return addCorsHeaders(
        NextResponse.json({ success: true, reviewTriggered: false }),
        origin
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
      console.error('[agent/session/close] Failed to close session:', updateError)
      return addCorsHeaders(
        NextResponse.json({ error: 'Failed to close session.' }, { status: 500 }),
        origin
      )
    }

    let reviewTriggered = false
    let runId: string | undefined

    // Check analyzed sessions limit before triggering PM review
    // Get project owner for limit check
    const { data: projectRecord } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', session.project_id)
      .single()

    if (projectRecord?.user_id) {
      const limitResult = await checkEnforcement({
        userId: projectRecord.user_id,
        dimension: 'analyzed_sessions',
      })

      if (!limitResult.allowed) {
        console.log('[agent/session/close] Skipping PM review - analyzed sessions limit reached:', sessionId)
        return addCorsHeaders(
          NextResponse.json({
            success: true,
            reviewTriggered: false,
            skippedReason: 'limit_reached',
          }),
          origin
        )
      }
    }

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
            console.log('[agent/session/close] Session review already in progress (race condition)')
            reviewTriggered = true
          } else {
            console.error('[agent/session/close] Failed to create review record:', insertError)
            // Don't fail the close operation if review trigger fails
          }
        } else {
          reviewTriggered = true
        }
      }
    } catch (reviewError) {
      console.error('[agent/session/close] Failed to trigger session review:', reviewError)
      // Don't fail the close operation if review fails
    }

    return addCorsHeaders(
      NextResponse.json({ success: true, reviewTriggered, runId }),
      origin
    )
  } catch (error) {
    console.error('[agent/session/close] unexpected error', error)
    return addCorsHeaders(
      NextResponse.json({ error: 'Unable to close session.' }, { status: 500 }),
      origin
    )
  }
}
