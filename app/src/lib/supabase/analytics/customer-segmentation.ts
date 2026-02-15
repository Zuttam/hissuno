import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '../server'
import type {
  AnalyticsPeriod,
  CustomerSegmentationAnalytics,
  CustomerSegmentationDataPoint,
  DistributionDataPoint,
  FlowGraphCompany,
  FlowGraphLink,
  FlowGraphNode,
} from './types'
import { batchedIn, getPeriodStartDate, ISSUE_STATUS_COLORS } from './utils'

/**
 * Get customer segmentation analytics for a project
 */
export const getCustomerSegmentationAnalytics = cache(async (
  projectId: string,
  period: AnalyticsPeriod
): Promise<CustomerSegmentationAnalytics> => {
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

  const emptyResult: CustomerSegmentationAnalytics = {
    summary: { companiesWithFeedback: 0, contactsWithFeedback: 0, championFeedbackPercentage: 0 },
    companies: { bySessionCount: [], byIssueCount: [] },
    contacts: { bySessionCount: [], championVsNonChampion: [] },
    companyImpactFlow: { nodes: [], links: [], companies: [], remainingCompaniesCount: 0, totals: { sessions: 0, issues: 0, conversionRate: 0 } },
  }

  // Single sessions query with nested contact -> company relations (replaces 3 separate queries)
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, contact_id, created_at, source, contact:contacts(id, name, company_id, is_champion, company:companies(id, name, arr, stage))')
    .eq('project_id', projectId)
    .eq('is_archived', false)

  if (periodStart) {
    sessionsQuery = sessionsQuery.gte('created_at', periodStart.toISOString())
  }

  const { data: sessions, error: sessionsError } = await sessionsQuery
  if (sessionsError) {
    console.error('[analytics.customerSegmentation] sessions query failed', sessionsError)
  }

  type SessionWithContact = {
    id: string; contact_id: string | null; created_at: string; source: string;
    contact: {
      id: string; name: string; company_id: string | null; is_champion: boolean;
      company: { id: string; name: string; arr: number | null; stage: string | null } | null
    } | null
  }
  const sessionList = (sessions ?? []) as unknown as SessionWithContact[]
  const sessionIds = sessionList.map(s => s.id)

  // Check if any contacts exist
  const hasContacts = sessionList.some(s => s.contact_id !== null)
  if (!hasContacts) {
    return emptyResult
  }

  // Issue_sessions query with embedded issues (batched to avoid URI-too-long)
  type IssueLinkWithIssue = {
    issue_id: string; session_id: string;
    issue: { id: string; status: string; is_archived: boolean } | { id: string; status: string; is_archived: boolean }[] | null
  }
  const { data: issueLinksRaw, error: issueLinksError } = await batchedIn<IssueLinkWithIssue>(
    (ids) => supabase
      .from('issue_sessions')
      .select('issue_id, session_id, issue:issues(id, status, is_archived)')
      .in('session_id', ids) as unknown as PromiseLike<{ data: IssueLinkWithIssue[] | null; error: { message: string } | null }>,
    sessionIds,
  )

  if (issueLinksError) {
    console.error('[analytics.customerSegmentation] issue_sessions query failed', issueLinksError)
  }

  const issueLinksData = issueLinksRaw
  const issueLinks = issueLinksData.map(l => ({ issue_id: l.issue_id, session_id: l.session_id }))

  // Build contact and company maps from embedded session data
  const contactMap = new Map<string, { id: string; name: string; company_id: string | null; is_champion: boolean }>()
  const companyMap = new Map<string, { id: string; name: string; arr: number | null; stage: string | null }>()

  sessionList.forEach(s => {
    const contact = Array.isArray(s.contact) ? s.contact[0] : s.contact
    if (contact && !contactMap.has(contact.id)) {
      contactMap.set(contact.id, { id: contact.id, name: contact.name, company_id: contact.company_id, is_champion: contact.is_champion })
      const company = Array.isArray(contact.company) ? contact.company[0] : contact.company
      if (company && !companyMap.has(company.id)) {
        companyMap.set(company.id, company)
      }
    }
  })

  // Build issue map from embedded data (skip archived issues)
  const issueMap = new Map<string, { id: string; status: string }>()
  issueLinksData.forEach(l => {
    const issue = Array.isArray(l.issue) ? l.issue[0] : l.issue
    if (issue && !issue.is_archived && !issueMap.has(issue.id)) {
      issueMap.set(issue.id, issue)
    }
  })

  // Map session -> issue IDs
  const sessionIssueMap = new Map<string, Set<string>>()
  issueLinks.forEach(l => {
    if (!sessionIssueMap.has(l.session_id)) {
      sessionIssueMap.set(l.session_id, new Set())
    }
    sessionIssueMap.get(l.session_id)!.add(l.issue_id)
  })

  // --- Company aggregation ---
  const companySessionCounts = new Map<string, number>()
  const companyIssueSets = new Map<string, Set<string>>()

  sessionList.forEach(s => {
    const contact = s.contact_id ? contactMap.get(s.contact_id) : null
    const companyId = contact?.company_id
    if (!companyId) return

    companySessionCounts.set(companyId, (companySessionCounts.get(companyId) ?? 0) + 1)

    const issueIdsForSession = sessionIssueMap.get(s.id)
    if (issueIdsForSession) {
      if (!companyIssueSets.has(companyId)) {
        companyIssueSets.set(companyId, new Set())
      }
      issueIdsForSession.forEach(id => companyIssueSets.get(companyId)!.add(id))
    }
  })

  // Total sessions linked to contacts
  const totalLinkedSessions = sessionList.filter(s => s.contact_id && contactMap.has(s.contact_id)).length

  // Top 10 companies by session count
  const sortedCompanies = Array.from(companySessionCounts.entries())
    .sort((a, b) => b[1] - a[1])

  const top10Companies = sortedCompanies.slice(0, 10)

  const companiesBySessionCount: CustomerSegmentationDataPoint[] = top10Companies.map(([companyId, count]) => {
    const company = companyMap.get(companyId)
    return {
      entityId: companyId,
      label: company?.name ?? 'Unknown',
      value: count,
      percentage: totalLinkedSessions > 0 ? Math.round((count / totalLinkedSessions) * 100) : 0,
      arr: company?.arr,
    }
  })

  // Top 10 companies by issue count
  const companiesByIssueArr = Array.from(companyIssueSets.entries())
    .map(([companyId, issueIds]) => ({ companyId, issueCount: issueIds.size }))
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 10)

  const totalLinkedIssues = new Set(issueLinks.map(l => l.issue_id)).size
  const companiesByIssueCount: CustomerSegmentationDataPoint[] = companiesByIssueArr.map(({ companyId, issueCount }) => {
    const company = companyMap.get(companyId)
    return {
      entityId: companyId,
      label: company?.name ?? 'Unknown',
      value: issueCount,
      percentage: totalLinkedIssues > 0 ? Math.round((issueCount / totalLinkedIssues) * 100) : 0,
      arr: company?.arr,
    }
  })

  // --- Contact aggregation ---
  const contactSessionCounts = new Map<string, number>()
  let championSessions = 0
  let nonChampionSessions = 0

  sessionList.forEach(s => {
    if (!s.contact_id) return
    const contact = contactMap.get(s.contact_id)
    if (!contact) return

    contactSessionCounts.set(s.contact_id, (contactSessionCounts.get(s.contact_id) ?? 0) + 1)

    if (contact.is_champion) {
      championSessions++
    } else {
      nonChampionSessions++
    }
  })

  const totalContactSessions = championSessions + nonChampionSessions
  const contactsBySessionCount: CustomerSegmentationDataPoint[] = Array.from(contactSessionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([contactId, count]) => {
      const contact = contactMap.get(contactId)
      return {
        entityId: contactId,
        label: contact?.name ?? 'Unknown',
        value: count,
        percentage: totalContactSessions > 0 ? Math.round((count / totalContactSessions) * 100) : 0,
      }
    })

  const championVsNonChampion: DistributionDataPoint[] = [
    {
      label: 'Champion',
      value: championSessions,
      percentage: totalContactSessions > 0 ? Math.round((championSessions / totalContactSessions) * 100) : 0,
    },
    {
      label: 'Non-Champion',
      value: nonChampionSessions,
      percentage: totalContactSessions > 0 ? Math.round((nonChampionSessions / totalContactSessions) * 100) : 0,
    },
  ]

  const championFeedbackPercentage = totalContactSessions > 0
    ? Math.round((championSessions / totalContactSessions) * 100)
    : 0

  // --- Company Impact Flow (Sankey) ---
  const flowNodes: FlowGraphNode[] = []
  const flowLinks: FlowGraphLink[] = []

  // Layer 0: Company nodes (top 10 + Other)
  const remainingCompaniesCount = Math.max(0, sortedCompanies.length - 10)
  const remainingSessionCount = sortedCompanies.slice(10).reduce((sum, [_, count]) => sum + count, 0)

  top10Companies.forEach(([companyId]) => {
    const company = companyMap.get(companyId)
    flowNodes.push({
      id: `company-${companyId}`,
      name: company?.name ?? 'Unknown',
      category: 'source',
      color: 'var(--accent-info)',
    })
  })

  if (remainingCompaniesCount > 0 && remainingSessionCount > 0) {
    flowNodes.push({
      id: 'company-other',
      name: `+${remainingCompaniesCount} others`,
      category: 'source',
      color: 'var(--accent-primary)',
    })
  }

  // Layer 1: Sessions node
  const sessionsNodeIdx = flowNodes.length
  flowNodes.push({
    id: 'sessions',
    name: `Feedback (${totalLinkedSessions})`,
    category: 'feedback',
    color: 'var(--accent-primary)',
  })

  // Layer 2: Issue status nodes
  const companyIssueStatusCounts = new Map<string, number>()
  companyIssueSets.forEach((issueIds) => {
    issueIds.forEach(id => {
      const issue = issueMap.get(id)
      if (issue) {
        companyIssueStatusCounts.set(issue.status, (companyIssueStatusCounts.get(issue.status) ?? 0) + 1)
      }
    })
  })

  const issueStatuses = ['open', 'ready', 'in_progress', 'resolved', 'closed']
  issueStatuses.forEach(status => {
    const count = companyIssueStatusCounts.get(status) ?? 0
    if (count > 0) {
      flowNodes.push({
        id: `issue-${status}`,
        name: `${status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (${count})`,
        category: 'issue',
        color: ISSUE_STATUS_COLORS[status],
      })
    }
  })

  // Links: Companies → Sessions
  top10Companies.forEach(([_, count], index) => {
    flowLinks.push({ source: index, target: sessionsNodeIdx, value: count })
  })
  if (remainingCompaniesCount > 0 && remainingSessionCount > 0) {
    flowLinks.push({ source: top10Companies.length, target: sessionsNodeIdx, value: remainingSessionCount })
  }

  // Links: Sessions → Issue statuses
  let issueNodeIdx = sessionsNodeIdx + 1
  issueStatuses.forEach(status => {
    const count = companyIssueStatusCounts.get(status) ?? 0
    if (count > 0) {
      flowLinks.push({ source: sessionsNodeIdx, target: issueNodeIdx, value: count })
      issueNodeIdx++
    }
  })

  const linkedSessionCount = new Set(issueLinks.map(l => l.session_id)).size
  const flowConversionRate = totalLinkedSessions > 0
    ? Math.round((linkedSessionCount / totalLinkedSessions) * 100)
    : 0

  const flowCompanies: FlowGraphCompany[] = top10Companies.map(([companyId, sessionCount]) => {
    const company = companyMap.get(companyId)
    return {
      id: companyId,
      name: company?.name ?? 'Unknown',
      sessionCount,
      issueCount: companyIssueSets.get(companyId)?.size ?? 0,
      arr: company?.arr ?? null,
      stage: company?.stage ?? 'Unknown',
    }
  })

  return {
    summary: {
      companiesWithFeedback: companySessionCounts.size,
      contactsWithFeedback: contactSessionCounts.size,
      championFeedbackPercentage,
    },
    companies: {
      bySessionCount: companiesBySessionCount,
      byIssueCount: companiesByIssueCount,
    },
    contacts: {
      bySessionCount: contactsBySessionCount,
      championVsNonChampion,
    },
    companyImpactFlow: {
      nodes: flowNodes,
      links: flowLinks,
      companies: flowCompanies,
      remainingCompaniesCount,
      totals: {
        sessions: totalLinkedSessions,
        issues: totalLinkedIssues,
        conversionRate: flowConversionRate,
      },
    },
  }
})
