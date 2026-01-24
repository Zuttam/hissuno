/**
 * Step: PM Decision
 *
 * Agent step that makes the final decision about issue handling.
 * Receives pre-computed context (session, duplicates, impact, effort)
 * and decides: skip, create new issue, or upvote existing.
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  preparedPMContextSchema,
  similarIssueSchema,
  impactAnalysisSchema,
  effortEstimationSchema,
  pmDecisionSchema,
} from '../schemas'

const pmDecisionInputSchema = preparedPMContextSchema.extend({
  similarIssues: z.array(similarIssueSchema),
  impactAnalysis: impactAnalysisSchema.nullable(),
  effortEstimation: effortEstimationSchema.nullable(),
})

const pmDecisionOutputSchema = pmDecisionInputSchema.extend({
  decision: pmDecisionSchema,
})

export const pmDecision = createStep({
  id: 'pm-decision',
  description: 'Make PM decision based on enriched context',
  inputSchema: pmDecisionInputSchema,
  outputSchema: pmDecisionOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { sessionId, projectId, tags, messages, settings, similarIssues, impactAnalysis, effortEstimation } =
      inputData

    logger?.info('[pm-decision] Starting', { sessionId, projectId })
    await writer?.write({ type: 'progress', message: 'Making PM decision...' })

    // Check if issue tracking is disabled
    if (!settings.issueTrackingEnabled) {
      logger?.info('[pm-decision] Issue tracking disabled, skipping')
      return {
        ...inputData,
        decision: {
          action: 'skip' as const,
          skipReason: 'Issue tracking is disabled for this project',
        },
      }
    }

    // Check minimum message count
    if (messages.length < 3) {
      logger?.info('[pm-decision] Too few messages, skipping')
      return {
        ...inputData,
        decision: {
          action: 'skip' as const,
          skipReason: 'Session has too few messages for analysis',
        },
      }
    }

    // Get the PM agent
    const pmAgent = mastra?.getAgent('productManagerAgent')
    if (!pmAgent) {
      logger?.warn('[pm-decision] Product Manager agent not found')
      return {
        ...inputData,
        decision: {
          action: 'skip' as const,
          skipReason: 'Product Manager agent not configured',
        },
      }
    }

    try {
      // Build the decision prompt with all context
      const conversationSummary = messages
        .map((m) => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 500)}`)
        .join('\n\n')

      const similarIssuesSummary =
        similarIssues.length > 0
          ? similarIssues
              .map(
                (i) =>
                  `- [${Math.round(i.similarity * 100)}% match] ${i.title} (${i.status}, ${i.upvoteCount} upvotes)\n  ID: ${i.issueId}`
              )
              .join('\n')
          : 'No similar issues found.'

      const impactSummary = impactAnalysis
        ? `Impact Score: ${impactAnalysis.impactScore}/5\n${impactAnalysis.reasoning}`
        : 'Impact analysis not available.'

      const effortSummary = effortEstimation
        ? `Effort: ${effortEstimation.estimate} (${Math.round(effortEstimation.confidence * 100)}% confidence)\n${effortEstimation.reasoning}`
        : 'Effort estimation not available.'

      const tagHints = buildTagHints(tags)

      const prompt = `You are a Product Manager analyzing a customer support session. Make a decision based on the context below.

## Session Tags
${tags.length > 0 ? tags.join(', ') : 'No tags applied'}
${tagHints}

## Conversation
${conversationSummary}

## Similar Existing Issues
${similarIssuesSummary}

## Impact Analysis
${impactSummary}

## Effort Estimation
${effortSummary}

## Your Decision

Based on the above, decide one of:

1. **SKIP** - If the session is:
   - A simple Q&A that was resolved
   - General positive feedback without actionable items
   - Off-topic or spam
   - Tags include only "wins" without other actionable tags

2. **UPVOTE** - If similarity score is >= 0.7 to an existing issue:
   - Provide the existing issue ID to upvote

3. **CREATE** - If actionable feedback with no similar issues:
   - Provide issue type (bug, feature_request, change_request)
   - Write a clear, concise title
   - Write a detailed description with user quotes
   - Suggest priority (low/medium/high) based on impact and user sentiment

Return ONLY a JSON object in this exact format:

For SKIP:
{"action": "skip", "skipReason": "Brief explanation"}

For UPVOTE:
{"action": "upvote", "existingIssueId": "uuid-of-issue-to-upvote"}

For CREATE:
{"action": "create", "newIssue": {"type": "bug|feature_request|change_request", "title": "Issue title", "description": "Detailed description with quotes", "priority": "low|medium|high"}}`

      await writer?.write({ type: 'progress', message: 'Consulting PM agent...' })

      const response = await pmAgent.generate(prompt)

      // Parse the response
      const text = typeof response.text === 'string' ? response.text : ''

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger?.warn('[pm-decision] No JSON found in response, defaulting to skip')
        return {
          ...inputData,
          decision: {
            action: 'skip' as const,
            skipReason: 'Unable to parse PM agent response',
          },
        }
      }

      const parsed = JSON.parse(jsonMatch[0])

      // Validate and normalize the decision
      if (parsed.action === 'skip') {
        return {
          ...inputData,
          decision: {
            action: 'skip' as const,
            skipReason: parsed.skipReason ?? 'No actionable feedback',
          },
        }
      }

      if (parsed.action === 'upvote' && parsed.existingIssueId) {
        return {
          ...inputData,
          decision: {
            action: 'upvote' as const,
            existingIssueId: parsed.existingIssueId,
          },
        }
      }

      if (parsed.action === 'create' && parsed.newIssue) {
        return {
          ...inputData,
          decision: {
            action: 'create' as const,
            newIssue: {
              type: parsed.newIssue.type,
              title: parsed.newIssue.title,
              description: parsed.newIssue.description,
              priority: parsed.newIssue.priority ?? 'low',
            },
          },
        }
      }

      // Fallback
      logger?.warn('[pm-decision] Invalid decision format, defaulting to skip')
      return {
        ...inputData,
        decision: {
          action: 'skip' as const,
          skipReason: 'Invalid PM agent response format',
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[pm-decision] Error', { error: message })

      return {
        ...inputData,
        decision: {
          action: 'skip' as const,
          skipReason: `PM decision error: ${message}`,
        },
      }
    }
  },
})

/**
 * Build hints based on session tags to guide the PM agent
 */
function buildTagHints(tags: string[]): string {
  const hints: string[] = []

  if (tags.includes('bug')) {
    hints.push('- "bug" tag suggests this is a technical issue → likely CREATE with type=bug')
  }
  if (tags.includes('feature_request')) {
    hints.push('- "feature_request" tag suggests new functionality → likely CREATE with type=feature_request')
  }
  if (tags.includes('change_request')) {
    hints.push('- "change_request" tag suggests UX improvement → likely CREATE with type=change_request')
  }
  if (tags.includes('losses')) {
    hints.push('- "losses" tag indicates user frustration → consider higher priority')
  }
  if (tags.includes('wins') && !tags.includes('bug') && !tags.includes('feature_request')) {
    hints.push('- "wins" tag without actionable tags → likely SKIP')
  }
  if (tags.includes('general_feedback')) {
    hints.push('- "general_feedback" usually means no specific issue → evaluate carefully')
  }

  return hints.length > 0 ? '\n### Tag Hints\n' + hints.join('\n') : ''
}
