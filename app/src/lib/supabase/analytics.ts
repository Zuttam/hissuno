import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from './server'

/**
 * Analytics time periods
 */
export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all'

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  date: string
  count: number
}

// Alias for component compatibility
export type TimeSeriesDataPoint = TimeSeriesPoint

/**
 * Distribution data point
 */
export interface DistributionDataPoint {
  label: string
  value: number
  percentage: number
}

// Alias for backward compatibility
export type DistributionPoint = DistributionDataPoint

/**
 * Overall analytics data - matches dashboard expectations
 */
export interface OverallAnalytics {
  sessions: {
    total: number
    change?: number
  }
  issues: {
    total: number
    change?: number
    open: number
  }
  conversionRate: {
    rate: number
    change?: number
  }
  timeSeries: {
    sessions: TimeSeriesPoint[]
    issues: TimeSeriesPoint[]
  }
  distributions: {
    sessionsBySource: DistributionPoint[]
    sessionsByTag: DistributionPoint[]
    issuesByType: DistributionPoint[]
    issuesByPriority: DistributionPoint[]
  }
  topProjects: Array<{ id: string; name: string; sessionCount: number; issueCount: number }>
}

/**
 * Project analytics data
 */
export interface ProjectAnalytics {
  sessions: {
    total: number
    change?: number
  }
  activeIssues: {
    total: number
    change?: number
  }
  avgMessages: {
    value: number
    change?: number
  }
  topTag: string | null
  timeSeries: {
    sessions: TimeSeriesPoint[]
  }
  distributions: {
    sessionsByTag: DistributionPoint[]
    sessionsBySource: DistributionPoint[]
    issuesByType: DistributionPoint[]
    issuesByPriority: DistributionPoint[]
  }
}

/**
 * Sessions strip analytics (lightweight)
 */
export interface SessionsStripAnalytics {
  total: number
  active: number
  closed: number
  topTags: DistributionPoint[]
  avgMessages: number
  bySource: DistributionPoint[]
}

/**
 * Issues strip analytics (lightweight)
 */
export interface IssuesStripAnalytics {
  total: number
  byStatus: DistributionPoint[]
  topTypes: DistributionPoint[]
  byPriority: DistributionPoint[]
  conversionRate: number
}

/**
 * Get period start date based on period string
 */
function getPeriodStartDate(period: AnalyticsPeriod): Date | null {
  if (period === 'all') return null

  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * Get comparison period start/end dates (previous period of same length)
 */
function getComparisonPeriod(period: AnalyticsPeriod): { start: Date; end: Date } | null {
  if (period === 'all') return null

  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90

  const end = new Date(now)
  end.setDate(end.getDate() - days)
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)

  return { start, end }
}

/**
 * Calculate percentage change between two values
 */
function calculateChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * Get user's project IDs for filtering
 */
async function getUserProjectIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
  const { data: userProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)

  return userProjects?.map(p => p.id) ?? []
}

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

  const projectIds = projectId ? [projectId] : await getUserProjectIds(supabase, user.id)

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
  let prevOpenIssueCount = 0
  let prevSessionIds: string[] = []

  if (comparisonPeriod) {
    const [prevSessionsResult, prevIssuesResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id')
        .in('project_id', projectIds)
        .eq('is_archived', false)
        .gte('created_at', comparisonPeriod.start.toISOString())
        .lte('created_at', comparisonPeriod.end.toISOString()),
      supabase
        .from('issues')
        .select('id, status')
        .in('project_id', projectIds)
        .eq('is_archived', false)
        .gte('created_at', comparisonPeriod.start.toISOString())
        .lte('created_at', comparisonPeriod.end.toISOString()),
    ])
    const prevSessions = prevSessionsResult.data ?? []
    const prevIssues = prevIssuesResult.data ?? []
    prevSessionCount = prevSessions.length
    prevIssueCount = prevIssues.length
    prevOpenIssueCount = prevIssues.filter(i => i.status === 'open' || i.status === 'in_progress').length
    prevSessionIds = prevSessions.map(s => s.id)
  }

  // Get sessions with linked issues for conversion rate
  const { data: linkedSessions } = await supabase
    .from('issue_sessions')
    .select('session_id')
    .in('session_id', sessions.map(s => s.id))

  const convertedSessionIds = new Set(linkedSessions?.map(ls => ls.session_id) ?? [])

  // Calculate summary stats
  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const conversionRate = sessions.length > 0 ? Math.round((convertedSessionIds.size / sessions.length) * 100) : 0

  // Get previous conversion rate if comparison period exists
  let prevConversionRate = 0
  if (comparisonPeriod && prevSessionIds.length > 0) {
    const { data: prevLinkedSessions } = await supabase
      .from('issue_sessions')
      .select('session_id')
      .in('session_id', prevSessionIds)
    const prevConvertedCount = new Set(prevLinkedSessions?.map(ls => ls.session_id) ?? []).size
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

  // Get project names
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds)

  const projectMap = new Map(projects?.map(p => [p.id, p.name]) ?? [])

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

  // Verify user owns this project
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
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
 * Get lightweight analytics for sessions page strip
 */
