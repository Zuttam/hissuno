import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; packageId: string }

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
 * POST /api/projects/[id]/knowledge/packages/[packageId]/analyze/cancel
 * Cancel a running analysis for a specific package
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[package-analyze.cancel] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

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

    // Find running analysis for this package
    const { data: runningAnalysis, error: analysisError } = await supabase
      .from('project_analyses')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (analysisError && analysisError.code !== 'PGRST116') {
      console.error('[package-analyze.cancel] failed to load analysis', projectId, analysisError)
      return NextResponse.json({ error: 'Failed to load analysis.' }, { status: 500 })
    }

    if (!runningAnalysis) {
      return NextResponse.json({ error: 'No running analysis found.' }, { status: 404 })
    }

    // Check if this analysis is for the specified package
    const analysisPackageId = (runningAnalysis.metadata as Record<string, unknown>)?.namedPackageId
    if (analysisPackageId !== packageId) {
      return NextResponse.json({ error: 'No running analysis found for this package.' }, { status: 404 })
    }

    // Mark the analysis as cancelled
    const { error: updateError } = await supabase
      .from('project_analyses')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Analysis cancelled by user',
      })
      .eq('id', runningAnalysis.id)

    if (updateError) {
      console.error('[package-analyze.cancel] failed to update analysis', updateError)
      return NextResponse.json({ error: 'Failed to cancel analysis.' }, { status: 500 })
    }

    // Update source statuses
    const sourceIds = (runningAnalysis.metadata as Record<string, unknown>)?.sourceIds as string[] | undefined
    if (sourceIds && sourceIds.length > 0) {
      await supabase
        .from('knowledge_sources')
        .update({
          status: 'pending',
          error_message: 'Analysis cancelled',
        })
        .in('id', sourceIds)
        .eq('status', 'processing')
    }

    return NextResponse.json({
      message: `Analysis cancelled for package "${pkg.name}".`,
      status: 'cancelled',
      analysisId: runningAnalysis.id,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[package-analyze.cancel] unexpected error', error)
    return NextResponse.json({ error: 'Failed to cancel analysis.' }, { status: 500 })
  }
}
