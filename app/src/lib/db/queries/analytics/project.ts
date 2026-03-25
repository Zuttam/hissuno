import { db } from '@/lib/db'
import { and, eq, gte, lte, isNotNull, sql } from 'drizzle-orm'
import { sessions, issues, knowledgeSources, entityRelationships } from '@/lib/db/schema/app'
import type { AnalyticsPeriod, ProjectAnalytics, TimeSeriesPoint } from './types'
import {
  buildDistribution,
  buildTagDistribution,
  buildTimeSeries,
  calculateChange,
  getComparisonPeriod,
  getPeriodStartDate,
} from './utils'

/**
 * Get project-specific analytics
 */
export async function getProjectAnalytics(
  projectId: string,
  period: AnalyticsPeriod
): Promise<ProjectAnalytics> {
  const periodStart = getPeriodStartDate(period)
  const comparisonPeriod = getComparisonPeriod(period)

  // Build base conditions
  const sessionsBaseConditions = [
    eq(sessions.project_id, projectId),
    eq(sessions.is_archived, false),
  ]
  const issuesBaseConditions = [
    eq(issues.project_id, projectId),
    eq(issues.is_archived, false),
  ]

  if (periodStart) {
    sessionsBaseConditions.push(gte(sessions.created_at, periodStart))
    issuesBaseConditions.push(gte(issues.created_at, periodStart))
  }

  const [sessionRows, issueRows] = await Promise.all([
    db.select({
      id: sessions.id,
      created_at: sessions.created_at,
      source: sessions.source,
      tags: sessions.tags,
      status: sessions.status,
    })
      .from(sessions)
      .where(and(...sessionsBaseConditions)),
    db.select({
      id: issues.id,
      created_at: issues.created_at,
      type: issues.type,
      status: issues.status,
      priority: issues.priority,
    })
      .from(issues)
      .where(and(...issuesBaseConditions)),
  ])

  // Query new metrics: knowledge added & affected products
  const knowledgeConditions = [eq(knowledgeSources.project_id, projectId)]
  if (periodStart) knowledgeConditions.push(gte(knowledgeSources.created_at, periodStart))

  const affectedProductsConditions = [
    eq(entityRelationships.project_id, projectId),
    isNotNull(entityRelationships.product_scope_id),
    isNotNull(entityRelationships.issue_id),
  ]
  if (periodStart) affectedProductsConditions.push(gte(entityRelationships.created_at, periodStart))

  const [knowledgeRows, affectedProductsRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(knowledgeSources)
      .where(and(...knowledgeConditions)),
    db.select({ count: sql<number>`count(distinct ${entityRelationships.product_scope_id})::int` })
      .from(entityRelationships)
      .where(and(...affectedProductsConditions)),
  ])

  const knowledgeAdded = knowledgeRows[0]?.count ?? 0
  const affectedProducts = affectedProductsRows[0]?.count ?? 0

  // Get comparison data
  let prevSessionCount = 0
  let prevActiveIssueCount = 0
  let prevKnowledgeAdded = 0
  let prevAffectedProducts = 0

  if (comparisonPeriod) {
    const [prevSessionRows, prevIssueRows, prevKnowledgeRows, prevAffectedProductsRows] = await Promise.all([
      db.select({ id: sessions.id })
        .from(sessions)
        .where(and(
          eq(sessions.project_id, projectId),
          eq(sessions.is_archived, false),
          gte(sessions.created_at, comparisonPeriod.start),
          lte(sessions.created_at, comparisonPeriod.end),
        )),
      db.select({ id: issues.id, status: issues.status })
        .from(issues)
        .where(and(
          eq(issues.project_id, projectId),
          eq(issues.is_archived, false),
          gte(issues.created_at, comparisonPeriod.start),
          lte(issues.created_at, comparisonPeriod.end),
        )),
      db.select({ count: sql<number>`count(*)::int` })
        .from(knowledgeSources)
        .where(and(
          eq(knowledgeSources.project_id, projectId),
          gte(knowledgeSources.created_at, comparisonPeriod.start),
          lte(knowledgeSources.created_at, comparisonPeriod.end),
        )),
      db.select({ count: sql<number>`count(distinct ${entityRelationships.product_scope_id})::int` })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.project_id, projectId),
          isNotNull(entityRelationships.product_scope_id),
          isNotNull(entityRelationships.issue_id),
          gte(entityRelationships.created_at, comparisonPeriod.start),
          lte(entityRelationships.created_at, comparisonPeriod.end),
        )),
    ])
    prevSessionCount = prevSessionRows.length
    prevActiveIssueCount = prevIssueRows.filter(i => i.status === 'open' || i.status === 'in_progress').length
    prevKnowledgeAdded = prevKnowledgeRows[0]?.count ?? 0
    prevAffectedProducts = prevAffectedProductsRows[0]?.count ?? 0
  }

  // Calculate stats
  const activeIssues = issueRows.filter(i => i.status === 'open' || i.status === 'in_progress').length

  // Find top tag
  const tagCounts = new Map<string, number>()
  sessionRows.forEach(s => {
    (s.tags ?? []).forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    })
  })
  const topTag = tagCounts.size > 0
    ? Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // Build time series and distributions
  const sessionTimeSeries = buildTimeSeries(sessionRows, period)
  const sessionsByTag = buildTagDistribution(sessionRows)
  const sessionsBySource = buildDistribution(sessionRows, 'source')
  const issuesByType = buildDistribution(issueRows, 'type')
  const issuesByPriority = buildDistribution(issueRows, 'priority')

  return {
    sessions: {
      total: sessionRows.length,
      change: calculateChange(sessionRows.length, prevSessionCount),
    },
    activeIssues: {
      total: activeIssues,
      change: calculateChange(activeIssues, prevActiveIssueCount),
    },
    knowledgeAdded: {
      value: knowledgeAdded,
      change: calculateChange(knowledgeAdded, prevKnowledgeAdded),
    },
    affectedProducts: {
      value: affectedProducts,
      change: calculateChange(affectedProducts, prevAffectedProducts),
    },
    topTag,
    timeSeries: {
      sessions: sessionTimeSeries,
    },
    distributions: {
      sessionsByTag,
      sessionsBySource,
      issuesByType,
      issuesByPriority,
    },
  }
}

/**
 * Get issue velocity data for the dashboard (created vs resolved per day + cumulative open)
 */
export async function getIssueVelocityData(
  projectId: string,
  period: AnalyticsPeriod
): Promise<{ created: TimeSeriesPoint[]; resolved: TimeSeriesPoint[]; cumulativeOpen: number }> {
  const periodStart = getPeriodStartDate(period)

  const conditions = [
    eq(issues.project_id, projectId),
    eq(issues.is_archived, false),
  ]

  if (periodStart) {
    conditions.push(gte(issues.created_at, periodStart))
  }

  const issueRows = await db
    .select({
      id: issues.id,
      created_at: issues.created_at,
      updated_at: issues.updated_at,
      status: issues.status,
    })
    .from(issues)
    .where(and(...conditions))

  // Build created time series
  const created = buildTimeSeries(issueRows, period)

  // Build resolved time series using updated_at as proxy for resolution date
  const resolvedIssues = issueRows
    .filter((i) => i.status === 'resolved' || i.status === 'closed')
    .map((i) => ({ ...i, created_at: i.updated_at }))
  const resolved = buildTimeSeries(resolvedIssues, period)

  // Cumulative open: count issues that are not resolved/closed
  const cumulativeOpen = issueRows.filter(
    (i) => i.status !== 'resolved' && i.status !== 'closed'
  ).length

  return { created, resolved, cumulativeOpen }
}
