/**
 * Goal Classification
 *
 * Lightweight LLM call to classify which specific product scope goal
 * an entity best contributes to. Uses gpt-4o-mini for consistency
 * with the extract-topics pattern.
 */

import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { ProductScopeGoal } from '@/types/product-scope'

export interface ClassifyGoalInput {
  entityName: string
  contentSnippet: string       // first ~1500 chars of entity content
  scopeName: string
  scopeDescription: string
  goals: ProductScopeGoal[]
  matchedTopic?: string        // the topic that triggered the scope match
}

export interface ClassifyGoalResult {
  matchedGoalId: string | null
  matchedGoalText: string | null
  reasoning: string
}

/**
 * Classify which goal an entity serves within a product scope.
 *
 * - If scope has 0 goals: returns null goal with topic-based reasoning
 * - If scope has goals: uses LLM to pick the best match (or none)
 * - On LLM failure: falls back to null goal with template reasoning
 */
export async function classifyGoal(input: ClassifyGoalInput): Promise<ClassifyGoalResult> {
  const { entityName, contentSnippet, scopeName, scopeDescription, goals, matchedTopic } = input

  // No goals defined - return with topic-based reasoning
  if (!goals || goals.length === 0) {
    return {
      matchedGoalId: null,
      matchedGoalText: null,
      reasoning: matchedTopic
        ? `Matched via topic: ${matchedTopic}`
        : `Matched to scope "${scopeName}" via text similarity`,
    }
  }

  try {
    const goalsText = goals.map((g, i) => `${i + 1}. [${g.id}] ${g.text}`).join('\n')

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        goalId: z.string().nullable().describe('The ID of the best matching goal, or null if none fit'),
        reasoning: z.string().describe('Brief explanation of why this goal was chosen (or why none matched)'),
      }),
      prompt: `Given this entity and product scope with goals, which goal does this entity best contribute to? Pick one or none.

Entity: ${entityName}
Content (snippet):
${contentSnippet.slice(0, 1500)}

Product Scope: ${scopeName}
Description: ${scopeDescription}

Goals:
${goalsText}

Pick the single goal this entity most directly addresses. If none of the goals are relevant, return goalId as null.`,
    })

    // Validate the returned goalId actually exists
    const matchedGoal = object.goalId
      ? goals.find((g) => g.id === object.goalId) ?? null
      : null

    return {
      matchedGoalId: matchedGoal?.id ?? null,
      matchedGoalText: matchedGoal?.text ?? null,
      reasoning: object.reasoning,
    }
  } catch {
    // LLM failure is non-fatal - return no goal with fallback reasoning
    return {
      matchedGoalId: null,
      matchedGoalText: null,
      reasoning: matchedTopic
        ? `Matched via topic: ${matchedTopic} (goal classification unavailable)`
        : `Matched to scope "${scopeName}" (goal classification unavailable)`,
    }
  }
}
