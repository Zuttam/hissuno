import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgePackages, compilationRuns, knowledgeSources } from '@/lib/db/schema/app'

export const runtime = 'nodejs'

type RouteParams = { packageId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/knowledge/packages/[packageId]/analyze/cancel
 * Cancel a running analysis for a specific package
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[package-compile.cancel] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify package exists
    const [pkg] = await db
      .select({ id: knowledgePackages.id, name: knowledgePackages.name })
      .from(knowledgePackages)
      .where(
        and(
          eq(knowledgePackages.id, packageId),
          eq(knowledgePackages.project_id, projectId)
        )
      )
      .limit(1)

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Find running analysis for this package
    const [runningAnalysis] = await db
      .select()
      .from(compilationRuns)
      .where(
        and(
          eq(compilationRuns.project_id, projectId),
          eq(compilationRuns.status, 'running')
        )
      )
      .orderBy(desc(compilationRuns.started_at))
      .limit(1)

    if (!runningAnalysis) {
      return NextResponse.json({ error: 'No running analysis found.' }, { status: 404 })
    }

    // Check if this analysis is for the specified package
    const analysisPackageId = (runningAnalysis.metadata as Record<string, unknown>)?.packageId
    if (analysisPackageId !== packageId) {
      return NextResponse.json({ error: 'No running analysis found for this package.' }, { status: 404 })
    }

    // Mark the analysis as cancelled
    await db
      .update(compilationRuns)
      .set({
        status: 'cancelled',
        completed_at: new Date(),
        error_message: 'Analysis cancelled by user',
      })
      .where(eq(compilationRuns.id, runningAnalysis.id))

    // Update source statuses
    const sourceIds = (runningAnalysis.metadata as Record<string, unknown>)?.sourceIds as string[] | undefined
    if (sourceIds && sourceIds.length > 0) {
      await db
        .update(knowledgeSources)
        .set({
          status: 'pending',
          error_message: 'Analysis cancelled',
        })
        .where(
          and(
            inArray(knowledgeSources.id, sourceIds),
            eq(knowledgeSources.status, 'analyzing')
          )
        )
    }

    return NextResponse.json({
      message: `Analysis cancelled for package "${pkg.name}".`,
      status: 'cancelled',
      analysisId: runningAnalysis.id,
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

    console.error('[package-compile.cancel] unexpected error', error)
    return NextResponse.json({ error: 'Failed to cancel analysis.' }, { status: 500 })
  }
}
