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

/**
 * Flow graph node categories
 */
export type FlowNodeCategory = 'source' | 'participant' | 'session' | 'issue'

/**
 * Node in the impact flow graph
 */
export interface FlowGraphNode {
  id: string
  name: string
  category: FlowNodeCategory
  color?: string
  expandable?: boolean
}

/**
 * Link between nodes in the flow graph
 */
export interface FlowGraphLink {
  source: number
  target: number
  value: number
}

/**
 * User data for expandable users node
 */
export interface FlowGraphUser {
  id: string
  displayName: string
  sessionCount: number
  email?: string
}

/**
 * Session summary for tooltip display
 */
export interface FlowGraphSession {
  id: string
  name: string | null
  userId: string | null
  source: string
  messageCount: number
  createdAt: string
}

/**
 * Issue summary for tooltip display
 */
export interface FlowGraphIssue {
  id: string
  title: string
  status: string
  type: string
  upvoteCount: number
}

/**
 * Tooltip data for different node types
 */
export interface FlowGraphTooltipData {
  /** Sessions grouped by source for source node tooltips */
  sessionsBySource: Record<string, FlowGraphSession[]>
  /** Issues grouped by status for issue node tooltips */
  issuesByStatus: Record<string, FlowGraphIssue[]>
  /** User details for user node tooltips */
  userDetails: Record<string, FlowGraphUser & { sessions: FlowGraphSession[] }>
}

/**
 * Complete impact flow graph data
 */
export interface ImpactFlowGraphData {
  nodes: FlowGraphNode[]
  links: FlowGraphLink[]
  totals: {
    sessions: number
    issues: number
    conversionRate: number
  }
  users: FlowGraphUser[]
  remainingUsersCount: number
  /** Additional data for rich tooltips */
  tooltipData: FlowGraphTooltipData
}

/**
 * Issue status to CSS variable color mapping
 */
const ISSUE_STATUS_COLORS: Record<string, string> = {
  open: 'var(--accent-warning)',
  ready: 'var(--accent-info)',
  in_progress: 'var(--accent-selected)',
  resolved: 'var(--accent-success)',
  closed: 'var(--accent-primary)',
}

/**
 * Source to CSS variable color mapping
 */
const SOURCE_COLORS: Record<string, string> = {
  widget: 'var(--accent-info)',
  slack: 'var(--accent-warning)',
  intercom: 'var(--accent-success)',
  gong: 'var(--accent-primary)',
  api: 'var(--accent-primary)',
  manual: 'var(--accent-primary)',
}

/**
 * Participant type to CSS variable color mapping
 */
const PARTICIPANT_COLORS: Record<string, string> = {
  ai: 'var(--accent-selected)',
  user: 'var(--accent-info)',
  human_agent: 'var(--accent-success)',
}

/**
 * Get impact flow graph analytics
 */
