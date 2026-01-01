/**
 * Step 1: Classify Session
 *
 * Analyzes session conversation and applies classification tags.
 * Tags: general_feedback, wins, losses, bug, feature_request, change_request
 */

import { createStep } from '@mastra/core/workflows'
import { workflowInputSchema, classifyOutputSchema, SessionTagType } from '../schemas'
import { updateSessionTags } from '@/lib/supabase/sessions'

export const classifySession = createStep({
  id: 'classify-session',
  description: 'Analyze session and apply classification tags',
  inputSchema: workflowInputSchema,
  outputSchema: classifyOutputSchema,
  execute: async ({ inputData, mastra, runtimeContext, getInitData, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { sessionId, projectId } = inputData
    logger?.info('[classify-session] Starting', { sessionId, projectId })
    await writer?.write({ type: 'progress', message: 'Starting session classification...' })

    // Get the tagging agent
    const taggingAgent = mastra?.getAgent('taggingAgent')
    if (!taggingAgent) {
      logger?.warn('[classify-session] Tagging agent not found, skipping classification')
      return {
        sessionId,
        projectId,
        tags: [] as SessionTagType[],
        tagsApplied: false,
        reasoning: 'Tagging agent not configured',
      }
    }

    try {
      // Build the classification prompt
      const prompt = `Analyze session ${sessionId} and classify it with appropriate tags.

1. First, use get-session-context to retrieve the conversation messages
2. Analyze the conversation to determine which tags apply
3. Return your classification

Available tags and when to apply them:
- general_feedback: Session contains general product feedback, suggestions, or opinions
- wins: User expresses satisfaction, success, gratitude, or positive experience
- losses: User expresses frustration, failure, confusion, or negative experience
- bug: User reports something not working as expected (technical issue)
- feature_request: User asks for new functionality that doesn't exist
- change_request: User requests modification to existing functionality

Rules:
- Sessions can have MULTIPLE tags (e.g., both "bug" and "losses")
- Apply "wins" when user thanks, compliments, or shows satisfaction
- Apply "losses" when user is frustrated, confused, or disappointed
- "bug" is for technical issues; "change_request" is for design/UX issues
- "feature_request" is for entirely new capabilities

Return a JSON object with:
{
  "tags": ["tag1", "tag2"],
  "reasoning": "Brief explanation of why each tag was applied"
}`

      // Create runtime context with project ID
      const { RuntimeContext } = await import('@mastra/core/runtime-context')
      const ctx = new RuntimeContext()
      ctx.set('projectId', projectId)

      await writer?.write({ type: 'progress', message: 'Calling classification agent...' })

      const response = await taggingAgent.generate(prompt, {
        runtimeContext: ctx,
      })

      await writer?.write({ type: 'progress', message: 'Parsing classification response...' })

      // Parse the response
      const text = typeof response.text === 'string' ? response.text : ''
      logger?.debug('[classify-session] Agent response', { responseLength: text.length })

      // Try to extract JSON from the response
      let tags: SessionTagType[] = []
      let reasoning = 'No specific reasoning provided'

      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (Array.isArray(parsed.tags)) {
            // Validate tags
            const validTags = new Set([
              'general_feedback',
              'wins',
              'losses',
              'bug',
              'feature_request',
              'change_request',
            ])
            tags = parsed.tags.filter((t: string) => validTags.has(t)) as SessionTagType[]
          }
          if (parsed.reasoning) {
            reasoning = parsed.reasoning
          }
        } catch {
          logger?.warn('[classify-session] Failed to parse JSON from response')
        }
      }

      // Fallback: detect tags from text if JSON parsing failed
      if (tags.length === 0) {
        const textLower = text.toLowerCase()
        if (textLower.includes('general_feedback') || textLower.includes('feedback')) {
          tags.push('general_feedback')
        }
        if (textLower.includes('wins') || textLower.includes('satisfied') || textLower.includes('thank')) {
          tags.push('wins')
        }
        if (textLower.includes('losses') || textLower.includes('frustrated') || textLower.includes('disappointed')) {
          tags.push('losses')
        }
        if (textLower.includes('bug') || textLower.includes('error') || textLower.includes('broken')) {
          tags.push('bug')
        }
        if (textLower.includes('feature_request') || textLower.includes('new feature')) {
          tags.push('feature_request')
        }
        if (textLower.includes('change_request') || textLower.includes('change request')) {
          tags.push('change_request')
        }
        reasoning = 'Tags detected from response text'
      }

      // Apply tags to session
      await writer?.write({ type: 'progress', message: 'Saving tags to session...' })
      const updateResult = await updateSessionTags(sessionId, tags, true)
      const tagsApplied = updateResult.success

      if (!tagsApplied) {
        logger?.error('[classify-session] Failed to apply tags', { error: updateResult.error })
      }

      await writer?.write({ type: 'progress', message: `Applied ${tags.length} tag(s)` })
      logger?.info('[classify-session] Completed', { tags, tagsApplied })

      return {
        sessionId,
        projectId,
        tags,
        tagsApplied,
        reasoning,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[classify-session] Error', { error: message })

      return {
        sessionId,
        projectId,
        tags: [] as SessionTagType[],
        tagsApplied: false,
        reasoning: `Classification error: ${message}`,
      }
    }
  },
})
