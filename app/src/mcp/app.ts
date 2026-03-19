/**
 * Hissuno MCP Server — Application
 *
 * Thin MCP layer that exposes the Hissuno Agent as a coworker tool.
 * Two-tier auth: user mode (full project access) or contact mode (scoped to one contact).
 * The Hissuno Agent handles all data access via its existing Mastra tools.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { authenticateRequest, McpAuthError } from './auth'
import { runWithContext } from './context'
import { registerTools } from './tools'

const PORT = parseInt(process.env.MCP_PORT ?? '3100', 10)
const LOG_PREFIX = '[mcp.server]'

/**
 * Create a pre-configured McpServer with the ask_hissuno tool.
 * Same tool for both user and contact mode — the auth context
 * determines what the underlying support agent can access.
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'hissuno',
    version: '1.0.0',
  })
  registerTools(server)
  return server
}

/**
 * Send a JSON error response.
 */
function sendError(res: ServerResponse, statusCode: number, message: string) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: message }))
}

/**
 * Main HTTP request handler.
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const { method, url } = req

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Contact-Token',
      'Access-Control-Max-Age': '86400',
    })
    res.end()
    return
  }

  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Health check
  if (method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }))
    return
  }

  // MCP endpoint
  if (method === 'POST' && url === '/mcp') {
    try {
      // Authenticate (adapt Node.js headers to the get() interface)
      const headers = {
        get: (name: string) => {
          const val = req.headers[name.toLowerCase()]
          return typeof val === 'string' ? val : null
        },
      }
      const ctx = await authenticateRequest(headers)

      console.log(`${LOG_PREFIX} ${ctx.mode} mode request`, {
        projectId: ctx.projectId,
        ...(ctx.mode === 'contact' ? { contactId: ctx.contactId } : {}),
      })

      // Create server with ask_hissuno tool
      const mcpServer = createMcpServer()

      // Create stateless transport (new per request)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

      // Connect and handle within the auth context
      await runWithContext(ctx, async () => {
        await mcpServer.connect(transport)
        await transport.handleRequest(req, res)
      })
    } catch (error) {
      if (error instanceof McpAuthError) {
        sendError(res, error.statusCode, error.message)
        return
      }
      console.error(`${LOG_PREFIX} Unexpected error`, error)
      sendError(res, 500, 'Internal server error')
    }
    return
  }

  // 404
  sendError(res, 404, 'Not found')
}

/**
 * Start the HTTP server.
 */
function startServer() {
  const server = createServer(handleRequest)

  server.listen(PORT, () => {
    console.log(`${LOG_PREFIX} Hissuno MCP server running on http://localhost:${PORT}`)
    console.log(`${LOG_PREFIX} Health: http://localhost:${PORT}/health`)
    console.log(`${LOG_PREFIX} MCP:    POST http://localhost:${PORT}/mcp`)
  })
}

startServer()
