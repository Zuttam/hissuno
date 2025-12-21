import { NextRequest, NextResponse } from 'next/server'
import type { CoreMessage } from 'ai'
import { mastra } from '@/mastra'
import { getProjectByPublicKey } from '@/lib/projects/keys'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentRequestBody {
  messages: ChatMessage[]
  projectId: string
  publicKey: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequestBody
    const { messages, projectId, publicKey } = body

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    if (!projectId || !publicKey) {
      return NextResponse.json(
        { error: 'projectId and publicKey are required' },
        { status: 400 }
      )
    }

    // Validate public key and project access
    const project = await getProjectByPublicKey(publicKey)
    if (!project) {
      return NextResponse.json(
        { error: 'Invalid public key' },
        { status: 401 }
      )
    }

    if (project.id !== projectId) {
      return NextResponse.json(
        { error: 'Public key does not match project' },
        { status: 403 }
      )
    }

    // Get the support agent and stream the response
    const agent = mastra.getAgent('supportAgent')
    if (!agent) {
      console.error('[agent.post] supportAgent not found')
      return NextResponse.json(
        { error: 'Agent not available' },
        { status: 500 }
      )
    }

    // Convert messages to the format expected by Mastra (CoreMessage from AI SDK)
    const mastraMessages: CoreMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Stream the agent response
    const stream = await agent.stream(mastraMessages)

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
