import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
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
 * OPTIONS /api/integrations/widget/chat/close
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
 * POST /api/integrations/widget/chat/close
 * Closes a session. Reviews are triggered separately by the session-lifecycle cron.
 *
 * Request Body:
 * - sessionId: string
 * - projectId: string
 * - widgetToken?: string (optional JWT token for authentication)
 *
 * Response:
 * - success: boolean
 */
export async function POST(request: NextRequest) {
  const origin = getRequestOrigin(request)

  if (!isSupabaseConfigured()) {
    console.error('[widget/chat/close] Supabase must be configured')
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
        NextResponse.json({ success: true }),
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
      console.error('[widget/chat/close] Failed to close session:', updateError)
      return addCorsHeaders(
        NextResponse.json({ error: 'Failed to close session.' }, { status: 500 }),
        origin
      )
    }

    return addCorsHeaders(
      NextResponse.json({ success: true }),
      origin
    )
  } catch (error) {
    console.error('[widget/chat/close] unexpected error', error)
    return addCorsHeaders(
      NextResponse.json({ error: 'Unable to close session.' }, { status: 500 }),
      origin
    )
  }
}
