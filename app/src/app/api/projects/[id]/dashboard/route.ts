import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { getProjectIssueStats, getTopRankedIssues } from '@/lib/supabase/issues'
import { getPendingPMReviews } from '@/lib/supabase/sessions'
import { getIssueVelocityData } from '@/lib/supabase/analytics'
import type { AnalyticsPeriod } from '@/lib/supabase/analytics'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    const { id: projectId } = await params
    await assertProjectAccess(identity, projectId)

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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[dashboard.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load dashboard data.' }, { status: 500 })
  }
}
