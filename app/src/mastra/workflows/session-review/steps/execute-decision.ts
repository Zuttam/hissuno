/**
 * Step: Execute Decision
 *
 * Deterministic step that executes the PM decision:
 * - Creates new issue with embedding, impact, and effort data
 * - Upvotes existing issue and checks spec threshold
 * - Marks session as reviewed
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
import {
  preparedPMContextSchema,
  similarIssueSchema,
  impactAnalysisSchema,
  effortEstimationSchema,
  pmDecisionSchema,
  executeDecisionOutputSchema,
} from '../schemas'

const executeDecisionInputSchema = preparedPMContextSchema.extend({
  similarIssues: z.array(similarIssueSchema),
  impactAnalysis: impactAnalysisSchema.nullable(),
  effortEstimation: effortEstimationSchema.nullable(),
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
      decision,
      impactAnalysis,
      effortEstimation,
      localCodePath,
      codebaseLeaseId,
      codebaseCommitSha,
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
        action: 'skipped' as const,
        skipReason: decision.skipReason,
        localCodePath,
        codebaseLeaseId,
        codebaseCommitSha,
      }
    }

    // Handle upvote action
    if (decision.action === 'upvote' && decision.existingIssueId) {
      const issueId = decision.existingIssueId

      try {
        // Use the service layer for upvote
        const result = await upvoteIssueAdmin(issueId, sessionId)

        await writer?.write({
          type: 'progress',
          message: `Upvoted issue (now ${result.newUpvoteCount} votes)`,
        })

        logger?.info('[execute-decision] Upvoted', {
          issueId,
          newUpvoteCount: result.newUpvoteCount,
        })

        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          action: 'upvoted' as const,
          issueId,
          issueTitle: '', // Title not returned from upvote, but not critical
          localCodePath,
          codebaseLeaseId,
          codebaseCommitSha,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger?.error('[execute-decision] Upvote failed', { issueId, error: message })

        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          action: 'skipped' as const,
          skipReason: `Failed to upvote issue: ${message}`,
          localCodePath,
          codebaseLeaseId,
          codebaseCommitSha,
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
          impactAnalysis,
          effortEstimation: effortEstimation
            ? {
                estimate: effortEstimation.estimate,
                reasoning: effortEstimation.reasoning,
                affectedFiles: effortEstimation.affectedFiles,
              }
            : null,
        })

        await writer?.write({
          type: 'progress',
          message: `Created issue: ${title}`,
        })

        logger?.info('[execute-decision] Created', {
          issueId: issue.id,
          type,
          impactScore: impactAnalysis?.impactScore,
          effort: effortEstimation?.estimate,
        })

        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          action: 'created' as const,
          issueId: issue.id,
          issueTitle: title,
          impactScore: impactAnalysis?.impactScore,
          effortEstimate: effortEstimation?.estimate,
          localCodePath,
          codebaseLeaseId,
          codebaseCommitSha,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger?.error('[execute-decision] Create failed', { error: message })

        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          action: 'skipped' as const,
          skipReason: `Failed to create issue: ${message}`,
          localCodePath,
          codebaseLeaseId,
          codebaseCommitSha,
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
      action: 'skipped' as const,
      skipReason: 'Invalid decision format',
      localCodePath,
      codebaseLeaseId,
      codebaseCommitSha,
    }
  },
})
