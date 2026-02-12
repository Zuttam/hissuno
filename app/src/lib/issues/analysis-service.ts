/**
 * Issue Analysis Service
 * Shared logic for triggering and managing issue analysis runs.
 * Follows the spec-generation-service.ts pattern.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>

export type TriggerIssueAnalysisParams = {
  projectId: string
  issueId: string
  supabase: AnySupabaseClient
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
  const { projectId, issueId, supabase } = params

  // Verify issue exists and belongs to this project
  const { data: issue, error: issueError } = await supabase
    .from('issues')
    .select('id, title, project_id')
    .eq('id', issueId)
    .eq('project_id', projectId)
    .single()

  if (issueError || !issue) {
    console.error('[analysis-service] Issue not found', issueId, issueError)
    return { success: false, error: 'Issue not found.', statusCode: 404 }
  }

  // Check if analysis is already running for this issue
  const { data: runningAnalysis } = await supabase
    .from('issue_analysis_runs')
    .select('*')
    .eq('issue_id', issueId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

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
  const { data: analysisRunRecord, error: insertError } = await supabase
    .from('issue_analysis_runs')
    .insert({
      issue_id: issueId,
      project_id: projectId,
      run_id: runId,
      status: 'running',
      started_at: new Date().toISOString(),
      metadata: {
        issueTitle: issue.title,
      },
    })
    .select()
    .single()

  if (insertError || !analysisRunRecord) {
    console.error('[analysis-service] Failed to create analysis run record', insertError)
    return { success: false, error: 'Failed to start analysis.', statusCode: 500 }
  }

  console.log('[analysis-service] Created analysis run record:', analysisRunRecord.id)

  return {
    success: true,
    runId,
    analysisRunId: analysisRunRecord.id,
  }
}

/**
 * Get the current status of analysis for an issue
 */
export async function getIssueAnalysisStatus(
  params: Pick<TriggerIssueAnalysisParams, 'issueId' | 'supabase'>
): Promise<GetIssueAnalysisStatusResult> {
  const { issueId, supabase } = params

  const { data: latestRun, error } = await supabase
    .from('issue_analysis_runs')
    .select('*')
    .eq('issue_id', issueId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[analysis-service] Failed to get analysis run status', error)
  }

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
    startedAt: latestRun.started_at,
    completedAt: latestRun.completed_at ?? undefined,
    errorMessage: latestRun.error_message ?? undefined,
  }
}

/**
 * Cancel a running analysis
 */
export async function cancelIssueAnalysis(
  params: Pick<TriggerIssueAnalysisParams, 'issueId' | 'supabase'>
): Promise<{ success: boolean; error?: string }> {
  const { issueId, supabase } = params

  const { data: runningAnalysis, error: findError } = await supabase
    .from('issue_analysis_runs')
    .select('id')
    .eq('issue_id', issueId)
    .eq('status', 'running')
    .single()

  if (findError && findError.code !== 'PGRST116') {
    console.error('[analysis-service] Failed to find running analysis run', findError)
    return { success: false, error: 'Failed to find running analysis.' }
  }

  if (!runningAnalysis) {
    return { success: false, error: 'No running analysis found.' }
  }

  const { error: updateError } = await supabase
    .from('issue_analysis_runs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', runningAnalysis.id)

  if (updateError) {
    console.error('[analysis-service] Failed to cancel analysis run', updateError)
    return { success: false, error: 'Failed to cancel analysis.' }
  }

  return { success: true }
}
