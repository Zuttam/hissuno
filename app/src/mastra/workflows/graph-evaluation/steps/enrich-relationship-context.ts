/**
 * Step 3b: Enrich Relationship Context
 *
 * After discovery finds related entities, this step generates human-readable
 * context for each relationship in a single batched LLM call.
 *
 * The context should be good enough for a user or agent to understand WHY two
 * entities are connected and decide whether to dive deeper - without having
 * to open both entities.
 *
 * Non-fatal: on failure, relationships fall back to template-based context.
 */

import { Agent } from '@mastra/core/agent'
import { z } from 'zod'
import { resolveModel } from '@/mastra/models'
import { getAIModelSettingsAdmin } from '@/lib/db/queries/project-settings'
import type { EntityType } from '@/lib/db/queries/types'

const ENRICH_SCHEMA = z.object({
  contexts: z.array(z.object({
    index: z.number().describe('1-based index of the match'),
    context: z.string().describe('2-4 sentence summary explaining the substance of this connection'),
  })),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveredMatch {
  targetType: EntityType
  targetId: string
  targetName: string
  targetDescription?: string
  similarity?: number
  strategy: 'semantic' | 'text_match'
  matchType?: 'name' | 'domain'
  matchedValue?: string
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

const ENTITY_TYPE_LABELS: Record<string, string> = {
  session: 'feedback session',
  issue: 'issue',
  contact: 'contact',
  company: 'company',
  knowledge_source: 'knowledge source',
  product_scope: 'product scope',
}

/**
 * Generate human-readable context for a batch of discovered relationships.
 * Returns a Map from targetId to context string.
 *
 * One LLM call for all matches. Falls back to null on failure (caller
 * should use template context as fallback).
 */
export async function enrichRelationshipContext(
  sourceEntityType: string,
  sourceEntityName: string,
  sourceContentSnippet: string,
  matches: DiscoveredMatch[],
  projectId?: string,
): Promise<Map<string, string>> {
  const contextMap = new Map<string, string>()

  if (matches.length === 0) return contextMap

  // Build the prompt with all matches
  const matchDescriptions = matches.map((m, i) => {
    const typeLabel = ENTITY_TYPE_LABELS[m.targetType] ?? m.targetType
    const simStr = m.similarity ? ` (${Math.round(m.similarity * 100)}% similar)` : ''
    const descStr = m.targetDescription ? `\n   Description: ${m.targetDescription.slice(0, 200)}` : ''
    const matchStr = m.matchType ? ` [${m.matchType} match: "${m.matchedValue}"]` : ''
    return `${i + 1}. [${typeLabel}] "${m.targetName}"${simStr}${matchStr}${descStr}`
  }).join('\n')

  try {
    const aiSettings = projectId ? await getAIModelSettingsAdmin(projectId) : null
    const enrichAgent = new Agent({
      name: 'Graph Context Enricher',
      instructions: 'You write concise, substantive context summaries for entity relationships in a product knowledge graph.',
      model: resolveModel(
        { name: 'graph-context-enricher', tier: 'small', fallback: 'openai/gpt-5.4-mini' },
        aiSettings,
      ),
    })

    const { object } = await enrichAgent.generate(
      `You are analyzing a product knowledge graph for a B2B SaaS product team. A ${ENTITY_TYPE_LABELS[sourceEntityType] ?? sourceEntityType} was connected to the entities below during automatic relationship discovery.

For each connection, write a short but substantive summary (2-4 sentences) that explains:
- What specific topics, problems, or themes link these two entities
- What a product manager or support lead would learn from knowing about this connection
- Any actionable insight (e.g. this feedback validates that issue, this contact is affected by that problem, this knowledge source documents the solution)

Do NOT mention similarity scores, discovery mechanisms, or how the connection was found. Write as if explaining to a colleague why these two things are related.

Source ${ENTITY_TYPE_LABELS[sourceEntityType] ?? sourceEntityType}: "${sourceEntityName}"
Content:
${sourceContentSnippet.slice(0, 2000)}

Connected entities:
${matchDescriptions}`,
      { output: ENRICH_SCHEMA },
    )

    for (const item of object.contexts) {
      const match = matches[item.index - 1]
      if (match && item.context) {
        contextMap.set(match.targetId, item.context)
      }
    }
  } catch (err) {
    // Non-fatal: caller falls back to template context. Log clearly so the failure is visible.
    console.error('[enrich-relationship-context] LLM enrichment failed, using template fallback:', err instanceof Error ? err.stack ?? err.message : err)
  }

  return contextMap
}
