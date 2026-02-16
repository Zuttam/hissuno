import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getIssueById } from '@/lib/supabase/issues'
import {
  triggerIssueAnalysis,
  getIssueAnalysisStatus,
} from '@/lib/issues/analysis-service'
import { enforceLimit, LimitExceededError } from '@/lib/billing/enforcement-service'
import { getProjectOwnerUserId } from '@/lib/auth/project-members'

export const runtime = 'nodejs'

type RouteParams = { id: string; issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/issues/[issueId]/analyze
 * Get the current status of analysis for an issue
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    const supabase = await createClient()
    const status = await getIssueAnalysisStatus({ issueId, supabase })

    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[analyze] GET error', error)
    return NextResponse.json({ error: 'Failed to get status.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/issues/[issueId]/analyze
 * Trigger analysis for an issue (non-blocking, use SSE stream for progress)
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    // Enforce analyzed issues limit against the project owner's subscription
    const enforcementUserId = await getProjectOwnerUserId(projectId)
    try {
      await enforceLimit({
        userId: enforcementUserId,
        dimension: 'analyzed_issues',
      })
    } catch (error) {
      if (error instanceof LimitExceededError) {
        return NextResponse.json(error.toResponse(), { status: 429 })
      }
      throw error
    }

    const supabase = await createClient()
    const result = await triggerIssueAnalysis({
      projectId,
      issueId,
      supabase,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, runId: result.runId, analysisRunId: result.analysisRunId },
        { status: result.statusCode }
      )
    }

    return NextResponse.json(
      {
        message: 'Analysis started.',
        status: 'processing',
        runId: result.runId,
        analysisRunId: result.analysisRunId,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[analyze] POST error', error)
    return NextResponse.json({ error: 'Failed to start analysis.' }, { status: 500 })
  }
}
