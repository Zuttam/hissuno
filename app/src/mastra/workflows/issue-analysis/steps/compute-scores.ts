/**
 * Step: Compute Scores
 *
 * Deterministic step that:
 * 1. Computes reach score from session timestamps
 * 2. Blends technical impact with customer data
 * 3. Maps effort estimate to numeric score
 * 4. Calculates RICE priority (unless manually overridden)
 * 5. Persists all results to the database
 */

import { createStep } from '@mastra/core/workflows'
import { createAdminClient } from '@/lib/supabase/server'
import { updateIssueAnalysis } from '@/lib/supabase/issues'
import { computeReach } from '@/lib/issues/reach'
import { computeImpact } from '@/lib/issues/impact'
import { mapEffortToScore } from '@/lib/issues/effort'
import { calculateRICEScore, riceScoreToPriority } from '@/lib/issues/rice'
import { analyzeOutputSchema, workflowOutputSchema } from '../schemas'
import type { EffortEstimate, IssueImpactAnalysis } from '@/types/issue'

export const computeScores = createStep({
  id: 'compute-scores',
  description: 'Compute reach, blend impact, map effort, calculate RICE priority, and persist',
  inputSchema: analyzeOutputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const {
      issueId, projectId, issue, sessions, sessionTimestamps,
      technicalImpactScore,
      technicalEffortEstimate, technicalEffortReasoning,
      technicalAffectedFiles, technicalAffectedAreas,
      technicalConfidenceScore, technicalConfidenceReasoning,
      codebaseLeaseId,
    } = inputData

    logger?.info('[compute-scores] Starting', { issueId })
    await writer?.write({ type: 'progress', message: 'Computing scores...' })

    // 1. Compute reach
    const reach = computeReach({
      sessionTimestamps: sessionTimestamps.map((t) => new Date(t)),
      upvoteCount: issue.upvoteCount,
    })
    logger?.info('[compute-scores] Reach computed', { score: reach.score })

    // 2. Compute blended impact
    const impact = computeImpact({
      technicalImpactScore,
      sessions: sessions.map((s) => ({
        contactId: s.contactId,
        companyId: s.companyId,
        companyArr: s.companyArr,
        companyStage: s.companyStage,
      })),
    })
    logger?.info('[compute-scores] Impact computed', { score: impact.score })

    // 3. Map effort
    const effortScore = mapEffortToScore(
      (technicalEffortEstimate as EffortEstimate) ?? (issue.effortEstimate as EffortEstimate | null)
    )
    logger?.info('[compute-scores] Effort mapped', { score: effortScore })

    // 4. Use agent-provided confidence, default to 3 (medium) when not provided
    const confidenceScore = technicalConfidenceScore ?? 3
    const confidenceReasoning = technicalConfidenceReasoning ?? 'Default medium confidence (agent did not provide score)'

    // 5. Calculate RICE score and priority (only when not manually overridden)
    const riceScore = calculateRICEScore(reach.score, impact.score, confidenceScore, effortScore)
    let priority: string | null = null
    if (!issue.priorityManualOverride) {
      priority = riceScoreToPriority(riceScore)
    }

    // 6. Persist to DB
    await writer?.write({ type: 'progress', message: 'Saving analysis results...' })
    const supabase = createAdminClient()

    const impactAnalysis: IssueImpactAnalysis | null = technicalImpactScore != null ? {
      affectedAreas: technicalAffectedAreas,
      impactScore: impact.score,
      reasoning: impact.reasoning,
    } : null

    const updateData: Record<string, unknown> = {
      reachScore: reach.score,
      reachReasoning: reach.reasoning,
      impactScore: impact.score,
      confidenceScore,
      confidenceReasoning,
      effortScore,
      analysisComputedAt: new Date().toISOString(),
    }

    if (impactAnalysis) {
      updateData.impactAnalysis = impactAnalysis
      updateData.affectedAreas = technicalAffectedAreas.map((a) => a.area)
    }

    if (technicalEffortEstimate) {
      updateData.effortEstimate = technicalEffortEstimate
      updateData.effortReasoning = technicalEffortReasoning
      updateData.affectedFiles = technicalAffectedFiles
    }

    if (priority) {
      updateData.priority = priority
    }

    await updateIssueAnalysis(supabase, issueId, updateData)

    await writer?.write({
      type: 'progress',
      message: `Analysis complete: R=${reach.score} I=${impact.score} C=${confidenceScore} E=${effortScore ?? '-'} RICE=${riceScore?.toFixed(1) ?? '-'}`,
    })

    logger?.info('[compute-scores] Completed', {
      reach: reach.score,
      impact: impact.score,
      confidence: confidenceScore,
      effort: effortScore,
      riceScore,
      priority,
    })

    return {
      issueId,
      projectId,
      success: true,
      reachScore: reach.score,
      impactScore: impact.score,
      confidenceScore,
      effortScore,
      riceScore,
      priority,
      codebaseLeaseId,
      codebaseCleanedUp: false, // cleanup step handles this
    }
  },
})
