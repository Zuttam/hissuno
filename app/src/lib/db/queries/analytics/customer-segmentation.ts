import { cache } from 'react'
import { db } from '@/lib/db'
import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { sessions, contacts, companies, issues, entityRelationships } from '@/lib/db/schema/app'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { hasProjectAccess } from '@/lib/auth/project-members'
import type {
  AnalyticsPeriod,
  CustomerSegmentationAnalytics,
  CustomerSegmentationDataPoint,
  DistributionDataPoint,
} from './types'
import { getPeriodStartDate } from './utils'

/**
 * Get customer segmentation analytics for a project
 */
export const getCustomerSegmentationAnalytics = cache(async (
  projectId: string,
  period: AnalyticsPeriod
): Promise<CustomerSegmentationAnalytics> => {
  const identity = await requireRequestIdentity()
  const userId = identity.type === 'user' ? identity.userId : identity.createdByUserId

  const hasAccess = await hasProjectAccess(projectId, userId)
  if (!hasAccess) {
    throw new UnauthorizedError('You do not have access to this project.')
  }

  const periodStart = getPeriodStartDate(period)

  const emptyResult: CustomerSegmentationAnalytics = {
    summary: { companiesWithFeedback: 0, contactsWithFeedback: 0, championFeedbackPercentage: 0 },
    companies: { bySessionCount: [], byIssueCount: [] },
    contacts: { bySessionCount: [], championVsNonChampion: [] },
  }

  // Query sessions with contact and company data via separate queries, then join in JS
  const sessionConditions = [
    eq(sessions.project_id, projectId),
    eq(sessions.is_archived, false),
  ]

  if (periodStart) {
    sessionConditions.push(gte(sessions.created_at, periodStart))
  }

  const sessionRows = await db
    .select({
      id: sessions.id,
      created_at: sessions.created_at,
      source: sessions.source,
    })
    .from(sessions)
    .where(and(...sessionConditions))

  const sessionIds = sessionRows.map(s => s.id)

  // Get session-to-contact mappings via entity_relationships
  const sessionContactRels = sessionIds.length > 0
    ? await db
        .select({
          session_id: entityRelationships.session_id,
          contact_id: entityRelationships.contact_id,
        })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.project_id, projectId),
          inArray(entityRelationships.session_id, sessionIds),
          isNotNull(entityRelationships.contact_id)
        ))
    : []

  // Build session -> contact_id map
  const sessionContactMap = new Map<string, string>()
  for (const rel of sessionContactRels) {
    if (rel.session_id && rel.contact_id) {
      sessionContactMap.set(rel.session_id, rel.contact_id)
    }
  }

  // Check if any contacts exist
  if (sessionContactMap.size === 0) {
    return emptyResult
  }

  // Get unique contact IDs
  const contactIds = [...new Set(Array.from(sessionContactMap.values()))]

  // Query contacts with company data
  const contactRows = contactIds.length > 0
    ? await db
        .select({
          id: contacts.id,
          name: contacts.name,
          company_id: contacts.company_id,
          is_champion: contacts.is_champion,
        })
        .from(contacts)
        .where(inArray(contacts.id, contactIds))
    : []

  // Get unique company IDs from contacts
  const companyIds = [...new Set(contactRows.filter(c => c.company_id).map(c => c.company_id!))]

  // Query companies
  const companyRows = companyIds.length > 0
    ? await db
        .select({
          id: companies.id,
          name: companies.name,
          arr: companies.arr,
          stage: companies.stage,
        })
        .from(companies)
        .where(inArray(companies.id, companyIds))
    : []

  // Build contact and company maps
  const contactMap = new Map(contactRows.map(c => [c.id, {
    id: c.id,
    name: c.name,
    company_id: c.company_id,
    is_champion: c.is_champion ?? false,
  }]))
  const companyMap = new Map(companyRows.map(c => [c.id, c]))

  // Query issue-session links via entity_relationships
  const issueLinksRows = sessionIds.length > 0
    ? await db
        .select({
          issue_id: entityRelationships.issue_id,
          session_id: entityRelationships.session_id,
        })
        .from(entityRelationships)
        .where(and(
          eq(entityRelationships.project_id, projectId),
          inArray(entityRelationships.session_id, sessionIds),
          isNotNull(entityRelationships.issue_id)
        ))
    : []

  // Get issue data for linked issues
  const linkedIssueIds = [...new Set(issueLinksRows.map(l => l.issue_id).filter((id): id is string => id !== null))]
  const issueDataRows = linkedIssueIds.length > 0
    ? await db
        .select({
          id: issues.id,
          status: issues.status,
          is_archived: issues.is_archived,
        })
        .from(issues)
        .where(inArray(issues.id, linkedIssueIds))
    : []

  // Build issue map (skip archived issues)
  const issueMap = new Map<string, { id: string; status: string }>()
  issueDataRows.forEach(i => {
    if (!i.is_archived) {
      issueMap.set(i.id, { id: i.id, status: i.status ?? 'open' })
    }
  })

  const issueLinks = issueLinksRows
    .filter((l): l is { issue_id: string; session_id: string } => l.issue_id !== null && l.session_id !== null)
    .map(l => ({ issue_id: l.issue_id, session_id: l.session_id }))

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

  sessionRows.forEach(s => {
    const contactId = sessionContactMap.get(s.id)
    const contact = contactId ? contactMap.get(contactId) : null
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
  const totalLinkedSessions = sessionRows.filter(s => {
    const contactId = sessionContactMap.get(s.id)
    return contactId && contactMap.has(contactId)
  }).length

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

  sessionRows.forEach(s => {
    const cId = sessionContactMap.get(s.id)
    if (!cId) return
    const contact = contactMap.get(cId)
    if (!contact) return

    contactSessionCounts.set(cId, (contactSessionCounts.get(cId) ?? 0) + 1)

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
  }
})
