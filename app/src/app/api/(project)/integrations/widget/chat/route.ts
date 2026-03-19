import { NextRequest, NextResponse } from 'next/server'
import { getProjectById } from '@/lib/projects/keys'
import { upsertSession, isSessionInHumanTakeover } from '@/lib/db/queries/sessions'
import { triggerChatRun, getChatRunStatus } from '@/lib/agent/chat-run-service'
import { saveSessionMessage } from '@/lib/db/queries/session-messages'
import { resolveContactForSession } from '@/lib/customers/contact-resolution'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { isOriginAllowed, verifyWidgetJWT } from '@/lib/utils/widget-auth'
import { UUID_REGEX } from '@/lib/db/server'

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
  /** Override the knowledge package used for this chat (for testing specific packages) */
  packageId?: string
}

/**
 * Generate a unique session ID
 * Each new session gets a unique ID based on timestamp and random string
 */
function generateUniqueSessionId(): string {
  return crypto.randomUUID()
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
 * GET /api/integrations/widget/chat?projectId=xxx&sessionId=xxx
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

    const status = await getChatRunStatus({ sessionId })

    return addCorsHeaders(NextResponse.json(status), origin)
  } catch (error) {
    console.error('[widget/chat.get] unexpected error', error)
    return addCorsHeaders(
      NextResponse.json({ error: 'Failed to get status' }, { status: 500 }),
      origin
    )
  }
}

/**
 * POST /api/integrations/widget/chat
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
      packageId,
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
    let isVerifiedIdentity = false

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
        isVerifiedIdentity = true
      }
    }

    // Use client-provided sessionId if valid UUID, otherwise generate a new one
    const sessionId = (clientSessionId && UUID_REGEX.test(clientSessionId))
      ? clientSessionId
      : generateUniqueSessionId()

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
      console.error('[widget/chat.post] failed to upsert session', error)
    })

    // Check if session is in human takeover mode (only for existing sessions)
    if (clientSessionId) {
      const humanTakeover = await isSessionInHumanTakeover(sessionId)
      if (humanTakeover) {
        // Save user message but skip AI response
        const lastUserMessage = messages[messages.length - 1]
        if (lastUserMessage?.role === 'user') {
          saveSessionMessage({
            sessionId,
            projectId,
            senderType: 'user',
            content: lastUserMessage.content,
          }).catch((error) => {
            console.error('[widget/chat.post] failed to save user message (human takeover)', error)
          })
        }

        return addCorsHeaders(
          NextResponse.json({
            message: 'Human takeover active.',
            status: 'human_takeover',
            sessionId,
          }),
          origin
        )
      }
    }

    // Eagerly resolve contact for session tracking (links session to contact record)
    const contactResult = await resolveContactForSession({
      projectId,
      sessionId,
      userMetadata: userMetadata ?? null,
    })

    // Grant team-member mode (PM Agent) when identity is verified via JWT
    // or when the request comes from an authenticated dashboard user.
    // Body-supplied userId is untrusted and must never be used for authorization.
    let toolScopingContactId = contactResult.contactId
    if (isVerifiedIdentity && userId) {
      const isTeamMember = await hasProjectAccess(projectId, userId)
      if (isTeamMember) {
        toolScopingContactId = null
      }
    }

    // Fallback: check for authenticated dashboard user via proxy-injected headers.
    // When a logged-in user sends a request from the dashboard (same-origin),
    // the proxy has already authenticated them and injected x-user-id.
    if (toolScopingContactId !== null && !widgetToken) {
      const dashboardUserId = request.headers.get('x-user-id')
      if (dashboardUserId) {
        const isDashboardTeamMember = await hasProjectAccess(projectId, dashboardUserId)
        if (isDashboardTeamMember) {
          toolScopingContactId = null
        }
      }
    }

    // Trigger chat run (creates record, returns runId)
    const result = await triggerChatRun({
      projectId,
      sessionId,
      messages,
      userId,
      userMetadata,
      packageId,
      contactId: toolScopingContactId,
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
        console.error('[widget/chat.post] failed to save user message', error)
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
    console.error('[widget/chat.post] unexpected error', error)
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
