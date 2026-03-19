/**
 * MCP Tools — Thin Agent Layer
 *
 * Exposes the Hissuno Agent as an MCP tool.
 * External agents (Claude Desktop, Cursor) talk to Hissuno like a coworker.
 * The Hissuno Agent has full access to knowledge, issues, and feedback via its Mastra tools.
 */

import { z } from 'zod'
import type { ModelMessage } from 'ai'
import { RuntimeContext } from '@mastra/core/runtime-context'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SupportAgentContext } from '@/types/agent'
import { resolveAgent } from '@/mastra/agents/router'
import { getContext } from './context'
import { registerResourceTools } from './resource-tools'

const LOG_PREFIX = '[mcp.tools]'

/**
 * Register all MCP tools on the server.
 */
export function registerTools(server: McpServer) {
  registerResourceTools(server)
  server.registerTool('ask_hissuno', {
    title: 'Ask Hissuno',
    description:
      'Ask Hissuno about your product, customers, issues, or feedback. ' +
      'Hissuno is a product intelligence agent with access to your knowledge base, ' +
      'customer feedback, issues, and contacts. Ask questions like:\n' +
      '- "What are the top customer complaints this week?"\n' +
      '- "Summarize the open bugs"\n' +
      '- "What do customers say about the checkout flow?"\n' +
      '- "Who are the most active contacts?"\n' +
      '- "Search our docs for authentication setup"',
    inputSchema: {
      question: z.string().describe('Your question or request for Hissuno'),
      thread_id: z
        .string()
        .optional()
        .describe('Optional thread ID to continue a previous conversation. Omit for a new conversation.'),
    },
  }, async (params) => {
    const ctx = getContext()
    const contactId = ctx.mode === 'contact' ? ctx.contactId : null

    try {
      // Resolve agent via router (support or PM based on contact mode)
      const { agent, systemMessages } = await resolveAgent({
        contactId,
        knowledgePackageId: null,
        projectId: ctx.projectId,
      })

      // Build runtime context matching what Slack/widget provide
      const runtimeContext = new RuntimeContext<SupportAgentContext>()
      runtimeContext.set('projectId', ctx.projectId)
      runtimeContext.set('sessionId', params.thread_id ?? `mcp_${Date.now()}`)
      runtimeContext.set('knowledgePackageId', null)
      runtimeContext.set('contactToken', null)
      runtimeContext.set('contactId', contactId)

      if (ctx.mode === 'contact') {
        runtimeContext.set('userId', ctx.contactEmail)
        runtimeContext.set('userMetadata', { email: ctx.contactEmail })
      } else {
        runtimeContext.set('userId', ctx.createdByUserId)
        runtimeContext.set('userMetadata', null)
      }

      const messages: ModelMessage[] = [
        ...systemMessages,
        { role: 'user', content: params.question },
      ]

      console.log(`${LOG_PREFIX} ask_hissuno`, {
        mode: ctx.mode,
        projectId: ctx.projectId,
        questionLength: params.question.length,
      })

      // Generate response — tools are baked into the agent
      const result = await agent.generate(messages, {
        runtimeContext,
        memory: {
          thread: params.thread_id ?? `mcp_${Date.now()}`,
          resource: ctx.mode === 'contact' ? ctx.contactEmail : ctx.createdByUserId,
        },
      })

      return {
        content: [{ type: 'text' as const, text: result.text || 'No response generated.' }],
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} ask_hissuno error`, error)
      return {
        content: [{
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      }
    }
  })
}
