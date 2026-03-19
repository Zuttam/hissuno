import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity, requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  getOverallAnalytics,
  getSessionsStripAnalytics,
  getIssuesStripAnalytics,
  getProjectAnalytics,
  getCustomerSegmentationAnalytics,
  getEntityGraphAnalytics,
  getEdgeEntities,
  getCategorySubgroups,
  getCategoryEntities,
  getChildEntityEdges,
  type AnalyticsPeriod,
  type EntityGraphCategory,
} from '@/lib/db/queries/analytics'

export const runtime = 'nodejs'

/**
 * GET /api/analytics
 * Returns analytics data with optional period and project filters.
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 * - projectId: optional project ID to filter to (required for type=project)
 * - type: 'overall' | 'sessions-strip' | 'issues-strip' | 'project' (default: 'overall')
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[analytics.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)

    const periodParam = searchParams.get('period') || '30d'
    const period: AnalyticsPeriod = ['7d', '30d', '90d', 'all'].includes(periodParam)
      ? (periodParam as AnalyticsPeriod)
      : '30d'

    const projectId = searchParams.get('projectId') || undefined
    const type = searchParams.get('type') || 'overall'

    if (projectId) {
      const identity = await requireRequestIdentity()
      await assertProjectAccess(identity, projectId)
    } else {
      await requireUserIdentity()
    }

    if (type === 'sessions-strip') {
      const data = await getSessionsStripAnalytics(period, projectId)
      return NextResponse.json({ data })
    }

    if (type === 'issues-strip') {
      const data = await getIssuesStripAnalytics(period, projectId)
      return NextResponse.json({ data })
    }

    if (type === 'customer-segmentation') {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required for type=customer-segmentation.' }, { status: 400 })
      }
      const data = await getCustomerSegmentationAnalytics(projectId, period)
      return NextResponse.json({ data })
    }

    if (type === 'entity-graph') {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required for type=entity-graph.' }, { status: 400 })
      }
      const data = await getEntityGraphAnalytics(projectId)
      return NextResponse.json({ data })
    }

    if (type === 'entity-graph-edge-entities') {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
      }
      const sourceCategory = searchParams.get('sourceCategory') as EntityGraphCategory | null
      const targetCategory = searchParams.get('targetCategory') as EntityGraphCategory | null
      if (!sourceCategory || !targetCategory) {
        return NextResponse.json({ error: 'sourceCategory and targetCategory are required.' }, { status: 400 })
      }
      const limit = parseInt(searchParams.get('limit') || '10', 10)
      const data = await getEdgeEntities(projectId, sourceCategory, targetCategory, limit)
      return NextResponse.json({ data })
    }

    if (type === 'entity-graph-drilldown') {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
      }
      const category = searchParams.get('category') as EntityGraphCategory | null
      const level = searchParams.get('level') as 'groups' | 'entities' | null
      if (!category || !level) {
        return NextResponse.json({ error: 'category and level are required.' }, { status: 400 })
      }
      const groupBy = searchParams.get('groupBy') || undefined
      const groupValue = searchParams.get('groupValue') || undefined
      const limit = parseInt(searchParams.get('limit') || '20', 10)

      if (level === 'groups') {
        const groups = await getCategorySubgroups(projectId, category)
        return NextResponse.json({ data: { groups } })
      } else {
        const entities = await getCategoryEntities(projectId, category, groupBy, groupValue, limit)
        return NextResponse.json({ data: { entities } })
      }
    }

    if (type === 'entity-graph-child-edges') {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
      }
      const category = searchParams.get('category') as EntityGraphCategory | null
      const childIdsParam = searchParams.get('childIds')
      if (!category || !childIdsParam) {
        return NextResponse.json({ error: 'category and childIds are required.' }, { status: 400 })
      }
      const childIds = childIdsParam.split(',').filter(Boolean)
      const data = await getChildEntityEdges(projectId, category, childIds)
      return NextResponse.json({ data })
    }

    if (type === 'project') {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required for type=project.' }, { status: 400 })
      }
      const data = await getProjectAnalytics(projectId, period)
      return NextResponse.json({ data })
    }

    // Default: overall analytics
    const data = await getOverallAnalytics(period, projectId)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[analytics.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load analytics.' }, { status: 500 })
  }
}
