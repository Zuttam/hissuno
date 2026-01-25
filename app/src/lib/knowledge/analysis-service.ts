/**
 * Knowledge Analysis Service
 * Shared logic for triggering and managing knowledge analysis workflows
 *
 * Note: Codebase sync is now handled internally by the workflow via
 * prepare-codebase and cleanup-codebase steps. This service just validates
 * and triggers the workflow.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { mastra } from '@/mastra'
import type { Database } from '@/types/supabase'
import type { KnowledgeSourceRecord } from './types'

export type TriggerAnalysisParams = {
  projectId: string
  userId: string
  supabase: SupabaseClient<Database>
}

export type TriggerAnalysisResult = {
  success: true
  runId: string
  analysisId: string
  sourceCount: number
  hasCodebase: boolean
} | {
  success: false
  error: string
  /** HTTP status code suggestion */
  statusCode: number
  /** If analysis is already running */
  runId?: string
  analysisId?: string
}

/**
 * Triggers knowledge analysis for a project.
 * This function can be called from multiple places (API routes, other services).
 *
 * It will:
 * 1. Check if analysis is already running
 * 2. Fetch all knowledge sources
 * 3. Create an analysis record
 * 4. The SSE stream route will execute the actual workflow
 *
 * Note: Codebase sync is handled internally by the workflow via prepare-codebase
 * and cleanup-codebase steps. No cleanup needed from caller.
 */
export async function triggerKnowledgeAnalysis(
  params: TriggerAnalysisParams
): Promise<TriggerAnalysisResult> {
  const { projectId, userId, supabase } = params

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    console.error('[analysis-service] failed to load project', projectId, projectError)
    return { success: false, error: 'Project not found.', statusCode: 404 }
  }

  // Check if analysis is already running
  const { data: runningAnalysis } = await supabase
    .from('project_analyses')
    .select('*')
    .eq('project_id', projectId)
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
      analysisId: runningAnalysis.id,
    }
  }

  // Fetch all knowledge sources for the project (with source_code for codebase type)
  const { data: sources, error: sourcesError } = await supabase
    .from('knowledge_sources')
    .select('*, source_code:source_codes(*)')
    .eq('project_id', projectId)

  if (sourcesError) {
    console.error('[analysis-service] failed to load sources', projectId, sourcesError)
    return { success: false, error: 'Failed to load knowledge sources.', statusCode: 500 }
  }

  const allSources = (sources ?? []) as Array<KnowledgeSourceRecord & { source_code: { id: string; kind: string; repository_url: string | null; repository_branch: string | null } | null }>

  // Filter to only enabled sources
  const enabledSources = allSources.filter((s) => s.enabled !== false)

  // Find the codebase source (if any and enabled)
  const codebaseSource = enabledSources.find((s) => s.type === 'codebase')
  const sourceCode = codebaseSource?.source_code ?? null

  // Check if codebase source has GitHub source code configured
  const hasCodebase = Boolean(
    codebaseSource &&
    sourceCode?.kind === 'github' &&
    sourceCode?.repository_url &&
    sourceCode?.repository_branch
  )

  // Filter out codebase from other sources for the count
  const nonCodebaseSources = enabledSources.filter((s) => s.type !== 'codebase')
  const hasOtherSources = nonCodebaseSources.length > 0

  if (!hasCodebase && !hasOtherSources) {
    return {
      success: false,
      error: 'No enabled knowledge sources to analyze. Enable sources or add new ones first.',
      statusCode: 400,
    }
  }

  const branch = sourceCode?.repository_branch ?? null
  const analysisScope = codebaseSource?.analysis_scope ?? null

  // Update enabled sources to 'processing' status
  if (enabledSources.length > 0) {
    const sourceIds = enabledSources.map((s) => s.id)
    await supabase
      .from('knowledge_sources')
      .update({ status: 'processing', error_message: null })
      .in('id', sourceIds)
  }

  // Get the workflow
  const workflow = mastra.getWorkflow('knowledgeAnalysisWorkflow')

  if (!workflow) {
    console.error('[analysis-service] workflow not found')
    return { success: false, error: 'Analysis workflow not configured.', statusCode: 500 }
  }

  // Generate a unique run ID
  const runId = `knowledge-${projectId}-${Date.now()}`

  // Prepare workflow input - only include enabled sources
  // Note: Codebase is synced internally by prepare-codebase step
  const workflowInput = {
    projectId,
    analysisId: '', // Will be set after record creation
    analysisScope,
    sources: enabledSources.map((s) => ({
      id: s.id,
      type: s.type,
      url: s.url,
      storagePath: s.storage_path,
      content: s.content,
      analysisScope: s.analysis_scope,
      enabled: s.enabled,
    })),
  }

  // Create analysis record in project_analyses table
  const { data: analysisRecord, error: insertError } = await supabase
    .from('project_analyses')
    .insert({
      project_id: projectId,
      run_id: runId,
      status: 'running',
      started_at: new Date().toISOString(),
      metadata: {
        sourceCount: enabledSources.length,
        hasCodebase,
        sourceIds: enabledSources.map((s) => s.id),
        branch: branch,
        workflowInput: {
          ...workflowInput,
          analysisId: '', // Placeholder - will be updated below
        },
      },
    })
    .select()
    .single()

  if (insertError || !analysisRecord) {
    console.error('[analysis-service] Failed to create analysis record', insertError)
    return { success: false, error: 'Failed to start analysis.', statusCode: 500 }
  }

  // Update the workflow input with the actual analysisId
  const { error: updateError } = await supabase
    .from('project_analyses')
    .update({
      metadata: {
        ...(analysisRecord.metadata as Record<string, unknown>),
        workflowInput: {
          ...workflowInput,
          analysisId: analysisRecord.id,
        },
      },
    })
    .eq('id', analysisRecord.id)

  if (updateError) {
    console.error('[analysis-service] Failed to update analysis record with workflow input', updateError)
  }

  console.log('[analysis-service] Created analysis record:', analysisRecord.id)

  return {
    success: true,
    runId,
    analysisId: analysisRecord.id,
    sourceCount: enabledSources.length,
    hasCodebase,
  }
}