export const getSessionsStripAnalytics = cache(async (
  period: AnalyticsPeriod,
  projectId?: string
): Promise<SessionsStripAnalytics> => {
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

  const projectIds = projectId ? [projectId] : await getUserProjectIds(supabase, user.id)

  if (projectIds.length === 0) {
    return { total: 0, active: 0, closed: 0, topTags: [], avgMessages: 0, bySource: [] }
  }

  const periodStart = getPeriodStartDate(period)

  let query = supabase
    .from('sessions')
    .select('id, status, tags, message_count, source')
    .in('project_id', projectIds)
    .eq('is_archived', false)

  if (periodStart) {
    query = query.gte('created_at', periodStart.toISOString())
  }

  const { data: sessions } = await query
  const sessionList = sessions ?? []

  const active = sessionList.filter(s => s.status === 'active').length
  const closed = sessionList.filter(s => s.status === 'closed').length
  const topTags = buildTagDistribution(sessionList).slice(0, 5)

  // Calculate average messages
  const totalMessages = sessionList.reduce((sum, s) => sum + (s.message_count ?? 0), 0)
  const avgMessages = sessionList.length > 0 ? Math.round(totalMessages / sessionList.length) : 0

  // Build source distribution
  const bySource = buildDistribution(sessionList, 'source').slice(0, 5)

  return {
    total: sessionList.length,
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

  const projectIds = projectId ? [projectId] : await getUserProjectIds(supabase, user.id)

  if (projectIds.length === 0) {
    return { total: 0, byStatus: [], topTypes: [], byPriority: [], conversionRate: 0 }
  }

  const periodStart = getPeriodStartDate(period)

  // Fetch issues with priority
  let issuesQuery = supabase
    .from('issues')
    .select('id, status, type, priority')
    .in('project_id', projectIds)
    .eq('is_archived', false)

  if (periodStart) {
    issuesQuery = issuesQuery.gte('created_at', periodStart.toISOString())
  }

  // Fetch sessions to calculate conversion rate
  let sessionsQuery = supabase
    .from('sessions')
    .select('id')
    .in('project_id', projectIds)
    .eq('is_archived', false)

  if (periodStart) {
    sessionsQuery = sessionsQuery.gte('created_at', periodStart.toISOString())
  }

  const [issuesResult, sessionsResult] = await Promise.all([
    issuesQuery,
    sessionsQuery,
  ])

  const issueList = issuesResult.data ?? []
  const sessionList = sessionsResult.data ?? []

  const byStatus = buildDistribution(issueList, 'status')
  const topTypes = buildDistribution(issueList, 'type').slice(0, 3)
  const byPriority = buildDistribution(issueList, 'priority')

  // Calculate conversion rate (sessions that created issues)
  let conversionRate = 0
  if (sessionList.length > 0) {
    const { data: linkedSessions } = await supabase
      .from('issue_sessions')
      .select('session_id')
      .in('session_id', sessionList.map(s => s.id))

    const convertedSessionIds = new Set(linkedSessions?.map(ls => ls.session_id) ?? [])
    conversionRate = Math.round((convertedSessionIds.size / sessionList.length) * 100)
  }

  return {
    total: issueList.length,
    byStatus,
    topTypes,
    byPriority,
    conversionRate,
  }
})

/**
 * Build time series from records with created_at
 */
function buildTimeSeries<T extends { created_at: string }>(
  records: T[],
  period: AnalyticsPeriod
): TimeSeriesPoint[] {
  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30

  // Create map of date -> count
  const countsByDate = new Map<string, number>()

  // Initialize all dates in range
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    countsByDate.set(dateStr, 0)
  }

  // Count records by date
  records.forEach(record => {
    const dateStr = record.created_at.split('T')[0]
    if (countsByDate.has(dateStr)) {
      countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1)
    }
  })

  // Convert to array
  return Array.from(countsByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))
}

/**
 * Build distribution from records by a key
 */
function buildDistribution<T extends Record<string, unknown>>(
  records: T[],
  key: keyof T
): DistributionDataPoint[] {
  const counts = new Map<string, number>()

  records.forEach(record => {
    const value = String(record[key] ?? 'unknown')
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })

  const total = records.length
  return Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Build tag distribution from sessions
 */
function buildTagDistribution<T extends { tags: string[] | null }>(
  records: T[]
): DistributionDataPoint[] {
  const counts = new Map<string, number>()

  records.forEach(record => {
    (record.tags ?? []).forEach((tag: string) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    })
  })

  const total = records.length
  return Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
}
