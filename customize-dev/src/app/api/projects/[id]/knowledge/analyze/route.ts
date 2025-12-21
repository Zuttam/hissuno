import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { syncGitHubCodebase } from '@/lib/codebase'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { mastra } from '@/mastra'
import type { KnowledgeSourceRecord } from '@/lib/knowledge/types'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * POST /api/projects/[id]/knowledge/analyze
 * Trigger knowledge analysis workflow for a project
 * 
 * This will:
 * 1. Fetch all pending/failed knowledge sources
 * 2. Update their status to 'processing'
 * 3. Execute the knowledge analysis workflow
 * 4. Update statuses based on results
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge.analyze] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Fetch project with source code
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(*)')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      console.error('[knowledge.analyze] failed to load project', projectId, projectError)
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    // Fetch all knowledge sources for the project
    const { data: sources, error: sourcesError } = await supabase
      .from('knowledge_sources')
      .select('*')
      .eq('project_id', projectId)

    if (sourcesError) {
      console.error('[knowledge.analyze] failed to load sources', projectId, sourcesError)
      return NextResponse.json({ error: 'Failed to load knowledge sources.' }, { status: 500 })
    }

    const allSources = (sources ?? []) as KnowledgeSourceRecord[]

    // Check if there's anything to analyze
    // Consider both storage_uri (uploaded folders) and github kind
    const hasCodebase = Boolean(
      project.source_code?.storage_uri || 
      (project.source_code?.kind === 'github' && project.source_code?.repository_url && project.source_code?.repository_branch)
    )
    const hasOtherSources = allSources.length > 0

    if (!hasCodebase && !hasOtherSources) {
      return NextResponse.json({
        error: 'No knowledge sources to analyze. Add a codebase or other sources first.',
      }, { status: 400 })
    }

    // Auto-sync GitHub codebases before analysis
    let sourceCodePath = project.source_code?.storage_uri ?? null
    
    if (project.source_code?.kind === 'github') {
      console.log('[knowledge.analyze] Syncing GitHub codebase before analysis')
      
      const syncResult = await syncGitHubCodebase({
        codebaseId: project.source_code.id,
        userId: user.id,
        projectId,
      })

      if (syncResult.status === 'error') {
        console.error('[knowledge.analyze] GitHub sync failed:', syncResult.error)
        return NextResponse.json({
          error: `Failed to sync GitHub repository: ${syncResult.error}`,
        }, { status: 500 })
      }

      // Re-fetch project to get updated storage_uri after sync
      const { data: refreshedProject, error: refreshError } = await supabase
        .from('projects')
        .select('*, source_code:source_codes(*)')
        .eq('id', projectId)
        .single()

      if (refreshError || !refreshedProject) {
        console.error('[knowledge.analyze] Failed to refresh project after sync', refreshError)
      } else {
        sourceCodePath = refreshedProject.source_code?.storage_uri ?? null
      }

      console.log('[knowledge.analyze] GitHub sync completed:', syncResult.status, 'SHA:', syncResult.commitSha)
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
      console.error('[knowledge.analyze] workflow not found')
      return NextResponse.json({ error: 'Analysis workflow not configured.' }, { status: 500 })
    }

    // Prepare workflow input
    const workflowInput = {
      projectId,
      sourceCodePath,
      sources: allSources.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        storagePath: s.storage_path,
        content: s.content,
      })),
    }

    // Execute workflow asynchronously
    // We don't await the full execution - just return immediately
    // The workflow will update statuses as it progresses
    const run = await workflow.createRunAsync({
      runId: `knowledge-${projectId}-${Date.now()}`,
    })

    // Start the workflow in the background
    run.start({ inputData: workflowInput }).catch((error: Error) => {
      console.error('[knowledge.analyze] workflow execution failed', error)
    })

    return NextResponse.json({
      message: 'Knowledge analysis started.',
      status: 'processing',
      sourceCount: allSources.length,
      hasCodebase,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge.analyze] unexpected error', error)
    return NextResponse.json({ error: 'Failed to start analysis.' }, { status: 500 })
  }
}

/**
 * GET /api/projects/[id]/knowledge/analyze
 * Get the current analysis status for a project
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge.analyze.status] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Fetch all knowledge sources to determine status
    const { data: sources, error } = await supabase
      .from('knowledge_sources')
      .select('id, type, status, error_message, analyzed_at')
      .eq('project_id', projectId)

    if (error) {
      console.error('[knowledge.analyze.status] failed to load sources', projectId, error)
      return NextResponse.json({ error: 'Failed to load status.' }, { status: 500 })
    }

    const allSources = sources ?? []
    const processing = allSources.filter((s) => s.status === 'processing')
    const failed = allSources.filter((s) => s.status === 'failed')
    const completed = allSources.filter((s) => s.status === 'completed')
    const pending = allSources.filter((s) => s.status === 'pending')

    let overallStatus: 'idle' | 'processing' | 'completed' | 'failed' | 'partial'
    if (processing.length > 0) {
      overallStatus = 'processing'
    } else if (failed.length > 0 && completed.length > 0) {
      overallStatus = 'partial'
    } else if (failed.length > 0) {
      overallStatus = 'failed'
    } else if (completed.length > 0) {
      overallStatus = 'completed'
    } else {
      overallStatus = 'idle'
    }

    return NextResponse.json({
      status: overallStatus,
      sources: {
        total: allSources.length,
        pending: pending.length,
        processing: processing.length,
        completed: completed.length,
        failed: failed.length,
      },
      failedSources: failed.map((s) => ({
        id: s.id,
        type: s.type,
        error: s.error_message,
      })),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge.analyze.status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load status.' }, { status: 500 })
  }
}
