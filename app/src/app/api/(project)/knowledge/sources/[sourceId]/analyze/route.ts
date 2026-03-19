import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { triggerSourceAnalysis } from '@/lib/knowledge/analysis-service'
import { isDatabaseConfigured } from '@/lib/db/config'

export const runtime = 'nodejs'

type RouteParams = { sourceId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/knowledge/sources/[sourceId]/analyze
 * Trigger analysis for a single knowledge source
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const result = await triggerSourceAnalysis({
      projectId,
      sourceId,
      userId: identity.type === 'user' ? identity.userId : identity.createdByUserId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode })
    }

    return NextResponse.json({
      message: 'Source analysis started.',
      status: 'analyzing',
      runId: result.runId,
      analysisId: result.analysisId,
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

    console.error('[source-analyze.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to start analysis.' }, { status: 500 })
  }
}
