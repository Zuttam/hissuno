/**
 * Data Tools — Toolset Assembler
 *
 * Builds the correct data toolset based on auth context.
 * - contactId === null → user mode (full project access)
 * - contactId !== null → contact mode (scoped to own data)
 *
 * Usage:
 *   agent.generate(messages, {
 *     runtimeContext,
 *     toolsets: { dataTools: buildDataToolset(contactId) },
 *   })
 */

import type { ToolsInput } from '@mastra/core/agent'
import { userDataTools } from './user-data-tools'
import { contactDataTools } from './contact-data-tools'

export { userDataTools } from './user-data-tools'
export { contactDataTools } from './contact-data-tools'
export { feedbackTools } from './feedback-tools'
export { knowledgeTools } from './knowledge-tools'
export { getDataContext } from './helpers'

/**
 * Build a toolset containing the appropriate data tools for the auth mode.
 */
export function buildDataToolset(contactId: string | null): ToolsInput {
  const tools = contactId ? contactDataTools : userDataTools
  return Object.fromEntries(tools.map((t) => [t.id, t]))
}
