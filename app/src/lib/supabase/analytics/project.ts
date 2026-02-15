import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '../server'
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
export const getProjectAnalytics = cache(async (
  projectId: string,
  period: AnalyticsPeriod
): Promise<ProjectAnalytics> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new UnauthorizedError('Unable to resolve user context.')
  }

  // Verify user has access to this project (RLS enforces membership)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (!project) {
    throw new UnauthorizedError('You do not have access to this project.')
  }

  const periodStart = getPeriodStartDate(period)
  const comparisonPeriod = getComparisonPeriod(period)

  // Build queries
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, created_at, source, tags, status, message_count')
    .eq('project_id', projectId)
    .eq('is_archived', false)

  let issuesQuery = supabase
    .from('issues')
    .select('id, created_at, type, status, priority')
    .eq('project_id', projectId)
    .eq('is_archived', false)

  if (periodStart) {
    sessionsQuery = sessionsQuery.gte('created_at', periodStart.toISOString())
    issuesQuery = issuesQuery.gte('created_at', periodStart.toISOString())
  }

  const [sessionsResult, issuesResult] = await Promise.all([
    sessionsQuery,
    issuesQuery,
  ])

  const sessions = sessionsResult.data ?? []
  const issues = issuesResult.data ?? []

  // Get comparison data
  let prevSessionCount = 0
  let prevActiveIssueCount = 0
  let prevAvgMessages = 0

  if (comparisonPeriod) {
    const [prevSessionsResult, prevIssuesResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, message_count')
        .eq('project_id', projectId)
        .eq('is_archived', false)
        .gte('created_at', comparisonPeriod.start.toISOString())
        .lte('created_at', comparisonPeriod.end.toISOString()),
      supabase
        .from('issues')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('is_archived', false)
        .gte('created_at', comparisonPeriod.start.toISOString())
        .lte('created_at', comparisonPeriod.end.toISOString()),
    ])
    const prevSessions = prevSessionsResult.data ?? []
    const prevIssues = prevIssuesResult.data ?? []
    prevSessionCount = prevSessions.length
    prevActiveIssueCount = prevIssues.filter(i => i.status === 'open' || i.status === 'in_progress').length
    const prevTotalMessages = prevSessions.reduce((sum, s) => sum + (s.message_count ?? 0), 0)
    prevAvgMessages = prevSessions.length > 0 ? Math.round(prevTotalMessages / prevSessions.length) : 0
  }

  // Calculate stats
  const activeIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress').length

  const totalMessages = sessions.reduce((sum, s) => sum + (s.message_count ?? 0), 0)
  const avgMessages = sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0

  // Find top tag
  const tagCounts = new Map<string, number>()
  sessions.forEach(s => {
    (s.tags ?? []).forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    })
  })
  const topTag = tagCounts.size > 0
    ? Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // Build time series and distributions
  const sessionTimeSeries = buildTimeSeries(sessions, period)
  const sessionsByTag = buildTagDistribution(sessions)
  const sessionsBySource = buildDistribution(sessions, 'source')
  const issuesByType = buildDistribution(issues, 'type')
  const issuesByPriority = buildDistribution(issues, 'priority')

  return {
    sessions: {
      total: sessions.length,
      change: calculateChange(sessions.length, prevSessionCount),
    },
    activeIssues: {
      total: activeIssues,
      change: calculateChange(activeIssues, prevActiveIssueCount),
    },
    avgMessages: {
      value: avgMessages,
      change: calculateChange(avgMessages, prevAvgMessages),
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
})

/**
 * Get issue velocity data for the dashboard (created vs resolved per day + cumulative open)
 */
export async function getIssueVelocityData(
  projectId: string,
  period: AnalyticsPeriod
): Promise<{ created: TimeSeriesPoint[]; resolved: TimeSeriesPoint[]; cumulativeOpen: number }> {
  if (!isSupabaseConfigured()) {
    return { created: [], resolved: [], cumulativeOpen: 0 }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { created: [], resolved: [], cumulativeOpen: 0 }
  }

  const periodStart = getPeriodStartDate(period)

  let query = supabase
    .from('issues')
    .select('id, created_at, updated_at, status')
    .eq('project_id', projectId)
    .eq('is_archived', false)

  if (periodStart) {
    query = query.gte('created_at', periodStart.toISOString())
  }

  const { data: issues, error } = await query

  if (error || !issues) {
    return { created: [], resolved: [], cumulativeOpen: 0 }
  }

  // Build created time series
  const created = buildTimeSeries(issues, period)

  // Build resolved time series using updated_at as proxy for resolution date
  const resolvedIssues = issues
    .filter((i) => i.status === 'resolved' || i.status === 'closed')
    .map((i) => ({ ...i, created_at: i.updated_at }))
  const resolved = buildTimeSeries(resolvedIssues, period)

  // Cumulative open: count issues that are not resolved/closed
  const cumulativeOpen = issues.filter(
    (i) => i.status !== 'resolved' && i.status !== 'closed'
  ).length

  return { created, resolved, cumulativeOpen }
}
