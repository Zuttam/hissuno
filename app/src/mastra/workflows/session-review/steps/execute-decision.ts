/**
 * Step: Execute Decision
 *
 * Deterministic step that executes the PM decision:
 * - Creates new issue with embedding, impact, and effort data
 * - Upvotes existing issue and checks spec threshold
 * - Marks session as reviewed
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
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
      settings,
      decision,
      impactAnalysis,
      effortEstimation,
    } = inputData

    logger?.info('[execute-decision] Starting', { sessionId, action: decision.action })
    await writer?.write({ type: 'progress', message: `Executing: ${decision.action}...` })

    const supabase = createAdminClient()

    // Always mark session as PM reviewed
    await supabase
      .from('sessions')
      .update({ pm_reviewed_at: new Date().toISOString() })
      .eq('id', sessionId)

    // Handle skip action
    if (decision.action === 'skip') {
      logger?.info('[execute-decision] Skipped', { reason: decision.skipReason })
      await writer?.write({ type: 'progress', message: 'No action taken' })

      return {
        sessionId,
        projectId,
        tags,
        tagsApplied,
        action: 'skipped' as const,
        skipReason: decision.skipReason,
      }
    }

    // Handle upvote action
    if (decision.action === 'upvote' && decision.existingIssueId) {
      const issueId = decision.existingIssueId

      // Get current issue state
      const { data: issue, error: issueError } = await supabase
        .from('issues')
        .select('id, title, upvote_count, priority_manual_override, priority, product_spec')
        .eq('id', issueId)
        .single()

      if (issueError || !issue) {
        logger?.error('[execute-decision] Issue not found for upvote', { issueId })
        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          action: 'skipped' as const,
          skipReason: `Issue not found: ${issueId}`,
        }
      }

      // Calculate new values
      const newUpvoteCount = (issue.upvote_count ?? 1) + 1
      const newPriority = issue.priority_manual_override
        ? issue.priority
        : calculatePriority(newUpvoteCount)

      // Update the issue
      await supabase
        .from('issues')
        .update({
          upvote_count: newUpvoteCount,
          priority: newPriority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', issueId)

      // Link session to issue
      await supabase
        .from('issue_sessions')
        .insert({ issue_id: issueId, session_id: sessionId })
        .select()
        .maybeSingle()

      // Check if spec threshold met
      const thresholdMet = newUpvoteCount >= settings.issueSpecThreshold && !issue.product_spec

      await writer?.write({
        type: 'progress',
        message: `Upvoted issue (now ${newUpvoteCount} votes)`,
      })

      logger?.info('[execute-decision] Upvoted', { issueId, newUpvoteCount, thresholdMet })

      return {
        sessionId,
        projectId,
        tags,
        tagsApplied,
        action: 'upvoted' as const,
        issueId,
        issueTitle: issue.title,
        thresholdMet,
      }
    }

    // Handle create action
    if (decision.action === 'create' && decision.newIssue) {
      const { type, title, description, priority } = decision.newIssue

      // Create the issue with impact and effort data
      const { data: issue, error: issueError } = await supabase
        .from('issues')
        .insert({
          project_id: projectId,
          type,
          title,
          description,
          priority,
          upvote_count: 1,
          status: 'open',
          // Impact analysis
          affected_areas: impactAnalysis?.affectedAreas.map((a) => a.area) ?? [],
          impact_score: impactAnalysis?.impactScore ?? null,
          impact_analysis: impactAnalysis ?? null,
          // Effort estimation
          effort_estimate: effortEstimation?.estimate ?? null,
          effort_reasoning: effortEstimation?.reasoning ?? null,
          affected_files: effortEstimation?.affectedFiles ?? [],
        })
        .select('id')
        .single()

      if (issueError || !issue) {
        logger?.error('[execute-decision] Failed to create issue', { error: issueError?.message })
        return {
          sessionId,
          projectId,
          tags,
          tagsApplied,
          action: 'skipped' as const,
          skipReason: `Failed to create issue: ${issueError?.message}`,
        }
      }

      // Link session to issue
      await supabase.from('issue_sessions').insert({
        issue_id: issue.id,
        session_id: sessionId,
      })

      // Generate and store embedding for semantic search
      try {
        const { upsertIssueEmbedding } = await import('@/lib/issues/embedding-service')
        await upsertIssueEmbedding(issue.id, projectId, title, description)
      } catch (embedError) {
        logger?.warn('[execute-decision] Failed to embed issue', { error: embedError })
      }

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
      }
    }

    // Fallback
    logger?.warn('[execute-decision] Invalid decision, skipping')
    return {
      sessionId,
      projectId,
      tags,
      tagsApplied,
      action: 'skipped' as const,
      skipReason: 'Invalid decision format',
    }
  },
})

/**
 * Calculate priority based on upvote count
 */
function calculatePriority(upvoteCount: number): 'low' | 'medium' | 'high' {
  if (upvoteCount >= 5) return 'high'
  if (upvoteCount >= 3) return 'medium'
  return 'low'
}
