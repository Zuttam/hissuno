import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { triggerKnowledgeAnalysis } from '@/lib/knowledge/analysis-service'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/projects/[id]/knowledge/analyze
 * Trigger knowledge analysis workflow for a project
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge.analyze] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    const result = await triggerKnowledgeAnalysis({
      projectId,
      userId: identity.type === 'user' ? identity.userId : identity.createdByUserId,
      supabase,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.runId && { runId: result.runId }),
          ...(result.analysisId && { analysisId: result.analysisId }),
        },
        { status: result.statusCode }
      )
    }

    return NextResponse.json({
      message: 'Knowledge analysis started.',
      status: 'processing',
      runId: result.runId,
      analysisId: result.analysisId,
      sourceCount: result.sourceCount,
      hasCodebase: result.hasCodebase,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
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
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    // Fetch the latest analysis from project_analyses table
    const { data: latestAnalysis } = await supabase
      .from('project_analyses')
      .select('*')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    // Determine if analysis is running
    const isRunning = latestAnalysis?.status === 'running'

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

    // Determine overall status based on latest analysis and sources
    let overallStatus: 'idle' | 'processing' | 'completed' | 'failed' | 'partial' | 'cancelled'

    if (isRunning || processing.length > 0) {
      overallStatus = 'processing'
    } else if (latestAnalysis?.status === 'cancelled') {
      overallStatus = 'cancelled'
    } else if (latestAnalysis?.status === 'failed') {
      overallStatus = 'failed'
    } else if (failed.length > 0 && completed.length > 0) {
      overallStatus = 'partial'
    } else if (failed.length > 0) {
      overallStatus = 'failed'
    } else if (completed.length > 0 || latestAnalysis?.status === 'completed') {
      overallStatus = 'completed'
    } else {
      overallStatus = 'idle'
    }

    return NextResponse.json({
      status: overallStatus,
      isRunning,
      analysisId: latestAnalysis?.id ?? null,
      runId: latestAnalysis?.run_id ?? null,
      startedAt: latestAnalysis?.started_at ?? null,
      completedAt: latestAnalysis?.completed_at ?? null,
      lastAnalysisStatus: latestAnalysis?.status ?? null,
      lastAnalysisError: latestAnalysis?.error_message ?? null,
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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[knowledge.analyze.status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load status.' }, { status: 500 })
  }
}
