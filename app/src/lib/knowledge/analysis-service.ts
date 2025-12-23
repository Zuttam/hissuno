/**
 * Knowledge Analysis Service
 * Shared logic for triggering and managing knowledge analysis workflows
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncGitHubCodebase } from '@/lib/codebase'
import { mastra } from '@/mastra'
import type { Database } from '@/types/supabase'
import type { KnowledgeSourceRecord } from './types'

export type TriggerAnalysisParams = {
  projectId: string
  userId: string
  supabase: SupabaseClient<Database>
  /** If true, skip GitHub sync (useful when sync was already done during project creation) */
  skipGitHubSync?: boolean
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
 * 3. Optionally sync GitHub codebase
 * 4. Create an analysis record
 * 5. The SSE stream route will execute the actual workflow
 */
export async function triggerKnowledgeAnalysis(
  params: TriggerAnalysisParams
): Promise<TriggerAnalysisResult> {
  const { projectId, userId, supabase, skipGitHubSync = false } = params

  // Fetch project with source code
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*, source_code:source_codes(*)')
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

  // Fetch all knowledge sources for the project
  const { data: sources, error: sourcesError } = await supabase
    .from('knowledge_sources')
    .select('*')
    .eq('project_id', projectId)

  if (sourcesError) {
    console.error('[analysis-service] failed to load sources', projectId, sourcesError)
    return { success: false, error: 'Failed to load knowledge sources.', statusCode: 500 }
  }

  const allSources = (sources ?? []) as KnowledgeSourceRecord[]

  // Check if there's anything to analyze
  const hasCodebase = Boolean(
    project.source_code?.storage_uri || 
    (project.source_code?.kind === 'github' && project.source_code?.repository_url && project.source_code?.repository_branch)
  )
  const hasOtherSources = allSources.length > 0

  if (!hasCodebase && !hasOtherSources) {
    return {
      success: false,
      error: 'No knowledge sources to analyze. Add a codebase or other sources first.',
      statusCode: 400,
    }
  }

  // Auto-sync GitHub codebases before analysis (unless already synced)
  let sourceCodePath = project.source_code?.storage_uri ?? null
  
  if (!skipGitHubSync && project.source_code?.kind === 'github') {
    console.log('[analysis-service] Syncing GitHub codebase before analysis')
    
    const syncResult = await syncGitHubCodebase({
      codebaseId: project.source_code.id,
      userId,
      projectId,
    })

    if (syncResult.status === 'error') {
      console.error('[analysis-service] GitHub sync failed:', syncResult.error)
      return {
        success: false,
        error: `Failed to sync GitHub repository: ${syncResult.error}`,
        statusCode: 500,
      }
    }

    // Re-fetch project to get updated storage_uri after sync
    const { data: refreshedProject, error: refreshError } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(*)')
      .eq('id', projectId)
      .single()

    if (refreshError || !refreshedProject) {
      console.error('[analysis-service] Failed to refresh project after sync', refreshError)
    } else {
      sourceCodePath = refreshedProject.source_code?.storage_uri ?? null
    }

    console.log('[analysis-service] GitHub sync completed:', syncResult.status, 'SHA:', syncResult.commitSha)
  }

  // Update sources to 'processing' status
  if (allSources.length > 0) {
    const sourceIds = allSources.map((s) => s.id)
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

  // Prepare workflow input
  const workflowInput = {
    projectId,
    analysisId: '', // Will be set after record creation
    sourceCodePath,
    analysisScope: project.source_code?.analysis_scope ?? null,
    sources: allSources.map((s) => ({
      id: s.id,
      type: s.type,
      url: s.url,
      storagePath: s.storage_path,
      content: s.content,
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
        sourceCount: allSources.length,
        hasCodebase,
        sourceIds: allSources.map((s) => s.id),
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
    sourceCount: allSources.length,
    hasCodebase,
  }
}
