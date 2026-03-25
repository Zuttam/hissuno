/**
 * Knowledge Source Description Generator
 *
 * Generates concise, agent-optimized descriptions for knowledge sources
 * using a lightweight LLM call. Descriptions help agents determine which
 * knowledge sources are relevant to a given task.
 */

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

const LOG_PREFIX = '[generate-description]'

/**
 * Generate a description for a knowledge source from its content.
 * Returns null on failure (non-critical - callers should handle gracefully).
 */
export async function generateSourceDescription(
  content: string,
  sourceName?: string | null
): Promise<string | null> {
  if (!content || content.trim().length < 50) {
    return null
  }

  // Truncate content to keep costs and latency minimal
  const truncated = content.length > 4000 ? `${content.slice(0, 4000)}...` : content

  const nameContext = sourceName ? `\nDocument title: "${sourceName}"` : ''

  try {
    const { text } = await generateText({
      model: openai('gpt-5.4-nano'),
      maxOutputTokens: 200,
      temperature: 0.3,
      system: `You generate concise descriptions of knowledge documents for an AI agent.
The description helps the agent decide if this document is relevant to a task.

Rules:
- Output ONLY the description, nothing else
- 2-3 sentences maximum
- Be specific: mention concrete topics, entities, metrics, and data points covered
- Focus on WHAT information the document contains, not how it's structured
- Do not start with "This document" - jump straight to the content
- No markdown formatting`,
      prompt: `Generate a description for this knowledge source:${nameContext}\n\n${truncated}`,
    })

    const cleaned = text.trim()
    if (!cleaned || cleaned.length < 10) {
      return null
    }

    return cleaned
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to generate description:`, error instanceof Error ? error.message : error)
    return null
  }
}
