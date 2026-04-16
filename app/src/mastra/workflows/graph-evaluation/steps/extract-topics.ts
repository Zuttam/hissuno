/**
 * Step 2: Extract Topics
 *
 * Uses a Mastra agent to extract 3-5 key topics from entity content.
 * For contacts, skips LLM and uses the embedding text directly.
 */

import { Agent } from '@mastra/core/agent'
import { z } from 'zod'
import { resolveModel } from '@/mastra/models'
import { getAIModelSettingsAdmin } from '@/lib/db/queries/project-settings'
import type { GraphEntityType } from '../schemas'

const TOPICS_SCHEMA = z.object({
  topics: z.array(z.string()).describe('3-5 key topics/keywords for finding related entities'),
})

/**
 * Core logic for topic extraction. Exported for inline use.
 */
export async function extractTopics(
  contentForSearch: string,
  entityName: string,
  entityType: GraphEntityType,
  guidelines: string | null,
  projectId?: string,
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

    const aiSettings = projectId ? await getAIModelSettingsAdmin(projectId) : null
    const topicAgent = new Agent({
      name: 'Graph Topic Extractor',
      instructions: 'You extract key topics/keywords from entity content for graph relationship discovery.',
      model: resolveModel(
        { name: 'graph-topic-extractor', tier: 'small', fallback: 'openai/gpt-5.4-mini' },
        aiSettings,
      ),
    })

    const { object } = await topicAgent.generate(
      `Extract 3-5 key topics or keywords from this ${entityLabel} content that would help find related customer conversations, issues, and product areas.${guidelinesPrompt}\n\nContent (first 3000 chars):\n${contentForSearch}`,
      { output: TOPICS_SCHEMA },
    )

    topics = object.topics.slice(0, 5)
  } catch (err) {
    // Non-fatal: fall back to entity name. Log clearly so the failure is visible.
    console.error(`[extract-topics] LLM topic extraction failed, using entity name fallback:`, err instanceof Error ? err.stack ?? err.message : err)
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
