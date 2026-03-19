import { cache } from 'react'
import { db } from '@/lib/db'
import { and, eq, gte, lte, inArray, isNotNull } from 'drizzle-orm'
import { sessions, issues, entityRelationships } from '@/lib/db/schema/app'
import { requireRequestIdentity } from '@/lib/auth/identity'
import type { AnalyticsPeriod, OverallAnalytics } from './types'
import {
  buildDistribution,
  buildTagDistribution,
  buildTimeSeries,
  calculateChange,
  getComparisonPeriod,
  getPeriodStartDate,
  getUserProjects,
} from './utils'

/**
 * Get overall analytics across all projects or filtered by project
 */
export const getOverallAnalytics = cache(async (
  period: AnalyticsPeriod,
  projectId?: string
): Promise<OverallAnalytics> => {
  const identity = await requireRequestIdentity()

  const apiKeyProjectId = identity.type === 'api_key' ? identity.projectId : null
  const userId = identity.type === 'user' ? identity.userId : identity.createdByUserId

  if (apiKeyProjectId && !projectId) {
    throw new Error('API key requests must include a projectId filter.')
  }

  // Fetch projects with names upfront (eliminates separate project names query later)
  const userProjects = apiKeyProjectId
    ? [{ id: apiKeyProjectId, name: '' }]
    : projectId
      ? [{ id: projectId, name: '' }]
      : await getUserProjects(userId)
  const projectIds = userProjects.map(p => p.id)

  if (projectIds.length === 0) {
    return {
      sessions: { total: 0 },
      issues: { total: 0, open: 0 },
      conversionRate: { rate: 0 },
      timeSeries: { sessions: [], issues: [] },
      distributions: {
        sessionsBySource: [],
        sessionsByTag: [],
        issuesByType: [],
        issuesByPriority: [],
      },
      topProjects: [],
    }
  }

  const periodStart = getPeriodStartDate(period)
  const comparisonPeriod = getComparisonPeriod(period)

  // Build base conditions
  const sessionsBaseConditions = [
    inArray(sessions.project_id, projectIds),
    eq(sessions.is_archived, false),
  ]
  const issuesBaseConditions = [
    inArray(issues.project_id, projectIds),
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
      project_id: sessions.project_id,
    })
      .from(sessions)
      .where(and(...sessionsBaseConditions)),
    db.select({
      id: issues.id,
      created_at: issues.created_at,
      type: issues.type,
      status: issues.status,
      priority: issues.priority,
      project_id: issues.project_id,
    })
      .from(issues)
      .where(and(...issuesBaseConditions)),
  ])

  // Get comparison period data for change calculation
  let prevSessionCount = 0
  let prevIssueCount = 0
  let prevSessionIds: string[] = []

  if (comparisonPeriod) {
    const [prevSessionRows, prevIssueRows] = await Promise.all([
      db.select({ id: sessions.id })
        .from(sessions)
        .where(and(
          inArray(sessions.project_id, projectIds),
          eq(sessions.is_archived, false),
          gte(sessions.created_at, comparisonPeriod.start),
          lte(sessions.created_at, comparisonPeriod.end),
        )),
      db.select({ id: issues.id })
        .from(issues)
        .where(and(
          inArray(issues.project_id, projectIds),
          eq(issues.is_archived, false),
          gte(issues.created_at, comparisonPeriod.start),
          lte(issues.created_at, comparisonPeriod.end),
        )),
    ])
    prevSessionCount = prevSessionRows.length
    prevIssueCount = prevIssueRows.length
    prevSessionIds = prevSessionRows.map(s => s.id)
  }

  // Get sessions with linked issues for conversion rate via entity_relationships
  const sessionIds = sessionRows.map(s => s.id)
  const linkedSessionRows = sessionIds.length > 0
    ? await db.select({ session_id: entityRelationships.session_id })
        .from(entityRelationships)
        .where(and(
          inArray(entityRelationships.session_id, sessionIds),
          isNotNull(entityRelationships.issue_id)
        ))
    : []

  const convertedSessionIds = new Set(linkedSessionRows.map(ls => ls.session_id))

  // Calculate summary stats
  const openIssues = issueRows.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const conversionRate = sessionRows.length > 0 ? Math.round((convertedSessionIds.size / sessionRows.length) * 100) : 0

  // Get previous conversion rate if comparison period exists
  let prevConversionRate = 0
  if (comparisonPeriod && prevSessionIds.length > 0) {
    const prevLinkedRows = await db
      .select({ session_id: entityRelationships.session_id })
      .from(entityRelationships)
      .where(and(
        inArray(entityRelationships.session_id, prevSessionIds),
        isNotNull(entityRelationships.issue_id)
      ))
    const prevConvertedCount = new Set(prevLinkedRows.map(ls => ls.session_id)).size
    prevConversionRate = Math.round((prevConvertedCount / prevSessionIds.length) * 100)
  }

  // Build time series
  const sessionTimeSeries = buildTimeSeries(sessionRows, period)
  const issueTimeSeries = buildTimeSeries(issueRows, period)

  // Build distributions
  const sessionsBySource = buildDistribution(sessionRows, 'source')
  const sessionsByTag = buildTagDistribution(sessionRows)
  const issuesByType = buildDistribution(issueRows, 'type')
  const issuesByPriority = buildDistribution(issueRows, 'priority')

  // Get top projects
  const projectSessionCounts = new Map<string, number>()
  const projectIssueCounts = new Map<string, number>()

  sessionRows.forEach(s => {
    projectSessionCounts.set(s.project_id, (projectSessionCounts.get(s.project_id) ?? 0) + 1)
  })
  issueRows.forEach(i => {
    projectIssueCounts.set(i.project_id, (projectIssueCounts.get(i.project_id) ?? 0) + 1)
  })

  // Use project names from the initial query (no extra DB call needed)
  const projectMap = new Map(userProjects.map(p => [p.id, p.name]))

  const allProjectIds = new Set([
    ...Array.from(projectSessionCounts.keys()),
    ...Array.from(projectIssueCounts.keys()),
  ])
  const topProjects = Array.from(allProjectIds)
    .map(id => ({
      id,
      name: projectMap.get(id) ?? 'Unknown',
      sessionCount: projectSessionCounts.get(id) ?? 0,
      issueCount: projectIssueCounts.get(id) ?? 0,
    }))
    .sort((a, b) => (b.sessionCount + b.issueCount) - (a.sessionCount + a.issueCount))
    .slice(0, 5)

  return {
    sessions: {
      total: sessionRows.length,
      change: calculateChange(sessionRows.length, prevSessionCount),
    },
    issues: {
      total: issueRows.length,
      change: calculateChange(issueRows.length, prevIssueCount),
      open: openIssues,
    },
    conversionRate: {
      rate: conversionRate,
      change: comparisonPeriod ? conversionRate - prevConversionRate : undefined,
    },
    timeSeries: {
      sessions: sessionTimeSeries,
      issues: issueTimeSeries,
    },
    distributions: {
      sessionsBySource,
      sessionsByTag,
      issuesByType,
      issuesByPriority,
    },
    topProjects,
  }
})
