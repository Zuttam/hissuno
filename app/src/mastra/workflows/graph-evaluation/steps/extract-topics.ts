/**
 * Step 2: Extract Topics
 *
 * Uses LLM to extract 3-5 key topics from entity content.
 * For contacts, skips LLM and uses the embedding text directly.
 */

import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { GraphEntityType } from '../schemas'

/**
 * Core logic for topic extraction. Exported for inline use.
 */
export async function extractTopics(
  contentForSearch: string,
  entityName: string,
  entityType: GraphEntityType,
  guidelines: string | null,
): Promise<{ topics: string[]; combinedQuery: string }> {
  // For contacts, skip LLM - use content directly as query
  if (entityType === 'contact') {
    return {
      topics: [entityName],
      combinedQuery: contentForSearch,
    }
  }

  let topics: string[] = []

  try {
    const guidelinesPrompt = guidelines
      ? `\n\nUser guidelines for relationship discovery:\n${guidelines}`
      : ''

    const entityLabel = entityType === 'knowledge_source' ? 'knowledge source' : entityType

    const { object } = await generateObject({
      model: openai('gpt-5.4-mini'),
      schema: z.object({
        topics: z.array(z.string()).describe('3-5 key topics/keywords for finding related entities'),
      }),
      prompt: `Extract 3-5 key topics or keywords from this ${entityLabel} content that would help find related customer conversations, issues, and product areas.${guidelinesPrompt}\n\nContent (first 3000 chars):\n${contentForSearch}`,
    })

    topics = object.topics.slice(0, 5)
  } catch {
    // LLM failure is non-fatal
  }

  // Fallback: use entity name
  if (topics.length === 0) {
    topics = [entityName].filter(Boolean)
  }

  return {
    topics,
    combinedQuery: topics.join(' '),
  }
}

