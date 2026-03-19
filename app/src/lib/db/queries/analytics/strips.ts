import { cache } from 'react'
import { db } from '@/lib/db'
import { and, eq, gte, inArray, isNotNull, count as drizzleCount, sql } from 'drizzle-orm'
import { sessions, issues, entityRelationships } from '@/lib/db/schema/app'
import { requireRequestIdentity } from '@/lib/auth/identity'
import type { AnalyticsPeriod, IssuesStripAnalytics, SessionsStripAnalytics } from './types'
import {
  buildDistribution,
  buildTagDistribution,
  getPeriodStartDate,
} from './utils'
import { getUserProjectIds } from '@/lib/db/server'

/**
 * Get lightweight analytics for sessions page strip
 */
export const getSessionsStripAnalytics = cache(async (
  period: AnalyticsPeriod,
  projectId?: string
): Promise<SessionsStripAnalytics> => {
  const identity = await requireRequestIdentity()

  const apiKeyProjectId = identity.type === 'api_key' ? identity.projectId : null
  const userId = identity.type === 'user' ? identity.userId : identity.createdByUserId

  if (apiKeyProjectId && !projectId) {
    throw new Error('API key requests must include a projectId filter.')
  }

  const projectIds = apiKeyProjectId ? [apiKeyProjectId] : projectId ? [projectId] : await getUserProjectIds(userId)

  if (projectIds.length === 0) {
    return { total: 0, active: 0, closed: 0, topTags: [], avgMessages: 0, bySource: [] }
  }

  const periodStart = getPeriodStartDate(period)

  const conditions = [
    inArray(sessions.project_id, projectIds),
    eq(sessions.is_archived, false),
  ]

  if (periodStart) {
    conditions.push(gte(sessions.created_at, periodStart))
  }

  const sessionRows = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      tags: sessions.tags,
      message_count: sessions.message_count,
      source: sessions.source,
    })
    .from(sessions)
    .where(and(...conditions))

  const active = sessionRows.filter(s => s.status === 'active').length
  const closed = sessionRows.filter(s => s.status === 'closed').length
  const topTags = buildTagDistribution(sessionRows).slice(0, 5)

  // Calculate average messages
  const totalMessages = sessionRows.reduce((sum, s) => sum + (s.message_count ?? 0), 0)
  const avgMessages = sessionRows.length > 0 ? Math.round(totalMessages / sessionRows.length) : 0

  // Build source distribution
  const bySource = buildDistribution(sessionRows, 'source').slice(0, 5)

  return {
    total: sessionRows.length,
    active,
    closed,
    topTags,
    avgMessages,
    bySource,
  }
})

/**
 * Get lightweight analytics for issues page strip
 */
export const getIssuesStripAnalytics = cache(async (
  period: AnalyticsPeriod,
  projectId?: string
): Promise<IssuesStripAnalytics> => {
  const identity = await requireRequestIdentity()

  const apiKeyProjectId = identity.type === 'api_key' ? identity.projectId : null
  const userId = identity.type === 'user' ? identity.userId : identity.createdByUserId

  if (apiKeyProjectId && !projectId) {
    throw new Error('API key requests must include a projectId filter.')
  }

  const projectIds = apiKeyProjectId ? [apiKeyProjectId] : projectId ? [projectId] : await getUserProjectIds(userId)

  if (projectIds.length === 0) {
    return { total: 0, byStatus: [], topTypes: [], byPriority: [], conversionRate: 0 }
  }

  const periodStart = getPeriodStartDate(period)

  // Fetch issues
  const issueConditions = [
    inArray(issues.project_id, projectIds),
    eq(issues.is_archived, false),
  ]

  if (periodStart) {
    issueConditions.push(gte(issues.created_at, periodStart))
  }

  // Session count conditions for conversion rate
  const sessionConditions = [
    inArray(sessions.project_id, projectIds),
    eq(sessions.is_archived, false),
  ]

  if (periodStart) {
    sessionConditions.push(gte(sessions.created_at, periodStart))
  }

  const [issueRows, sessionCountResult, convertedCountResult] = await Promise.all([
    db.select({
      id: issues.id,
      status: issues.status,
      type: issues.type,
      priority: issues.priority,
    })
      .from(issues)
      .where(and(...issueConditions)),
    // Session count for conversion rate (count only)
    db.select({ count: drizzleCount() })
      .from(sessions)
      .where(and(...sessionConditions)),
    // Converted sessions count: sessions with at least one issue link via entity_relationships
    db.select({ count: drizzleCount(sql`DISTINCT ${sessions.id}`) })
      .from(sessions)
      .innerJoin(entityRelationships, and(
        eq(entityRelationships.session_id, sessions.id),
        isNotNull(entityRelationships.issue_id)
      ))
      .where(and(...sessionConditions)),
  ])

  const totalSessionCount = sessionCountResult[0]?.count ?? 0
  const convertedSessionCount = convertedCountResult[0]?.count ?? 0

  const byStatus = buildDistribution(issueRows, 'status')
  const topTypes = buildDistribution(issueRows, 'type').slice(0, 3)
  const byPriority = buildDistribution(issueRows, 'priority')

  // Calculate conversion rate using counts (no row data needed)
  const conversionRate = totalSessionCount > 0
    ? Math.round((convertedSessionCount / totalSessionCount) * 100)
    : 0

  return {
    total: issueRows.length,
    byStatus,
    topTypes,
    byPriority,
    conversionRate,
  }
})
