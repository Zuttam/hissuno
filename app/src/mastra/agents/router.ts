/**
 * Agent Router
 *
 * Resolves the appropriate agent based on the interaction context.
 * - contactId present → Support Agent (customer-facing) + knowledge system messages
 * - contactId absent  → Product Manager Agent (team-facing)
 *
 * Knowledge is loaded for the support agent from the named package
 * and returned as system messages to prepend to the conversation.
 */

import type { Agent } from '@mastra/core/agent'
import type { ModelMessage } from 'ai'
import { mastra } from '@/mastra'
import { loadPackageKnowledge } from '@/lib/knowledge/loader'

export type ResolvedAgent = {
  agent: Agent
  /** System messages to prepend (e.g. knowledge injection for support agent) */
  systemMessages: ModelMessage[]
  /** Which mode was resolved */
  mode: 'support' | 'product-manager'
}

type ResolveAgentParams = {
  /** If present, routes to support agent (contact mode) */
  contactId: string | null
  /** Knowledge package ID for knowledge injection (support agent only) */
  knowledgePackageId: string | null
  /** Project ID for scoping knowledge package access */
  projectId?: string
}

/**
 * Resolve the appropriate agent and build system messages.
 *
 * @throws Error if the resolved agent is not registered in Mastra
 */
export async function resolveAgent(params: ResolveAgentParams): Promise<ResolvedAgent> {
  const { contactId, knowledgePackageId, projectId } = params
  const isContact = !!contactId

  const agentKey = isContact ? 'supportAgent' : 'productManagerAgent'
  const agent = mastra.getAgent(agentKey)

  if (!agent) {
    throw new Error(`Agent '${agentKey}' not found in Mastra registry`)
  }

  const systemMessages: ModelMessage[] = []

  // Inject knowledge for support agent
  if (isContact && knowledgePackageId) {
    try {
      const knowledgeContent = await loadPackageKnowledge(knowledgePackageId, projectId)
      if (knowledgeContent) {
        systemMessages.push({
          role: 'system' as const,
          content: `## Knowledge Base\n\nUse the following knowledge to answer questions accurately. This is your primary source of truth about the product.\n\n${knowledgeContent}`,
        })
      }
    } catch (err) {
      console.warn('[agent-router] Failed to load package knowledge:', err)
    }
  }

  return {
    agent,
    systemMessages,
    mode: isContact ? 'support' : 'product-manager',
  }
}
