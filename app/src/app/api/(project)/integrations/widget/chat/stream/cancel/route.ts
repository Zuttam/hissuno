import { NextRequest, NextResponse } from 'next/server'
import { getProjectById } from '@/lib/projects/keys'
import { cancelChatRun } from '@/lib/chat/chat-run-service'
import { isOriginAllowed } from '@/lib/utils/widget-auth'
import { getWidgetRequestOrigin, addWidgetCorsHeaders, createWidgetOptionsResponse } from '@/lib/utils/widget-cors'

export const runtime = 'nodejs'

const CORS_METHODS = 'POST, OPTIONS'

interface CancelRequestBody {
  projectId: string
  sessionId: string
}

/**
 * POST /api/integrations/widget/chat/stream/cancel
 * Cancel a running chat
 */
export async function POST(request: NextRequest) {
  const origin = getWidgetRequestOrigin(request)

  try {
    const body = (await request.json()) as CancelRequestBody
    const { projectId, sessionId } = body

    if (!projectId) {
      return addWidgetCorsHeaders(
        NextResponse.json({ error: 'projectId is required' }, { status: 400 }),
        origin, CORS_METHODS
      )
    }

    if (!sessionId) {
      return addWidgetCorsHeaders(
        NextResponse.json({ error: 'sessionId is required' }, { status: 400 }),
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

    const result = await cancelChatRun({ sessionId })

    if (!result.success) {
      return addWidgetCorsHeaders(
        NextResponse.json({
          message: result.error,
          cancelled: false,
        }),
        origin, CORS_METHODS
      )
    }

    console.log('[widget/chat/stream/cancel] Cancelled chat for session:', sessionId)

    return addWidgetCorsHeaders(
      NextResponse.json({
        message: 'Chat cancelled successfully.',
        cancelled: true,
      }),
      origin, CORS_METHODS
    )
  } catch (error) {
    console.error('[widget/chat/stream/cancel] unexpected error', error)
    return addWidgetCorsHeaders(
      NextResponse.json({ error: 'Failed to cancel chat.' }, { status: 500 }),
      origin, CORS_METHODS
    )
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return createWidgetOptionsResponse(request, CORS_METHODS)
}
