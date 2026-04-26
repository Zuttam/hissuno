/**
 * Knowledge Source Description Generator
 *
 * Uses a Mastra agent to generate concise, agent-optimized descriptions for
 * knowledge sources. Descriptions help agents determine which knowledge
 * sources are relevant to a given task.
 */

import { Agent } from '@mastra/core/agent'
import { resolveModel } from '@/mastra/models'
import { getAIModelSettingsAdmin } from '@/lib/db/queries/project-settings'

const LOG_PREFIX = '[generate-description]'

/**
 * Generate a description for a knowledge source from its content.
 * Returns null on failure (non-critical - callers should handle gracefully).
 */
export async function generateSourceDescription(
  content: string,
  sourceName?: string | null,
  projectId?: string,
): Promise<string | null> {
  if (!content || content.trim().length < 50) {
    return null
  }

  // Truncate content to keep costs and latency minimal
  const truncated = content.length > 4000 ? `${content.slice(0, 4000)}...` : content

  const nameContext = sourceName ? `\nDocument title: "${sourceName}"` : ''

  try {
    const aiSettings = projectId ? await getAIModelSettingsAdmin(projectId) : null
    const descriptionAgent = new Agent({
      id: 'knowledge-source-description',
      name: 'Knowledge Source Description',
      instructions: `You generate concise descriptions of knowledge documents for an AI agent.
The description helps the agent decide if this document is relevant to a task.

Rules:
- Output ONLY the description, nothing else
- 2-3 sentences maximum
- Be specific: mention concrete topics, entities, metrics, and data points covered
- Focus on WHAT information the document contains, not how it's structured
- Do not start with "This document" - jump straight to the content
- No markdown formatting`,
      model: resolveModel(
        { name: 'source-description', tier: 'small', fallback: 'openai/gpt-5.4-mini' },
        aiSettings,
      ),
    });

    const response = await descriptionAgent.generate(
      `Generate a description for this knowledge source:${nameContext}\n\n${truncated}`,
    )
    const text = response.text ?? ''

    const cleaned = text.trim()
    if (!cleaned || cleaned.length < 10) {
      return null
    }

    return cleaned
  } catch (error) {
    // Non-fatal: source description is optional. Log clearly so the failure is visible.
    console.error(`${LOG_PREFIX} Failed to generate description:`, error instanceof Error ? error.stack ?? error.message : error)
    return null
  }
}