export const getImpactFlowAnalytics = cache(async (
  period: AnalyticsPeriod,
  projectId?: string
): Promise<ImpactFlowGraphData> => {
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
      nodes: [],
      links: [],
      totals: { sessions: 0, issues: 0, conversionRate: 0 },
      users: [],
      remainingUsersCount: 0,
      tooltipData: {
        sessionsBySource: {},
        issuesByStatus: {},
        userDetails: {},
      },
    }
  }

  const periodStart = getPeriodStartDate(period)

  // Query sessions with source and details for tooltips
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, source, user_id, name, message_count, created_at')
    .in('project_id', projectIds)
    .eq('is_archived', false)

  if (periodStart) {
    sessionsQuery = sessionsQuery.gte('created_at', periodStart.toISOString())
  }

  const { data: sessions } = await sessionsQuery
  const sessionList = sessions ?? []
  const sessionIds = sessionList.map(s => s.id)

  // Query participant types from session_messages
  const participantsQuery = supabase
    .from('session_messages')
    .select('session_id, sender_type')
    .in('session_id', sessionIds)

  const { data: messages } = await participantsQuery
  const messageList = messages ?? []

  // Query issues by status linked to sessions
  const { data: issueLinks } = await supabase
    .from('issue_sessions')
    .select('issue_id, session_id')
    .in('session_id', sessionIds)

  const linkedIssueIds = [...new Set((issueLinks ?? []).map(l => l.issue_id))]
  const linkedSessionIds = new Set((issueLinks ?? []).map(l => l.session_id))

  let issuesData: { id: string; status: string; title: string; type: string; upvote_count: number }[] = []
  if (linkedIssueIds.length > 0) {
    const { data: issues } = await supabase
      .from('issues')
      .select('id, status, title, type, upvote_count')
      .in('id', linkedIssueIds)
      .eq('is_archived', false)
    issuesData = issues ?? []
  }

  // Build source distribution
  const sourceCountsMap = new Map<string, number>()
  sessionList.forEach(s => {
    sourceCountsMap.set(s.source, (sourceCountsMap.get(s.source) ?? 0) + 1)
  })

  // Build participant distribution (sessions that have each participant type)
  const sessionParticipants = new Map<string, Set<string>>()
  messageList.forEach(m => {
    if (!sessionParticipants.has(m.session_id)) {
      sessionParticipants.set(m.session_id, new Set())
    }
    sessionParticipants.get(m.session_id)!.add(m.sender_type)
  })

  const participantCounts = new Map<string, number>()
  sessionParticipants.forEach((types) => {
    types.forEach(type => {
      participantCounts.set(type, (participantCounts.get(type) ?? 0) + 1)
    })
  })

  // Build user distribution for expandable node
  const userCounts = new Map<string, number>()
  sessionList.forEach(s => {
    const userId = s.user_id || 'anonymous'
    userCounts.set(userId, (userCounts.get(userId) ?? 0) + 1)
  })

  const sortedUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])

  const topUsers = sortedUsers.slice(0, 10).map(([id, count]) => ({
    id,
    displayName: id === 'anonymous' ? 'Anonymous' : id,
    sessionCount: count,
  }))

  const remainingUsersCount = Math.max(0, sortedUsers.length - 10)

  // Build issue status distribution
  const issueStatusCounts = new Map<string, number>()
  issuesData.forEach(i => {
    issueStatusCounts.set(i.status, (issueStatusCounts.get(i.status) ?? 0) + 1)
  })

  // Build nodes and links
  const nodes: FlowGraphNode[] = []
  const links: FlowGraphLink[] = []

  // Layer 0: Source nodes
  const sourceNodes = Array.from(sourceCountsMap.entries())
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])

  sourceNodes.forEach(([source]) => {
    nodes.push({
      id: `source-${source}`,
      name: source.charAt(0).toUpperCase() + source.slice(1),
      category: 'source',
      color: SOURCE_COLORS[source] ?? 'var(--accent-primary)',
    })
  })

  // Layer 1: Participant nodes (aggregated)
  const participantNodeStart = nodes.length
  const participantTypes = ['ai', 'user', 'human_agent']
  participantTypes.forEach(type => {
    const count = participantCounts.get(type) ?? 0
    if (count > 0) {
      nodes.push({
        id: `participant-${type}`,
        name: type === 'ai' ? 'AI Agent' : type === 'user' ? 'Users' : 'Human Agents',
        category: 'participant',
        color: PARTICIPANT_COLORS[type],
        expandable: type === 'user',
      })
    }
  })

  // Layer 2: Sessions node
  const sessionsNodeIndex = nodes.length
  nodes.push({
    id: 'sessions',
    name: 'Sessions',
    category: 'session',
    color: 'var(--accent-primary)',
  })

  // Layer 3: Issue status nodes
  const issueStatuses = ['open', 'ready', 'in_progress', 'resolved', 'closed']
  issueStatuses.forEach(status => {
    const count = issueStatusCounts.get(status) ?? 0
    if (count > 0) {
      nodes.push({
        id: `issue-${status}`,
        name: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category: 'issue',
        color: ISSUE_STATUS_COLORS[status],
      })
    }
  })

  // Links: Sources → Sessions
  sourceNodes.forEach(([source, count], sourceIndex) => {
    links.push({
      source: sourceIndex,
      target: sessionsNodeIndex,
      value: count,
    })
  })

  // Links: Sessions → Participants (reverse direction for visual flow)
  // Actually, let's link Sources → Participants → Sessions for proper flow
  // Recalculate: Sources connect to Sessions, Sessions connect to Issues
  // Participants are shown as a parallel layer

  // For simplicity, let's use a 3-layer approach:
  // Sources → Sessions → Issues
  // With participants shown as annotations or a separate visual

  // Clear and rebuild with simpler 3-layer flow
  nodes.length = 0
  links.length = 0

  // Layer 0: Source nodes
  sourceNodes.forEach(([source]) => {
    nodes.push({
      id: `source-${source}`,
      name: source.charAt(0).toUpperCase() + source.slice(1),
      category: 'source',
      color: SOURCE_COLORS[source] ?? 'var(--accent-primary)',
    })
  })

  // Layer 1: Sessions node
  const sessionsIdx = nodes.length
  nodes.push({
    id: 'sessions',
    name: `Sessions (${sessionList.length})`,
    category: 'session',
    color: 'var(--accent-primary)',
  })

  // Layer 2: Issue status nodes
  const issueNodeStartIdx = nodes.length
  issueStatuses.forEach(status => {
    const count = issueStatusCounts.get(status) ?? 0
    if (count > 0) {
      nodes.push({
        id: `issue-${status}`,
        name: `${status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (${count})`,
        category: 'issue',
        color: ISSUE_STATUS_COLORS[status],
      })
    }
  })

  // Links: Sources → Sessions
  sourceNodes.forEach(([_, count], sourceIndex) => {
    links.push({
      source: sourceIndex,
      target: sessionsIdx,
      value: count,
    })
  })

  // Links: Sessions → Issues (proportional to session-to-issue links)
  // Count how many sessions link to each issue status
  const sessionToStatusCount = new Map<string, number>()
  issueLinks?.forEach(link => {
    const issue = issuesData.find(i => i.id === link.issue_id)
    if (issue) {
      sessionToStatusCount.set(issue.status, (sessionToStatusCount.get(issue.status) ?? 0) + 1)
    }
  })

  let issueNodeIdx = issueNodeStartIdx
  issueStatuses.forEach(status => {
    const count = issueStatusCounts.get(status) ?? 0
    if (count > 0) {
      const linkCount = sessionToStatusCount.get(status) ?? count
      links.push({
        source: sessionsIdx,
        target: issueNodeIdx,
        value: linkCount,
      })
      issueNodeIdx++
    }
  })

  // Calculate totals
  const conversionRate = sessionList.length > 0
    ? Math.round((linkedSessionIds.size / sessionList.length) * 100)
    : 0

  // Build tooltip data
  // Sessions grouped by source (limit to 10 per source for tooltip display)
  const sessionsBySource: Record<string, FlowGraphSession[]> = {}
  sessionList.forEach(s => {
    if (!sessionsBySource[s.source]) {
      sessionsBySource[s.source] = []
    }
    if (sessionsBySource[s.source].length < 10) {
      sessionsBySource[s.source].push({
        id: s.id,
        name: s.name,
        userId: s.user_id,
        source: s.source,
        messageCount: s.message_count,
        createdAt: s.created_at,
      })
    }
  })

  // Issues grouped by status
  const issuesByStatus: Record<string, FlowGraphIssue[]> = {}
  issuesData.forEach(i => {
    if (!issuesByStatus[i.status]) {
      issuesByStatus[i.status] = []
    }
    issuesByStatus[i.status].push({
      id: i.id,
      title: i.title,
      status: i.status,
      type: i.type,
      upvoteCount: i.upvote_count,
    })
  })

  // User details with their sessions (for user node tooltips)
  const userDetails: Record<string, FlowGraphUser & { sessions: FlowGraphSession[] }> = {}
  topUsers.forEach(u => {
    const userSessions = sessionList
      .filter(s => (s.user_id || 'anonymous') === u.id)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        name: s.name,
        userId: s.user_id,
        source: s.source,
        messageCount: s.message_count,
        createdAt: s.created_at,
      }))
    userDetails[u.id] = {
      ...u,
      sessions: userSessions,
    }
  })

  return {
    nodes,
    links,
    totals: {
      sessions: sessionList.length,
      issues: issuesData.length,
      conversionRate,
    },
    users: topUsers,
    remainingUsersCount,
    tooltipData: {
      sessionsBySource,
      issuesByStatus,
      userDetails,
    },
  }
})
