import { NextRequest, NextResponse } from 'next/server'
import { getProjectByPublicKey } from '@/lib/projects/keys'
import { upsertSession } from '@/lib/supabase/sessions'
import { triggerChatRun, getChatRunStatus } from '@/lib/agent/chat-run-service'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentRequestBody {
  messages: ChatMessage[]
  publicKey: string
  userId?: string
  userMetadata?: Record<string, string>
  pageUrl?: string
  pageTitle?: string
  sessionId?: string
  source?: 'widget' | 'slack' | 'intercom' | 'gong' | 'api'
}

/**
 * Runtime context type for the support agent
 */
export type SupportAgentContext = {
  projectId: string
  userId: string | null
  userMetadata: Record<string, string> | null
  sessionId: string
}

/**
 * Generate a unique session ID
 * Each new session gets a unique ID based on timestamp and random string
 */
function generateUniqueSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 9)
  return `session_${timestamp}_${random}`
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, origin: string): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

/**
 * GET /api/agent?publicKey=xxx&sessionId=xxx
 * Get the current status of a chat run
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin') || '*'

  try {
    const publicKey = request.nextUrl.searchParams.get('publicKey')
    const sessionId = request.nextUrl.searchParams.get('sessionId')

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
    const status = await getChatRunStatus({ sessionId, supabase })

    return addCorsHeaders(NextResponse.json(status), origin)
  } catch (error) {
    console.error('[agent.get] unexpected error', error)
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to get status' }, { status: 500 }),
      origin
    )
  }
}

/**
 * POST /api/agent
 * Trigger a new chat run (creates chat_run record, returns runId for SSE streaming)
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('Origin') || '*'

  try {
    const body = (await request.json()) as AgentRequestBody
    const { messages, publicKey, userId, userMetadata, pageUrl, pageTitle, sessionId: clientSessionId, source } = body

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Messages array is required' }, { status: 400 }),
        origin
      )
    }

    if (!publicKey) {
      return addCorsHeaders(
        NextResponse.json({ error: 'publicKey is required' }, { status: 400 }),
        origin
      )
    }

    // Derive project from publicKey
    const project = await getProjectByPublicKey(publicKey)
    if (!project) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Invalid public key' }, { status: 401 }),
        origin
      )
    }

    const projectId = project.id

    // Use client-provided sessionId if available, otherwise generate a unique one
    const sessionId = clientSessionId || generateUniqueSessionId()

    // Upsert session for tracking (fire and forget - don't block the response)
    upsertSession({
      id: sessionId,
      projectId,
      userId: userId || null,
      userMetadata: userMetadata || null,
      pageUrl: pageUrl || null,
      pageTitle: pageTitle || null,
      source: source || 'widget',
    }).catch((error) => {
      console.error('[agent.post] failed to upsert session', error)
    })

    // Use admin client since this is public-facing (no user auth)
    const supabase = createAdminClient()

    // Trigger chat run (creates record, returns runId)
    const result = await triggerChatRun({
      projectId,
      sessionId,
      messages,
      userId,
      userMetadata,
      supabase,
    })

    if (!result.success) {
      return addCorsHeaders(
        NextResponse.json(
          { error: result.error, runId: result.runId, chatRunId: result.chatRunId },
          { status: result.statusCode }
        ),
        origin
      )
    }

    return addCorsHeaders(
      NextResponse.json({
        message: 'Chat started.',
        status: 'processing',
        sessionId,
        runId: result.runId,
        chatRunId: result.chatRunId,
      }, { status: 201 }),
      origin
    )
  } catch (error) {
    console.error('[agent.post] unexpected error', error)
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to process request' }, { status: 500 }),
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
