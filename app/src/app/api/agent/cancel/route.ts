import { NextRequest, NextResponse } from 'next/server'
import { getProjectByPublicKey } from '@/lib/projects/keys'
import { createAdminClient } from '@/lib/supabase/server'
import { cancelChatRun } from '@/lib/agent/chat-run-service'

export const runtime = 'nodejs'

interface CancelRequestBody {
  publicKey: string
  sessionId: string
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
 * POST /api/agent/cancel
 * Cancel a running chat
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('Origin') || '*'

  try {
    const body = (await request.json()) as CancelRequestBody
    const { publicKey, sessionId } = body

    if (!publicKey) {
      return addCorsHeaders(
        NextResponse.json({ error: 'publicKey is required' }, { status: 400 }),
        origin
      )
    }

    if (!sessionId) {
      return addCorsHeaders(
        NextResponse.json({ error: 'sessionId is required' }, { status: 400 }),
        origin
      )
    }

    // Validate public key
    const project = await getProjectByPublicKey(publicKey)
    if (!project) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Invalid public key' }, { status: 401 }),
        origin
      )
    }

    // Use admin client since this is public-facing (no user auth)
    const supabase = createAdminClient()

    const result = await cancelChatRun({ sessionId, supabase })

    if (!result.success) {
      return addCorsHeaders(
        NextResponse.json({
          message: result.error,
          cancelled: false,
        }),
        origin
      )
    }

    console.log('[agent.cancel] Cancelled chat for session:', sessionId)

    return addCorsHeaders(
      NextResponse.json({
        message: 'Chat cancelled successfully.',
        cancelled: true,
      }),
      origin
    )
  } catch (error) {
    console.error('[agent.cancel] unexpected error', error)
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to cancel chat.' }, { status: 500 }),
      request.headers.get('Origin') || '*'
    )
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin') || '*'

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
