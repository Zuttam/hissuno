import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '../server'
import type { AnalyticsPeriod, IssuesStripAnalytics, SessionsStripAnalytics } from './types'
import {
  buildDistribution,
  buildTagDistribution,
  getPeriodStartDate,
  getUserProjectIds,
} from './utils'

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

  // Session count for conversion rate (count only, no rows transferred)
  let sessionsCountQuery = supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .in('project_id', projectIds)
    .eq('is_archived', false)

  // Converted sessions count: sessions with at least one issue link (inner join, count only)
  let convertedCountQuery = supabase
    .from('sessions')
    .select('id, issue_sessions!inner(session_id)', { count: 'exact', head: true })
    .in('project_id', projectIds)
    .eq('is_archived', false)

  if (periodStart) {
    sessionsCountQuery = sessionsCountQuery.gte('created_at', periodStart.toISOString())
    convertedCountQuery = convertedCountQuery.gte('created_at', periodStart.toISOString())
  }

  const [issuesResult, sessionsCountResult, convertedCountResult] = await Promise.all([
    issuesQuery,
    sessionsCountQuery,
    convertedCountQuery,
  ])

  const issueList = issuesResult.data ?? []
  const totalSessionCount = sessionsCountResult.count ?? 0
  const convertedSessionCount = convertedCountResult.count ?? 0

  const byStatus = buildDistribution(issueList, 'status')
  const topTypes = buildDistribution(issueList, 'type').slice(0, 3)
  const byPriority = buildDistribution(issueList, 'priority')

  // Calculate conversion rate using counts (no row data needed)
  const conversionRate = totalSessionCount > 0
    ? Math.round((convertedSessionCount / totalSessionCount) * 100)
    : 0

  return {
    total: issueList.length,
    byStatus,
    topTypes,
    byPriority,
    conversionRate,
  }
})
