import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { triggerPackageCompilation } from '@/lib/knowledge/analysis-service'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgePackages, knowledgePackageSources, knowledgeSources, compilationRuns } from '@/lib/db/schema/app'

export const runtime = 'nodejs'

type RouteParams = { packageId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/settings/agents/support-agent/packages/[packageId]/analyze
 * Trigger knowledge analysis for a specific package
 * Analyzes only the sources linked to this package
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[package-compile.post] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify package exists and belongs to project
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

    // Get the linked sources for this package
    const linkedSources = await db
      .select({ source_id: knowledgePackageSources.source_id })
      .from(knowledgePackageSources)
      .where(eq(knowledgePackageSources.package_id, packageId))

    const sourceIds = linkedSources.map((s) => s.source_id)

    if (sourceIds.length === 0) {
      return NextResponse.json({
        error: 'No sources linked to this package. Add sources before compiling.',
      }, { status: 400 })
    }

    // Trigger analysis with the named package ID and its specific sources
    const result = await triggerPackageCompilation({
      projectId,
      userId: identity.type === 'user' ? identity.userId : identity.createdByUserId,
      packageId: packageId,
      sourceIds, // Only analyze these specific sources
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
      message: `Compilation started for package "${pkg.name}".`,
      status: 'processing',
      runId: result.runId,
      analysisId: result.analysisId,
      sourceCount: result.sourceCount,
      hasCodebase: result.hasCodebase,
      packageId,
      packageName: pkg.name,
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

    console.error('[package-compile.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to start compilation.' }, { status: 500 })
  }
}

/**
 * GET /api/settings/agents/support-agent/packages/[packageId]/analyze
 * Get the current analysis status for a package
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[package-compile.status] Database must be configured')
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

    // Get linked sources to check analysis status
    const linkedSources = await db
      .select({ source_id: knowledgePackageSources.source_id })
      .from(knowledgePackageSources)
      .where(eq(knowledgePackageSources.package_id, packageId))

    const sourceIds = linkedSources.map((s) => s.source_id)

    let sources: { id: string; status: string; analyzed_at: Date | null }[] = []
    if (sourceIds.length > 0) {
      sources = await db
        .select({
          id: knowledgeSources.id,
          status: knowledgeSources.status,
          analyzed_at: knowledgeSources.analyzed_at,
        })
        .from(knowledgeSources)
        .where(inArray(knowledgeSources.id, sourceIds))
    }

    // Check for running analysis that includes this package
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

    // Check if running analysis is for this package
    const isRunning = runningAnalysis?.metadata &&
      typeof runningAnalysis.metadata === 'object' &&
      (runningAnalysis.metadata as Record<string, unknown>).packageId === packageId

    // Find most recent analysis timestamp from sources
    const lastAnalyzedAt = sources.length > 0
      ? sources.reduce((latest: string | null, s) => {
          if (!s.analyzed_at) return latest
          const analyzedStr = s.analyzed_at.toISOString()
          if (!latest) return analyzedStr
          return new Date(analyzedStr) > new Date(latest) ? analyzedStr : latest
        }, null as string | null)
      : null

    // Determine status
    const hasAnalyzedSources = sources.some((s) => s.status === 'done')
    let status: 'idle' | 'processing' | 'completed'
    if (isRunning) {
      status = 'processing'
    } else if (hasAnalyzedSources) {
      status = 'completed'
    } else {
      status = 'idle'
    }

    return NextResponse.json({
      status,
      isRunning: Boolean(isRunning),
      packageId,
      packageName: pkg.name,
      lastAnalyzedAt,
      runningAnalysis: isRunning ? {
        analysisId: runningAnalysis.id,
        runId: runningAnalysis.run_id,
        startedAt: runningAnalysis.started_at?.toISOString() ?? null,
      } : null,
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

    console.error('[package-compile.status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load status.' }, { status: 500 })
  }
}
