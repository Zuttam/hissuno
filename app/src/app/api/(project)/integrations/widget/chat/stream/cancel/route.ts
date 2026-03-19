import { NextRequest, NextResponse } from 'next/server'
import { getProjectById } from '@/lib/projects/keys'
import { cancelChatRun } from '@/lib/agent/chat-run-service'
import { isOriginAllowed } from '@/lib/utils/widget-auth'

export const runtime = 'nodejs'

interface CancelRequestBody {
  projectId: string
  sessionId: string
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
 * POST /api/integrations/widget/chat/stream/cancel
 * Cancel a running chat
 */
export async function POST(request: NextRequest) {
  const origin = getRequestOrigin(request)

  try {
    const body = (await request.json()) as CancelRequestBody
    const { projectId, sessionId } = body

    if (!projectId) {
      return addCorsHeaders(
        NextResponse.json({ error: 'projectId is required' }, { status: 400 }),
        origin
      )
    }

    if (!sessionId) {
      return addCorsHeaders(
        NextResponse.json({ error: 'sessionId is required' }, { status: 400 }),
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

    const result = await cancelChatRun({ sessionId })

    if (!result.success) {
      return addCorsHeaders(
        NextResponse.json({
          message: result.error,
          cancelled: false,
        }),
        origin
      )
    }

    console.log('[widget/chat/stream/cancel] Cancelled chat for session:', sessionId)

    return addCorsHeaders(
      NextResponse.json({
        message: 'Chat cancelled successfully.',
        cancelled: true,
      }),
      origin
    )
  } catch (error) {
    console.error('[widget/chat/stream/cancel] unexpected error', error)
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to cancel chat.' }, { status: 500 }),
      origin
    )
  }
}

// Handle OPTIONS for CORS preflight
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
