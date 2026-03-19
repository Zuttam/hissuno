import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getIssueById } from '@/lib/db/queries/issues'
import { isDatabaseConfigured } from '@/lib/db/config'
import { cancelIssueAnalysis } from '@/lib/issues/analysis-service'

export const runtime = 'nodejs'

type RouteParams = { issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/issues/[issueId]/analyze/cancel?projectId=...
 * Cancel a running analysis
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[analyze.cancel] Database must be configured')
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

    const result = await cancelIssueAnalysis({ issueId })

    if (!result.success) {
      return NextResponse.json({
        message: result.error,
        cancelled: false,
      })
    }

    console.log('[analyze.cancel] Cancelled analysis for issue:', issueId)

    return NextResponse.json({
      message: 'Analysis cancelled successfully.',
      cancelled: true,
    })
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

    console.error('[analyze.cancel] unexpected error', error)
    return NextResponse.json({ error: 'Failed to cancel analysis.' }, { status: 500 })
  }
}
