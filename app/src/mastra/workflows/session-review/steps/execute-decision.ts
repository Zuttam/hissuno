/**
 * Step: Execute Decision
 *
 * Deterministic step that executes the PM decision:
 * - Creates new issue with embedding
 * - Upvotes existing issue
 * - Marks session as reviewed
 * - Triggers issue analysis workflow (fire-and-forget) on create/upvote
 *
 * Uses the shared issues-service layer for all operations.
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  createIssueAdmin,
  upvoteIssueAdmin,
  markSessionReviewedAdmin,
} from '@/lib/issues/issues-service'
import { linkEntities } from '@/lib/db/queries/entity-relationships'
import {
  preparedPMContextSchema,
  similarIssueSchema,
  pmDecisionSchema,
  executeDecisionOutputSchema,
} from '../schemas'

const executeDecisionInputSchema = preparedPMContextSchema.extend({
  similarIssues: z.array(similarIssueSchema),
  decision: pmDecisionSchema,
})

export const executeDecision = createStep({
  id: 'execute-decision',
  description: 'Execute the PM decision (create/upvote/skip)',
  inputSchema: executeDecisionInputSchema,
  outputSchema: executeDecisionOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const {
      sessionId,
      projectId,
      tags,
      tagsApplied,
      productScopeId,
      decision,
    } = inputData

    logger?.info('[execute-decision] Starting', { sessionId, action: decision.action })
    await writer?.write({ type: 'progress', message: `Executing: ${decision.action}...` })

    // Handle skip action
    if (decision.action === 'skip') {
      // Mark session as reviewed even when skipping
      await markSessionReviewedAdmin(sessionId)

      logger?.info('[execute-decision] Skipped', { reason: decision.skipReason })
      await writer?.write({ type: 'progress', message: 'No action taken' })

      return {
        sessionId,
        projectId,
        tags,
        tagsApplied,
        productScopeId,
        action: 'skipped' as const,
        skipReason: decision.skipReason,
      }
    }

    // Handle upvote action
    if (decision.action === 'upvote' && decision.existingIssueId) {
      const issueId = decision.existingIssueId

      try {
        // Use the service layer for upvote
        const result = await upvoteIssueAdmin(issueId, sessionId)

        // Write to entity_relationships
        await linkEntities(projectId, 'issue', issueId, 'session', sessionId)

        await writer?.write({
          type: 'progress',
          message: `Upvoted issue (now ${result.newUpvoteCount} votes)`,
        })

        logger?.info('[execute-decision] Upvoted', {
          issueId,
          newUpvoteCount: result.newUpvoteCount,
        })

        // Trigger issue analysis workflow (fire-and-forget)
        try {
          const workflow = mastra?.getWorkflow('issueAnalysisWorkflow')
          if (workflow && issueId) {
            const analysisRunId = `analysis-${issueId}-${Date.now()}`
            const run = await workflow.createRunAsync({ runId: analysisRunId })
            void run.start({ inputData: { issueId, projectId, runId: analysisRunId } })
            logger?.info('[execute-decision] Triggered issue analysis', { issueId })
          }
        } catch (err) {
          logger?.warn('[execute-decision] Failed to trigger issue analysis', { error: err instanceof Error ? err.message : 'Unknown' })
        }

        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          productScopeId,
          action: 'upvoted' as const,
          issueId,
          issueTitle: '', // Title not returned from upvote, but not critical
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger?.error('[execute-decision] Upvote failed', { issueId, error: message })

        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          productScopeId,
          action: 'skipped' as const,
          skipReason: `Failed to upvote issue: ${message}`,
        }
      }
    }

    // Handle create action
    if (decision.action === 'create' && decision.newIssue) {
      const { type, title, description, priority } = decision.newIssue

      try {
        // Use the service layer for create (handles DB + embeddings)
        const { issue } = await createIssueAdmin({
          projectId,
          sessionId,
          type,
          title,
          description,
          priority,
          productScopeId,
        })

        // Write to entity_relationships
        if (sessionId) {
          await linkEntities(projectId, 'issue', issue.id, 'session', sessionId)
        }

        await writer?.write({
          type: 'progress',
          message: `Created issue: ${title}`,
        })

        logger?.info('[execute-decision] Created', {
          issueId: issue.id,
          type,
        })

        // Trigger issue analysis workflow (fire-and-forget)
        try {
          const workflow = mastra?.getWorkflow('issueAnalysisWorkflow')
          if (workflow && issue.id) {
            const analysisRunId = `analysis-${issue.id}-${Date.now()}`
            const run = await workflow.createRunAsync({ runId: analysisRunId })
            void run.start({ inputData: { issueId: issue.id, projectId, runId: analysisRunId } })
            logger?.info('[execute-decision] Triggered issue analysis', { issueId: issue.id })
          }
        } catch (err) {
          logger?.warn('[execute-decision] Failed to trigger issue analysis', { error: err instanceof Error ? err.message : 'Unknown' })
        }

        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          productScopeId,
          action: 'created' as const,
          issueId: issue.id,
          issueTitle: title,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger?.error('[execute-decision] Create failed', { error: message })

        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          productScopeId,
          action: 'skipped' as const,
          skipReason: `Failed to create issue: ${message}`,
        }
      }
    }

    // Fallback
    logger?.warn('[execute-decision] Invalid decision, skipping')
    await markSessionReviewedAdmin(sessionId)

    return {
      sessionId,
      projectId,
      tags,
      tagsApplied,
      productScopeId,
      action: 'skipped' as const,
      skipReason: 'Invalid decision format',
    }
  },
})
