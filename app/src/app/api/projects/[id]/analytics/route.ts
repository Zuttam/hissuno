import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { getProjectAnalytics, type AnalyticsPeriod } from '@/lib/supabase/analytics'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/analytics
 * Returns project-specific analytics data.
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[project-analytics.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)

    const periodParam = searchParams.get('period') || '30d'
    const period: AnalyticsPeriod = ['7d', '30d', '90d', 'all'].includes(periodParam)
      ? (periodParam as AnalyticsPeriod)
      : '30d'

    const data = await getProjectAnalytics(projectId, period)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[project-analytics.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load project analytics.' }, { status: 500 })
  }
}
