import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { triggerKnowledgeAnalysis } from '@/lib/knowledge/analysis-service'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; packageId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/projects/[id]/knowledge/packages/[packageId]/analyze
 * Trigger knowledge analysis for a specific package
 * Analyzes only the sources linked to this package
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[package-analyze.post] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    // Verify package exists and belongs to project
    const { data: pkg, error: pkgError } = await supabase
      .from('named_knowledge_packages')
      .select('id, name')
      .eq('id', packageId)
      .eq('project_id', projectId)
      .single()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Get the linked sources for this package
    const { data: linkedSources } = await supabase
      .from('named_package_sources')
      .select('source_id')
      .eq('package_id', packageId)

    const sourceIds = linkedSources?.map((s) => s.source_id) ?? []

    if (sourceIds.length === 0) {
      return NextResponse.json({
        error: 'No sources linked to this package. Add sources before analyzing.',
      }, { status: 400 })
    }

    // Trigger analysis with the named package ID and its specific sources
    const result = await triggerKnowledgeAnalysis({
      projectId,
      userId: identity.type === 'user' ? identity.userId : identity.createdByUserId,
      supabase,
      namedPackageId: packageId,
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
      message: `Knowledge analysis started for package "${pkg.name}".`,
      status: 'processing',
      runId: result.runId,
      analysisId: result.analysisId,
      sourceCount: result.sourceCount,
      hasCodebase: result.hasCodebase,
      packageId,
      packageName: pkg.name,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[package-analyze.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to start analysis.' }, { status: 500 })
  }
}

/**
 * GET /api/projects/[id]/knowledge/packages/[packageId]/analyze
 * Get the current analysis status for a package
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[package-analyze.status] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    // Verify package exists
    const { data: pkg, error: pkgError } = await supabase
      .from('named_knowledge_packages')
      .select('id, name')
      .eq('id', packageId)
      .eq('project_id', projectId)
      .single()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Get the knowledge_packages for this named package to check analysis status
    const { data: categories } = await supabase
      .from('knowledge_packages')
      .select('category, version, generated_at')
      .eq('named_package_id', packageId)

    // Check for running analysis that includes this package
    const { data: runningAnalysis } = await supabase
      .from('project_analyses')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    // Check if running analysis is for this package
    const isRunning = runningAnalysis?.metadata &&
      typeof runningAnalysis.metadata === 'object' &&
      (runningAnalysis.metadata as Record<string, unknown>).namedPackageId === packageId

    // Find most recent analysis timestamp
    const lastAnalyzedAt = categories?.length
      ? categories.reduce((latest, cat) => {
          if (!latest) return cat.generated_at
          return new Date(cat.generated_at) > new Date(latest) ? cat.generated_at : latest
        }, null as string | null)
      : null

    // Determine status
    let status: 'idle' | 'processing' | 'completed'
    if (isRunning) {
      status = 'processing'
    } else if (categories && categories.length > 0) {
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
      categories: categories?.map((c) => ({
        category: c.category,
        version: c.version,
        generatedAt: c.generated_at,
      })) ?? [],
      runningAnalysis: isRunning ? {
        analysisId: runningAnalysis.id,
        runId: runningAnalysis.run_id,
        startedAt: runningAnalysis.started_at,
      } : null,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[package-analyze.status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load status.' }, { status: 500 })
  }
}
