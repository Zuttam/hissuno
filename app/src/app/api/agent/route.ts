import { NextRequest, NextResponse } from 'next/server'
import type { CoreMessage } from 'ai'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { mastra } from '@/mastra'
import { getProjectByPublicKey } from '@/lib/projects/keys'
import { upsertSession, updateSessionActivity } from '@/lib/supabase/sessions'

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
 * Generate a deterministic session ID based on publicKey and userId
 * This ensures the same user on the same project always gets the same session
 */
function generateSessionId(publicKey: string, userId?: string): string {
  const base = userId ? `${publicKey}:${userId}` : `${publicKey}:anonymous`
  // Create a simple hash for the session ID
  let hash = 0
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `session_${Math.abs(hash).toString(36)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequestBody
    const { messages, publicKey, userId, userMetadata, pageUrl, pageTitle } = body

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    if (!publicKey) {
      return NextResponse.json(
        { error: 'publicKey is required' },
        { status: 400 }
      )
    }

    // Derive project from publicKey
    const project = await getProjectByPublicKey(publicKey)
    if (!project) {
      return NextResponse.json(
        { error: 'Invalid public key' },
        { status: 401 }
      )
    }

    const projectId = project.id

    // Generate session ID for this user/project combination
    const sessionId = generateSessionId(publicKey, userId)

    // Upsert session for tracking (fire and forget - don't block the response)
    upsertSession({
      id: sessionId,
      projectId,
      userId: userId || null,
      userMetadata: userMetadata || null,
      pageUrl: pageUrl || null,
      pageTitle: pageTitle || null,
    }).catch((error) => {
      console.error('[agent.post] failed to upsert session', error)
    })

    // Get the support agent
    const agent = mastra.getAgent('supportAgent')
    if (!agent) {
      console.error('[agent.post] supportAgent not found')
      return NextResponse.json(
        { error: 'Agent not available' },
        { status: 500 }
      )
    }

    // Build RuntimeContext with project and user info
    const runtimeContext = new RuntimeContext<SupportAgentContext>()
    runtimeContext.set('projectId', projectId)
    runtimeContext.set('userId', userId || null)
    runtimeContext.set('userMetadata', userMetadata || null)
    runtimeContext.set('sessionId', sessionId)

    // Convert messages to the format expected by Mastra (CoreMessage from AI SDK)
    const mastraMessages: CoreMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Stream the agent response with RuntimeContext and memory
    const stream = await agent.stream(mastraMessages, {
      runtimeContext,
      memory: {
        thread: sessionId,
        resource: userId || 'anonymous',
      },
    })

    // Update session activity (fire and forget)
    updateSessionActivity(sessionId).catch((error) => {
      console.error('[agent.post] failed to update session activity', error)
    })

    // Create a readable stream for the response
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream.textStream) {
            controller.enqueue(new TextEncoder().encode(chunk))
          }
          controller.close()
        } catch (error) {
          console.error('[agent.post] streaming error', error)
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[agent.post] unexpected error', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
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
