/**
 * Step: Compute Scores
 *
 * Deterministic step that:
 * 1. Computes velocity score from session timestamps
 * 2. Blends technical impact with customer data
 * 3. Maps effort estimate to numeric score
 * 4. Calculates multi-factor priority (unless manually overridden)
 * 5. Persists all results to the database
 */

import { createStep } from '@mastra/core/workflows'
import { createAdminClient } from '@/lib/supabase/server'
import { updateIssueAnalysis } from '@/lib/supabase/issues'
import { computeVelocity } from '@/lib/issues/velocity'
import { computeImpact } from '@/lib/issues/impact'
import { mapEffortToScore } from '@/lib/issues/effort'
import { calculateMultiFactorPriority } from '@/lib/issues/issues-service'
import { analyzeOutputSchema, workflowOutputSchema } from '../schemas'
import type { EffortEstimate, IssueImpactAnalysis } from '@/types/issue'

export const computeScores = createStep({
  id: 'compute-scores',
  description: 'Compute velocity, blend impact, map effort, calculate priority, and persist',
  inputSchema: analyzeOutputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const {
      issueId, projectId, issue, sessions, sessionTimestamps,
      technicalImpactScore, technicalImpactReasoning,
      technicalEffortEstimate, technicalEffortReasoning,
      technicalAffectedFiles, technicalAffectedAreas,
      codebaseLeaseId,
    } = inputData

    logger?.info('[compute-scores] Starting', { issueId })
    await writer?.write({ type: 'progress', message: 'Computing scores...' })

    // 1. Compute velocity
    const velocity = computeVelocity({
      sessionTimestamps: sessionTimestamps.map((t) => new Date(t)),
      upvoteCount: issue.upvoteCount,
    })
    logger?.info('[compute-scores] Velocity computed', { score: velocity.score })

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

    // 4. Calculate priority (only when not manually overridden)
    let priority: string | null = null
    if (!issue.priorityManualOverride) {
      priority = calculateMultiFactorPriority(velocity.score, impact.score, effortScore)
    }

    // 5. Persist to DB
    await writer?.write({ type: 'progress', message: 'Saving analysis results...' })
    const supabase = createAdminClient()

    const impactAnalysis: IssueImpactAnalysis | null = technicalImpactScore != null ? {
      affectedAreas: technicalAffectedAreas,
      impactScore: impact.score,
      reasoning: impact.reasoning,
    } : null

    const updateData: Record<string, unknown> = {
      velocityScore: velocity.score,
      velocityReasoning: velocity.reasoning,
      impactScore: impact.score,
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
      message: `Analysis complete: V=${velocity.score} I=${impact.score} E=${effortScore ?? '-'}`,
    })

    logger?.info('[compute-scores] Completed', {
      velocity: velocity.score,
      impact: impact.score,
      effort: effortScore,
      priority,
    })

    return {
      issueId,
      projectId,
      success: true,
      velocityScore: velocity.score,
      impactScore: impact.score,
      effortScore,
      priority,
      codebaseLeaseId,
      codebaseCleanedUp: false, // cleanup step handles this
    }
  },
})
