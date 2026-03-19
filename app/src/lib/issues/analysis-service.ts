/**
 * Issue Analysis Service
 * Shared logic for triggering and managing issue analysis runs.
 */

import { db } from '@/lib/db'
import { issues, issueAnalysisRuns } from '@/lib/db/schema/app'
import { eq, and, desc } from 'drizzle-orm'

export type TriggerIssueAnalysisParams = {
  projectId: string
  issueId: string
}

export type TriggerIssueAnalysisResult = {
  success: true
  runId: string
  analysisRunId: string
} | {
  success: false
  error: string
  statusCode: number
  runId?: string
  analysisRunId?: string
}

export type GetIssueAnalysisStatusResult = {
  isRunning: boolean
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  analysisRunId?: string
  runId?: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

/**
 * Triggers issue analysis for an issue.
 * Creates a record in issue_analysis_runs and returns the runId for SSE streaming.
 */
export async function triggerIssueAnalysis(
  params: TriggerIssueAnalysisParams
): Promise<TriggerIssueAnalysisResult> {
  const { projectId, issueId } = params

  // Verify issue exists and belongs to this project
  const issueRows = await db
    .select({ id: issues.id, title: issues.title, project_id: issues.project_id })
    .from(issues)
    .where(
      and(
        eq(issues.id, issueId),
        eq(issues.project_id, projectId)
      )
    )
    .limit(1)

  const issue = issueRows[0]

  if (!issue) {
    console.error('[analysis-service] Issue not found', issueId)
    return { success: false, error: 'Issue not found.', statusCode: 404 }
  }

  // Check if analysis is already running for this issue
  const runningRows = await db
    .select()
    .from(issueAnalysisRuns)
    .where(
      and(
        eq(issueAnalysisRuns.issue_id, issueId),
        eq(issueAnalysisRuns.status, 'running')
      )
    )
    .orderBy(desc(issueAnalysisRuns.started_at))
    .limit(1)

  const runningAnalysis = runningRows[0]

  if (runningAnalysis) {
    return {
      success: false,
      error: 'Analysis is already in progress. Cancel it first to start a new one.',
      statusCode: 409,
      runId: runningAnalysis.run_id,
      analysisRunId: runningAnalysis.id,
    }
  }

  // Generate a unique run ID
  const runId = `analysis-${issueId}-${Date.now()}`

  // Create analysis run record
  try {
    const [analysisRunRecord] = await db
      .insert(issueAnalysisRuns)
      .values({
        issue_id: issueId,
        project_id: projectId,
        run_id: runId,
        status: 'running',
        started_at: new Date(),
        metadata: {
          issueTitle: issue.title,
        },
      })
      .returning()

    if (!analysisRunRecord) {
      console.error('[analysis-service] Failed to create analysis run record')
      return { success: false, error: 'Failed to start analysis.', statusCode: 500 }
    }

    console.log('[analysis-service] Created analysis run record:', analysisRunRecord.id)

    return {
      success: true,
      runId,
      analysisRunId: analysisRunRecord.id,
    }
  } catch (error) {
    console.error('[analysis-service] Failed to create analysis run record', error)
    return { success: false, error: 'Failed to start analysis.', statusCode: 500 }
  }
}

/**
 * Get the current status of analysis for an issue
 */
export async function getIssueAnalysisStatus(
  params: Pick<TriggerIssueAnalysisParams, 'issueId'>
): Promise<GetIssueAnalysisStatusResult> {
  const { issueId } = params

  const latestRows = await db
    .select()
    .from(issueAnalysisRuns)
    .where(eq(issueAnalysisRuns.issue_id, issueId))
    .orderBy(desc(issueAnalysisRuns.started_at))
    .limit(1)

  const latestRun = latestRows[0]

  if (!latestRun) {
    return {
      isRunning: false,
      status: 'idle',
    }
  }

  return {
    isRunning: latestRun.status === 'running',
    status: latestRun.status as GetIssueAnalysisStatusResult['status'],
    analysisRunId: latestRun.id,
    runId: latestRun.run_id,
    startedAt: latestRun.started_at?.toISOString(),
    completedAt: latestRun.completed_at?.toISOString() ?? undefined,
    errorMessage: latestRun.error_message ?? undefined,
  }
}

/**
 * Cancel a running analysis
 */
export async function cancelIssueAnalysis(
  params: Pick<TriggerIssueAnalysisParams, 'issueId'>
): Promise<{ success: boolean; error?: string }> {
  const { issueId } = params

  const runningRows = await db
    .select({ id: issueAnalysisRuns.id })
    .from(issueAnalysisRuns)
    .where(
      and(
        eq(issueAnalysisRuns.issue_id, issueId),
        eq(issueAnalysisRuns.status, 'running')
      )
    )
    .limit(1)

  const runningAnalysis = runningRows[0]

  if (!runningAnalysis) {
    return { success: false, error: 'No running analysis found.' }
  }

  try {
    await db
      .update(issueAnalysisRuns)
      .set({
        status: 'cancelled',
        completed_at: new Date(),
      })
      .where(eq(issueAnalysisRuns.id, runningAnalysis.id))

    return { success: true }
  } catch (error) {
    console.error('[analysis-service] Failed to cancel analysis run', error)
    return { success: false, error: 'Failed to cancel analysis.' }
  }
}
