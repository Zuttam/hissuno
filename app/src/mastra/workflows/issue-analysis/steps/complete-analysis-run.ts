/**
 * Step: Complete Analysis Run (Issue Analysis Workflow)
 *
 * Final step that marks the issueAnalysisRuns record as completed.
 * This centralizes run lifecycle management so that both the manual
 * (SSE stream) and automatic (fire-and-forget) paths get consistent
 * status tracking without needing to consume the workflow stream.
 */

import { createStep } from '@mastra/core/workflows'
import { db } from '@/lib/db'
import { issueAnalysisRuns } from '@/lib/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { workflowOutputSchema } from '../schemas'

export const completeAnalysisRun = createStep({
  id: 'complete-analysis-run',
  description: 'Mark the analysis run record as completed',
  inputSchema: workflowOutputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data not found')

    const logger = mastra?.getLogger()
    const { issueId, projectId } = inputData

    // The runId follows the convention: analysis-{issueId}-{timestamp}
    // Find the running record for this issue and mark it completed
    try {
      const result = await db
        .update(issueAnalysisRuns)
        .set({
          status: inputData.success ? 'completed' : 'failed',
          completed_at: new Date(),
          ...(inputData.success ? {} : { error_message: inputData.error ?? 'Analysis failed' }),
        })
        .where(
          and(
            eq(issueAnalysisRuns.issue_id, issueId),
            eq(issueAnalysisRuns.status, 'running'),
          )
        )
        .returning({ id: issueAnalysisRuns.id })

      if (result.length > 0) {
        logger?.info('[complete-analysis-run] Marked run as completed', { issueId, projectId, runId: result[0].id })
      }
    } catch (err) {
      // Non-fatal - the analysis itself already succeeded
      logger?.warn('[complete-analysis-run] Failed to update run record', {
        issueId,
        error: err instanceof Error ? err.message : 'Unknown',
      })
    }

    return inputData
  },
})
