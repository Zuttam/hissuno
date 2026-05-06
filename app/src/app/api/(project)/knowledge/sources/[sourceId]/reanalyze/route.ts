import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/db/schema/app'
import { fireSourceAnalysis } from '@/lib/utils/source-processing'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ sourceId: string }> }

/**
 * POST /api/knowledge/sources/[sourceId]/reanalyze?projectId=...
 * Re-runs analyzeSource in the background. Returns 202 immediately; clients
 * observe progress by polling the knowledge_sources.status column.
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

    const [source] = await db
      .select({ id: knowledgeSources.id, status: knowledgeSources.status })
      .from(knowledgeSources)
      .where(and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId),
      ))
      .limit(1)

    if (!source) {
      return NextResponse.json({ error: 'Source not found.' }, { status: 404 })
    }
    if (source.status === 'analyzing') {
      return NextResponse.json({ error: 'Source is already being analyzed.' }, { status: 409 })
    }

    fireSourceAnalysis(sourceId, projectId)

    return NextResponse.json({ sourceId, status: 'analyzing' }, { status: 202 })
  } catch (error) {
    if (error instanceof MissingProjectIdError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    console.error('[source.reanalyze] unexpected error', error)
    return NextResponse.json({ error: 'Failed to start analysis.' }, { status: 500 })
  }
}
