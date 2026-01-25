import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

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
 * POST /api/projects/[id]/knowledge/analyze/cancel
 * Cancel/abort a running or stuck analysis
 *
 * This will:
 * 1. Find the latest running analysis for the project
 * 2. Mark it as 'cancelled'
 * 3. Reset any 'processing' knowledge sources back to 'pending'
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge.analyze.cancel] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Find the latest running analysis
    const { data: runningAnalysis, error: fetchError } = await supabase
      .from('project_analyses')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      console.error('[knowledge.analyze.cancel] Failed to fetch running analysis', fetchError)
      return NextResponse.json({ error: 'Failed to check analysis status.' }, { status: 500 })
    }

    if (!runningAnalysis) {
      return NextResponse.json({
        message: 'No running analysis found.',
        cancelled: false,
      })
    }

    // Mark the analysis as cancelled
    const { error: updateError } = await supabase
      .from('project_analyses')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Analysis was cancelled by user',
      })
      .eq('id', runningAnalysis.id)

    if (updateError) {
      console.error('[knowledge.analyze.cancel] Failed to update analysis', updateError)
      return NextResponse.json({ error: 'Failed to cancel analysis.' }, { status: 500 })
    }

    // Reset any 'processing' knowledge sources back to 'pending'
    const { error: sourcesError } = await supabase
      .from('knowledge_sources')
      .update({ status: 'pending', error_message: null })
      .eq('project_id', projectId)
      .eq('status', 'processing')

    if (sourcesError) {
      console.error('[knowledge.analyze.cancel] Failed to reset sources', sourcesError)
      // Not a critical error, continue
    }

    console.log('[knowledge.analyze.cancel] Cancelled analysis:', runningAnalysis.id)

    return NextResponse.json({
      message: 'Analysis cancelled successfully.',
      cancelled: true,
      analysisId: runningAnalysis.id,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge.analyze.cancel] unexpected error', error)
    return NextResponse.json({ error: 'Failed to cancel analysis.' }, { status: 500 })
  }
}
