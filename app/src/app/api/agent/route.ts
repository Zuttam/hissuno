import { NextRequest, NextResponse } from 'next/server'
import { getProjectById } from '@/lib/projects/keys'
import { upsertSession } from '@/lib/supabase/sessions'
import { triggerChatRun, getChatRunStatus } from '@/lib/agent/chat-run-service'
import { createAdminClient } from '@/lib/supabase/server'
import { saveSessionMessage } from '@/lib/supabase/session-messages'
import { isOriginAllowed, verifyWidgetJWT } from '@/lib/utils/widget-auth'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentRequestBody {
  messages: ChatMessage[]
  projectId: string
  userId?: string
  userMetadata?: Record<string, string>
  pageUrl?: string
  pageTitle?: string
  sessionId?: string
  widgetToken?: string
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
 * Get the request origin from headers
 * Uses Origin header if present, otherwise falls back to request URL origin
 */
function getRequestOrigin(request: NextRequest): string {
  return request.headers.get('Origin') || request.nextUrl.origin
}

/**
 * GET /api/agent?projectId=xxx&sessionId=xxx
 * Get the current status of a chat run
 */
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request)

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    const sessionId = request.nextUrl.searchParams.get('sessionId')

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

    // Check origin for widget requests
    if (!isOriginAllowed(origin, project.allowed_origins)) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Origin not allowed' }, { status: 403 }),
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
  const origin = getRequestOrigin(request)

  try {
    const body = (await request.json()) as AgentRequestBody
    const {
      messages,
      projectId,
      userId: bodyUserId,
      userMetadata: bodyUserMetadata,
      pageUrl,
      pageTitle,
      sessionId: clientSessionId,
      widgetToken,
    } = body

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Messages array is required' }, { status: 400 }),
        origin
      )
    }

    if (!projectId) {
      return addCorsHeaders(
        NextResponse.json({ error: 'projectId is required' }, { status: 400 }),
        origin
      )
    }

    // Look up project by ID
    const project = await getProjectById(projectId)
    if (!project) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Invalid project ID' }, { status: 401 }),
        origin
      )
    }

    // Always check origin
    if (!isOriginAllowed(origin, project.allowed_origins)) {
      return addCorsHeaders(
        NextResponse.json({ error: 'Origin not allowed' }, { status: 403 }),
        origin
      )
    }

    // JWT verification
    let userId = bodyUserId
    let userMetadata = bodyUserMetadata

    // If widget token is required
    if (project.widget_token_required) {
      if (!project.secret_key) {
        return addCorsHeaders(
          NextResponse.json({ error: 'Project secret key is required' }, { status: 401 }),
          origin
        )
      }
      
      // If token is required, reject if not provided
      if (!widgetToken) {
        return addCorsHeaders(
          NextResponse.json({ error: 'Widget token is required' }, { status: 401 }),
          origin
        )
      }
      else {
      
        const verifyResult = verifyWidgetJWT(widgetToken, project.secret_key)
        if (!verifyResult.valid) {
          return addCorsHeaders(
            NextResponse.json({ error: verifyResult.error }, { status: 401 }),
            origin
          )
        }

        // Use verified data from token (overrides body data for security)
        userId = verifyResult.payload.userId
        userMetadata = verifyResult.payload.userMetadata ?? bodyUserMetadata
      }
    }

    // Use client-provided sessionId if available, otherwise generate a unique one
    const sessionId = clientSessionId || generateUniqueSessionId()

    // Upsert session for tracking (fire and forget - don't block the response)
    // Note: Limits are enforced at analysis time (PM review), not at session creation
    upsertSession({
      id: sessionId,
      projectId,
      userId: userId || null,
      userMetadata: userMetadata || null,
      pageUrl: pageUrl || null,
      pageTitle: pageTitle || null,
      source: 'widget',
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

    // Save user message to session_messages (fire and forget)
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage?.role === 'user') {
      saveSessionMessage({
        sessionId,
        projectId,
        senderType: 'user',
        content: lastUserMessage.content,
      }).catch((error) => {
        console.error('[agent.post] failed to save user message', error)
      })
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
