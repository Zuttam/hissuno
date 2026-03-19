import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getIssueById } from '@/lib/db/queries/issues'
import {
  triggerIssueAnalysis,
  getIssueAnalysisStatus,
} from '@/lib/issues/analysis-service'

export const runtime = 'nodejs'

type RouteParams = { issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/issues/[issueId]/analyze?projectId=...
 * Get the current status of analysis for an issue
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    const status = await getIssueAnalysisStatus({ issueId })

    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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
 * POST /api/issues/[issueId]/analyze?projectId=...
 * Trigger analysis for an issue (non-blocking, use SSE stream for progress)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    const result = await triggerIssueAnalysis({
      projectId,
      issueId,
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
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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
