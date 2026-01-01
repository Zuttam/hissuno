/**
 * Step 2: PM Review
 *
 * Analyzes session for actionable feedback and creates/upvotes issues.
 * Uses the Product Manager agent to determine if feedback is actionable.
 */

import { createStep } from '@mastra/core/workflows'
import { classifyOutputSchema, workflowOutputSchema, SessionTagType } from '../schemas'
import { createAdminClient } from '@/lib/supabase/server'

export const pmReview = createStep({
  id: 'pm-review',
  description: 'Analyze session for actionable issues',
  inputSchema: classifyOutputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { sessionId, projectId, tags, tagsApplied, reasoning } = inputData
    logger?.info('[pm-review] Starting', { sessionId, projectId })
    await writer?.write({ type: 'progress', message: 'Starting PM review...' })

    // Get the PM agent
    const pmAgent = mastra?.getAgent('productManagerAgent')
    if (!pmAgent) {
      logger?.warn('[pm-review] Product Manager agent not found, skipping analysis')
      return {
        tags: tags as SessionTagType[],
        tagsApplied,
        action: 'skipped' as const,
        skipReason: 'Product Manager agent not configured',
      }
    }

    try {
      // Create runtime context
      const { RuntimeContext } = await import('@mastra/core/runtime-context')
      const runtimeContext = new RuntimeContext()
      runtimeContext.set('projectId', projectId)

      const prompt = `Analyze session ${sessionId} for actionable feedback.

1. First, use get-session-context to retrieve the conversation
2. Determine if the session contains actionable feedback (bug, feature request, or change request)
3. If actionable, check for similar issues using find-similar-issues
4. Either upvote an existing issue or create a new one
5. If upvoting and threshold is met, generate a product spec

Return your analysis results including:
- Whether an issue was created, upvoted, or skipped
- The issue ID and title if applicable
- If skipped, explain why
- If threshold was met, whether a spec was generated`

      await writer?.write({ type: 'progress', message: 'Analyzing for actionable feedback...' })

      const response = await pmAgent.generate(prompt, {
        runtimeContext,
      })

      await writer?.write({ type: 'progress', message: 'Processing PM review response...' })

      // Parse the response
      const text = typeof response.text === 'string' ? response.text : ''
      const textLower = text.toLowerCase()

      let action: 'created' | 'upvoted' | 'skipped' = 'skipped'
      let issueId: string | undefined
      let issueTitle: string | undefined
      let skipReason: string | undefined
      let thresholdMet = false
      let specGenerated = false

      if (textLower.includes('created') && textLower.includes('issue')) {
        action = 'created'
      } else if (textLower.includes('upvoted') || textLower.includes('upvote')) {
        action = 'upvoted'
      }

      if (textLower.includes('threshold') && (textLower.includes('met') || textLower.includes('reached'))) {
        thresholdMet = true
      }
      if (textLower.includes('spec') && (textLower.includes('generated') || textLower.includes('saved'))) {
        specGenerated = true
      }

      if (action === 'skipped') {
        if (textLower.includes('skip') || textLower.includes('not actionable')) {
          skipReason = 'Session does not contain actionable feedback'
        } else if (textLower.includes('q&a') || textLower.includes('resolved')) {
          skipReason = 'Session was a simple Q&A with resolution'
        } else if (textLower.includes('few messages') || textLower.includes('short')) {
          skipReason = 'Session has too few messages for analysis'
        } else {
          skipReason = 'No actionable feedback identified'
        }
      }

      // Update session's pm_reviewed_at timestamp
      const supabase = createAdminClient()
      await supabase
        .from('sessions')
        .update({ pm_reviewed_at: new Date().toISOString() })
        .eq('id', sessionId)

      const actionMessage = action === 'created'
        ? 'Created new issue'
        : action === 'upvoted'
          ? 'Upvoted existing issue'
          : 'No actionable feedback found'
      await writer?.write({ type: 'progress', message: actionMessage })
      logger?.info('[pm-review] Completed', { action, issueId, issueTitle })

      return {
        tags: tags as SessionTagType[],
        tagsApplied,
        action,
        issueId,
        issueTitle,
        skipReason,
        thresholdMet,
        specGenerated,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[pm-review] Error', { error: message })

      return {
        tags: tags as SessionTagType[],
        tagsApplied,
        action: 'skipped' as const,
        skipReason: `PM review error: ${message}`,
      }
    }
  },
})
