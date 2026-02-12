import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getProjectIssueStats, getTopRankedIssues } from '@/lib/supabase/issues'
import { getPendingPMReviews } from '@/lib/supabase/sessions'
import { getIssueVelocityData } from '@/lib/supabase/analytics'
import type { AnalyticsPeriod } from '@/lib/supabase/analytics'

export const runtime = 'nodejs'

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    const { id: projectId } = await params

    // Verify user owns the project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    const url = new URL(request.url)
    const period = (url.searchParams.get('period') || '30d') as AnalyticsPeriod

    const [pipeline, topIssues, pendingReviews, velocity] = await Promise.all([
      getProjectIssueStats(projectId),
      getTopRankedIssues(projectId, 5),
      getPendingPMReviews(projectId, 8),
      getIssueVelocityData(projectId, period),
    ])

    return NextResponse.json({
      pipeline,
      topIssues,
      pendingReviews,
      velocity,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[dashboard.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load dashboard data.' }, { status: 500 })
  }
}
