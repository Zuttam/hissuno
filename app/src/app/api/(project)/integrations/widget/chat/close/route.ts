import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UUID_REGEX } from '@/lib/db/server'
import { sessions } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { getProjectById } from '@/lib/projects/keys'
import { isOriginAllowed, verifyWidgetJWT } from '@/lib/utils/widget-auth'
import { getWidgetRequestOrigin, addWidgetCorsHeaders, createWidgetOptionsResponse } from '@/lib/utils/widget-cors'

export const runtime = 'nodejs'

const CORS_METHODS = 'POST, OPTIONS'

interface CloseRequestBody {
  sessionId: string
  projectId: string
  widgetToken?: string
}

/**
 * OPTIONS /api/integrations/widget/chat/close
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return createWidgetOptionsResponse(request, CORS_METHODS)
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
  const origin = getWidgetRequestOrigin(request)

  if (!isDatabaseConfigured()) {
    console.error('[widget/chat/close] Database must be configured')
    return addWidgetCorsHeaders(
      NextResponse.json({ error: 'Database must be configured.' }, { status: 500 }),
      origin, CORS_METHODS
    )
  }

  try {
    const body = (await request.json()) as CloseRequestBody
    const { sessionId, projectId, widgetToken } = body

    if (!sessionId) {
      return addWidgetCorsHeaders(
        NextResponse.json({ error: 'sessionId is required' }, { status: 400 }),
        origin, CORS_METHODS
      )
    }

    if (!projectId) {
      return addWidgetCorsHeaders(
        NextResponse.json({ error: 'projectId is required' }, { status: 400 }),
        origin, CORS_METHODS
      )
    }

    // Validate project
    const project = await getProjectById(projectId)
    if (!project) {
      return addWidgetCorsHeaders(
        NextResponse.json({ error: 'Invalid project ID' }, { status: 401 }),
        origin, CORS_METHODS
      )
    }

    // Check origin
    if (!isOriginAllowed(origin, project.allowed_origins)) {
      return addWidgetCorsHeaders(
        NextResponse.json({ error: 'Origin not allowed' }, { status: 403 }),
        origin, CORS_METHODS
      )
    }

    // JWT verification if required
    if (project.secret_key) {
      if (project.widget_token_required && !widgetToken) {
        return addWidgetCorsHeaders(
          NextResponse.json({ error: 'Widget token is required' }, { status: 401 }),
          origin
        )
      }

      if (widgetToken) {
        const verifyResult = verifyWidgetJWT(widgetToken, project.secret_key)
        if (!verifyResult.valid) {
          return addWidgetCorsHeaders(
            NextResponse.json({ error: verifyResult.error }, { status: 401 }),
            origin
          )
        }
      }
    }

    // Non-UUID session IDs can't exist in the database — return success (idempotent)
    if (!UUID_REGEX.test(sessionId)) {
      return addWidgetCorsHeaders(
        NextResponse.json({ success: true }),
        origin, CORS_METHODS
      )
    }

    // Get session to verify it exists
    const [session] = await db
      .select({ id: sessions.id, project_id: sessions.project_id, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)

    // If session doesn't exist, return success (idempotent close)
    // This handles the case where close is called before any message was sent
    if (!session) {
      return addWidgetCorsHeaders(
        NextResponse.json({ success: true }),
        origin, CORS_METHODS
      )
    }

    // Update session status to closed
    try {
      await db
        .update(sessions)
        .set({
          status: 'closed',
          updated_at: new Date(),
        })
        .where(eq(sessions.id, sessionId))
    } catch (updateError) {
      console.error('[widget/chat/close] Failed to close session:', updateError)
      return addWidgetCorsHeaders(
        NextResponse.json({ error: 'Failed to close session.' }, { status: 500 }),
        origin, CORS_METHODS
      )
    }

    return addWidgetCorsHeaders(
      NextResponse.json({ success: true }),
      origin, CORS_METHODS
    )
  } catch (error) {
    console.error('[widget/chat/close] unexpected error', error)
    return addWidgetCorsHeaders(
      NextResponse.json({ error: 'Unable to close session.' }, { status: 500 }),
      origin, CORS_METHODS
    )
  }
}
