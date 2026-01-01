/**
 * Spec Generation Service
 * Shared logic for triggering and managing product spec generation
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>

export type TriggerSpecGenerationParams = {
  projectId: string
  issueId: string
  supabase: AnySupabaseClient
  /** When true, allows regenerating an existing spec */
  regenerate?: boolean
}

export type TriggerSpecGenerationResult = {
  success: true
  runId: string
  specRunId: string
} | {
  success: false
  error: string
  statusCode: number
  /** If spec generation is already running */
  runId?: string
  specRunId?: string
}

export type GetSpecGenerationStatusResult = {
  isRunning: boolean
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  specRunId?: string
  runId?: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

/**
 * Triggers spec generation for an issue.
 * Creates a record in issue_spec_runs and returns the runId for SSE streaming.
 */
export async function triggerSpecGeneration(
  params: TriggerSpecGenerationParams
): Promise<TriggerSpecGenerationResult> {
  const { projectId, issueId, supabase } = params

  // Verify issue exists and belongs to this project
  const { data: issue, error: issueError } = await supabase
    .from('issues')
    .select('id, title, project_id')
    .eq('id', issueId)
    .eq('project_id', projectId)
    .single()

  if (issueError || !issue) {
    console.error('[spec-generation-service] Issue not found', issueId, issueError)
    return { success: false, error: 'Issue not found.', statusCode: 404 }
  }

  // Check if spec generation is already running for this issue
  const { data: runningSpec } = await supabase
    .from('issue_spec_runs')
    .select('*')
    .eq('issue_id', issueId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (runningSpec) {
    return {
      success: false,
      error: 'Spec generation is already in progress. Cancel it first to start a new one.',
      statusCode: 409,
      runId: runningSpec.run_id,
      specRunId: runningSpec.id,
    }
  }

  // Generate a unique run ID
  const runId = `spec-${issueId}-${Date.now()}`

  // Create spec run record
  const { data: specRunRecord, error: insertError } = await supabase
    .from('issue_spec_runs')
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

  if (insertError || !specRunRecord) {
    console.error('[spec-generation-service] Failed to create spec run record', insertError)
    return { success: false, error: 'Failed to start spec generation.', statusCode: 500 }
  }

  console.log('[spec-generation-service] Created spec run record:', specRunRecord.id)

  return {
    success: true,
    runId,
    specRunId: specRunRecord.id,
  }
}

/**
 * Get the current status of spec generation for an issue
 */
export async function getSpecGenerationStatus(
  params: Pick<TriggerSpecGenerationParams, 'issueId' | 'supabase'>
): Promise<GetSpecGenerationStatusResult> {
  const { issueId, supabase } = params

  // Get the latest spec run for this issue
  const { data: latestRun, error } = await supabase
    .from('issue_spec_runs')
    .select('*')
    .eq('issue_id', issueId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[spec-generation-service] Failed to get spec run status', error)
  }

  if (!latestRun) {
    return {
      isRunning: false,
      status: 'idle',
    }
  }

  return {
    isRunning: latestRun.status === 'running',
    status: latestRun.status as GetSpecGenerationStatusResult['status'],
    specRunId: latestRun.id,
    runId: latestRun.run_id,
    startedAt: latestRun.started_at,
    completedAt: latestRun.completed_at ?? undefined,
    errorMessage: latestRun.error_message ?? undefined,
  }
}

/**
 * Cancel a running spec generation
 */
export async function cancelSpecGeneration(
  params: Pick<TriggerSpecGenerationParams, 'issueId' | 'supabase'>
): Promise<{ success: boolean; error?: string }> {
  const { issueId, supabase } = params

  // Find running spec run
  const { data: runningSpec, error: findError } = await supabase
    .from('issue_spec_runs')
    .select('id')
    .eq('issue_id', issueId)
    .eq('status', 'running')
    .single()

  if (findError && findError.code !== 'PGRST116') {
    console.error('[spec-generation-service] Failed to find running spec run', findError)
    return { success: false, error: 'Failed to find running spec generation.' }
  }

  if (!runningSpec) {
    return { success: false, error: 'No running spec generation found.' }
  }

  // Mark as cancelled
  const { error: updateError } = await supabase
    .from('issue_spec_runs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', runningSpec.id)

  if (updateError) {
    console.error('[spec-generation-service] Failed to cancel spec run', updateError)
    return { success: false, error: 'Failed to cancel spec generation.' }
  }

  return { success: true }
}
