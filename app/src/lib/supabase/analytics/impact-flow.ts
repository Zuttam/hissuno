import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '../server'
import type {
  AnalyticsPeriod,
  FlowGraphIssue,
  FlowGraphLink,
  FlowGraphNode,
  FlowGraphSession,
  FlowGraphUser,
  ImpactFlowGraphData,
} from './types'
import { batchedIn, getPeriodStartDate, getUserProjectIds, ISSUE_STATUS_COLORS } from './utils'

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

  const projectIds = projectId ? [projectId] : await getUserProjectIds(supabase)

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

  // Query sessions with embedded session_messages (for participant types) in one call,
  // and issue_sessions with embedded issues in another - both in parallel
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, source, user_id, name, message_count, created_at, session_messages(sender_type)')
    .in('project_id', projectIds)
    .eq('is_archived', false)

  if (periodStart) {
    sessionsQuery = sessionsQuery.gte('created_at', periodStart.toISOString())
  }

  const { data: sessions } = await sessionsQuery
  const sessionList = (sessions ?? []) as Array<{
    id: string; source: string; user_id: string | null; name: string | null;
    message_count: number; created_at: string;
    session_messages: Array<{ sender_type: string }>
  }>
  const sessionIds = sessionList.map(s => s.id)

  // Extract participant types from embedded session_messages
  const messageList = sessionList.flatMap(s =>
    (s.session_messages ?? []).map(m => ({ session_id: s.id, sender_type: m.sender_type }))
  )

  // Query issue_sessions with embedded issues (batched to avoid URI-too-long)
  type ImpactIssueLinkWithIssue = {
    issue_id: string; session_id: string;
    issue: { id: string; status: string; title: string; type: string; upvote_count: number; is_archived: boolean } | { id: string; status: string; title: string; type: string; upvote_count: number; is_archived: boolean }[] | null
  }
  const { data: issueLinksData } = await batchedIn<ImpactIssueLinkWithIssue>(
    (ids) => supabase
      .from('issue_sessions')
      .select('issue_id, session_id, issue:issues(id, status, title, type, upvote_count, is_archived)')
      .in('session_id', ids) as unknown as PromiseLike<{ data: ImpactIssueLinkWithIssue[] | null; error: { message: string } | null }>,
    sessionIds,
  )

  const issueLinks = issueLinksData.map(l => ({ issue_id: l.issue_id, session_id: l.session_id }))
  const linkedSessionIds = new Set(issueLinks.map(l => l.session_id))

  // Deduplicate issues from the embedded relation, filtering out archived
  const issueMap = new Map<string, { id: string; status: string; title: string; type: string; upvote_count: number }>()
  issueLinksData.forEach(l => {
    const issue = Array.isArray(l.issue) ? l.issue[0] : l.issue
    if (issue && !issue.is_archived && !issueMap.has(issue.id)) {
      issueMap.set(issue.id, issue)
    }
  })
  const issuesData = Array.from(issueMap.values())

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

  // Layer 1: Sessions node
  const sessionsIdx = nodes.length
  nodes.push({
    id: 'sessions',
    name: `Feedback (${sessionList.length})`,
    category: 'feedback',
    color: 'var(--accent-primary)',
  })

  // Layer 2: Issue status nodes
  const issueStatuses = ['open', 'ready', 'in_progress', 'resolved', 'closed']
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
