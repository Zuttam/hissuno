import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import {
  getOverallAnalytics,
  getSessionsStripAnalytics,
  getIssuesStripAnalytics,
  getImpactFlowAnalytics,
  type AnalyticsPeriod,
} from '@/lib/supabase/analytics'

export const runtime = 'nodejs'

/**
 * GET /api/analytics
 * Returns analytics data with optional period and project filters.
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 * - projectId: optional project ID to filter to
 * - type: 'overall' | 'sessions-strip' | 'issues-strip' (default: 'overall')
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[analytics.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)

    const periodParam = searchParams.get('period') || '30d'
    const period: AnalyticsPeriod = ['7d', '30d', '90d', 'all'].includes(periodParam)
      ? (periodParam as AnalyticsPeriod)
      : '30d'

    const projectId = searchParams.get('projectId') || undefined
    const type = searchParams.get('type') || 'overall'

    if (type === 'sessions-strip') {
      const data = await getSessionsStripAnalytics(period, projectId)
      return NextResponse.json({ data })
    }

    if (type === 'issues-strip') {
      const data = await getIssuesStripAnalytics(period, projectId)
      return NextResponse.json({ data })
    }

    if (type === 'impact-flow') {
      const data = await getImpactFlowAnalytics(period, projectId)
      return NextResponse.json({ data })
    }

    // Default: overall analytics
    const data = await getOverallAnalytics(period, projectId)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[analytics.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load analytics.' }, { status: 500 })
  }
}
