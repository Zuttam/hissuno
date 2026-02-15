import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '../server'
import type { AnalyticsPeriod, OverallAnalytics } from './types'
import {
  batchedIn,
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

  // Fetch projects with names upfront (eliminates separate project names query later)
  const userProjects = projectId
    ? [{ id: projectId, name: '' }]
    : await getUserProjects(supabase, user.id)
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

  // Build base queries
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, created_at, source, tags, status, project_id')
    .in('project_id', projectIds)
    .eq('is_archived', false)

  let issuesQuery = supabase
    .from('issues')
    .select('id, created_at, type, status, priority, project_id')
    .in('project_id', projectIds)
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

  // Get comparison period data for change calculation
  let prevSessionCount = 0
  let prevIssueCount = 0
  let prevSessionIds: string[] = []

  if (comparisonPeriod) {
    // Use count query for issues (no rows needed), but fetch session IDs (needed for conversion rate)
    const [prevSessionsResult, prevIssueCountResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id')
        .in('project_id', projectIds)
        .eq('is_archived', false)
        .gte('created_at', comparisonPeriod.start.toISOString())
        .lte('created_at', comparisonPeriod.end.toISOString()),
      supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('is_archived', false)
        .gte('created_at', comparisonPeriod.start.toISOString())
        .lte('created_at', comparisonPeriod.end.toISOString()),
    ])
    const prevSessions = prevSessionsResult.data ?? []
    prevSessionCount = prevSessions.length
    prevIssueCount = prevIssueCountResult.count ?? 0
    prevSessionIds = prevSessions.map(s => s.id)
  }

  // Get sessions with linked issues for conversion rate (batched to avoid URI-too-long)
  const { data: linkedSessions } = await batchedIn<{ session_id: string }>(
    (ids) => supabase
      .from('issue_sessions')
      .select('session_id')
      .in('session_id', ids) as unknown as PromiseLike<{ data: { session_id: string }[] | null; error: { message: string } | null }>,
    sessions.map(s => s.id),
  )

  const convertedSessionIds = new Set(linkedSessions.map(ls => ls.session_id))

  // Calculate summary stats
  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const conversionRate = sessions.length > 0 ? Math.round((convertedSessionIds.size / sessions.length) * 100) : 0

  // Get previous conversion rate if comparison period exists
  let prevConversionRate = 0
  if (comparisonPeriod && prevSessionIds.length > 0) {
    const { data: prevLinkedSessions } = await batchedIn<{ session_id: string }>(
      (ids) => supabase
        .from('issue_sessions')
        .select('session_id')
        .in('session_id', ids) as unknown as PromiseLike<{ data: { session_id: string }[] | null; error: { message: string } | null }>,
      prevSessionIds,
    )
    const prevConvertedCount = new Set(prevLinkedSessions.map(ls => ls.session_id)).size
    prevConversionRate = Math.round((prevConvertedCount / prevSessionIds.length) * 100)
  }

  // Build time series
  const sessionTimeSeries = buildTimeSeries(sessions, period)
  const issueTimeSeries = buildTimeSeries(issues, period)

  // Build distributions
  const sessionsBySource = buildDistribution(sessions, 'source')
  const sessionsByTag = buildTagDistribution(sessions)
  const issuesByType = buildDistribution(issues, 'type')
  const issuesByPriority = buildDistribution(issues, 'priority')

  // Get top projects
  const projectSessionCounts = new Map<string, number>()
  const projectIssueCounts = new Map<string, number>()

  sessions.forEach(s => {
    projectSessionCounts.set(s.project_id, (projectSessionCounts.get(s.project_id) ?? 0) + 1)
  })
  issues.forEach(i => {
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
      total: sessions.length,
      change: calculateChange(sessions.length, prevSessionCount),
    },
    issues: {
      total: issues.length,
      change: calculateChange(issues.length, prevIssueCount),
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
