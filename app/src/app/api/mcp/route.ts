/**
 * MCP API Route — Next.js handler for Vercel deployment
 *
 * Exposes the same MCP endpoint as the standalone server (app/src/mcp/app.ts)
 * but using Web Standard Request/Response for serverless compatibility.
 */

import { NextResponse } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateRequest, McpAuthError } from '@/mcp/auth'
import { runWithContext } from '@/mcp/context'
import { registerTools } from '@/mcp/tools'

export const runtime = 'nodejs'
export const maxDuration = 300

const LOG_PREFIX = '[api.mcp]'

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'hissuno',
    version: '1.0.0',
  })
  registerTools(server)
  return server
}

export async function POST(req: Request) {
  try {
    const ctx = await authenticateRequest(req.headers)

    console.log(`${LOG_PREFIX} ${ctx.mode} mode request`, {
      projectId: ctx.projectId,
      ...(ctx.mode === 'contact' ? { contactId: ctx.contactId } : {}),
    })

    const mcpServer = createMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })

    const response = await runWithContext(ctx, async () => {
      await mcpServer.connect(transport)
      return transport.handleRequest(req)
    })

    return response
  } catch (error) {
    if (error instanceof McpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error(`${LOG_PREFIX} Unexpected error`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
