/**
 * Customers Resource Adapter
 *
 * Unified adapter that routes to contacts or companies
 * based on the customer_type filter (default: contacts).
 */

import { db } from '@/lib/db'
import { eq, and, desc, ilike, or } from 'drizzle-orm'
import { companies } from '@/lib/db/schema/app'
import { insertCompany } from '@/lib/db/queries/companies'
import { contactsAdapter } from './contacts'
import type { ResourceAdapter, ResourceListItem, ResourceDetail, SearchResult, AddResult } from './types'

export const customersAdapter: ResourceAdapter = {
  async list(projectId, filters) {
    const customerType = typeof filters.customer_type === 'string' ? filters.customer_type : 'contacts'

    if (customerType === 'companies') {
      return listCompanies(projectId, filters)
    }

    // Default: delegate to contacts adapter
    return contactsAdapter.list(projectId, filters)
  },

  async get(projectId, id) {
    // Try contacts first, then companies
    const contactResult = await contactsAdapter.get(projectId, id)
    if (contactResult) {
      return { ...contactResult, type: 'customers' as const }
    }

    // Try companies
    return getCompany(projectId, id)
  },

  async search(projectId, query, limit) {
    // Companies don't have semantic search - route to contacts
    const results = await contactsAdapter.search(projectId, query, limit)
    return results.map((r): SearchResult => ({ ...r, type: 'customers' }))
  },

  async add(projectId, data): Promise<AddResult> {
    const customerType = typeof data.customer_type === 'string' ? data.customer_type : 'contacts'

    if (customerType === 'companies') {
      return addCompany(projectId, data)
    }

    // Default: delegate to contacts adapter
    const result = await contactsAdapter.add(projectId, data)
    return { ...result, type: 'customers' }
  },
}

// ---------------------------------------------------------------------------
// Companies helpers
// ---------------------------------------------------------------------------

async function listCompanies(projectId: string, filters: Record<string, unknown>): Promise<{ items: ResourceListItem[]; total: number }> {
  const limit = typeof filters.limit === 'number' ? filters.limit : 20

  const conditions = [
    eq(companies.project_id, projectId),
    eq(companies.is_archived, false),
  ]

  if (typeof filters.search === 'string') {
    const s = `%${filters.search}%`
    conditions.push(
      or(
        ilike(companies.name, s),
        ilike(companies.domain, s)
      )!
    )
  }
  if (typeof filters.stage === 'string') {
    conditions.push(eq(companies.stage, filters.stage))
  }
  if (typeof filters.industry === 'string') {
    conditions.push(ilike(companies.industry, `%${filters.industry}%`))
  }

  const rows = await db.query.companies.findMany({
    where: and(...conditions),
    with: {
      contacts: {
        columns: { id: true, name: true, email: true },
      },
    },
    orderBy: desc(companies.updated_at),
    limit,
  })

  const items: ResourceListItem[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: [c.domain, c.stage, c.industry].filter(Boolean).join(' | '),
    metadata: {
      domain: c.domain,
      stage: c.stage ?? 'prospect',
      ...(c.industry ? { industry: c.industry } : {}),
      ...(c.arr != null ? { arr: String(c.arr) } : {}),
      ...(c.health_score != null ? { healthScore: String(c.health_score) } : {}),
      contactCount: String(Array.isArray(c.contacts) ? c.contacts.length : 0),
    },
  }))

  return { items, total: items.length }
}

async function getCompany(projectId: string, id: string): Promise<ResourceDetail | null> {
  const company = await db.query.companies.findFirst({
    where: and(
      eq(companies.id, id),
      eq(companies.project_id, projectId)
    ),
    with: {
      contacts: {
        columns: { id: true, name: true, email: true },
      },
    },
  })

  if (!company) {
    return null
  }

  const lines: string[] = [
    `# ${company.name}`,
    '',
    `- **Domain:** ${company.domain}`,
    company.industry ? `- **Industry:** ${company.industry}` : null,
    company.country ? `- **Country:** ${company.country}` : null,
    company.arr != null ? `- **ARR:** $${Number(company.arr).toLocaleString()}` : null,
    `- **Stage:** ${company.stage ?? 'prospect'}`,
    company.plan_tier ? `- **Plan Tier:** ${company.plan_tier}` : null,
    company.employee_count != null ? `- **Employees:** ${company.employee_count}` : null,
    company.health_score != null ? `- **Health Score:** ${company.health_score}/100` : null,
    company.renewal_date ? `- **Renewal Date:** ${company.renewal_date.toISOString()}` : null,
    company.notes ? `\n## Notes\n\n${company.notes}` : null,
  ].filter((line): line is string => line !== null)

  const companyContacts = company.contacts as Array<{ id: string; name: string; email: string }> | undefined
  if (companyContacts && companyContacts.length > 0) {
    lines.push('', '## Contacts', '')
    for (const c of companyContacts) {
      lines.push(`- **${c.name}** (${c.email})`)
    }
  }

  return {
    id: company.id,
    type: 'customers' as const,
    markdown: lines.join('\n'),
  }
}

async function addCompany(projectId: string, data: Record<string, unknown>): Promise<AddResult> {
  if (typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new Error('Validation error: "name" is required.')
  }
  if (typeof data.domain !== 'string' || data.domain.trim().length === 0) {
    throw new Error('Validation error: "domain" is required.')
  }

  const company = await insertCompany({
    projectId,
    name: data.name,
    domain: data.domain,
    industry: typeof data.industry === 'string' ? data.industry : undefined,
    arr: typeof data.arr === 'number' ? data.arr : undefined,
    stage: typeof data.stage === 'string' ? data.stage : undefined,
    employeeCount: typeof data.employee_count === 'number' ? data.employee_count : undefined,
    planTier: typeof data.plan_tier === 'string' ? data.plan_tier : undefined,
    country: typeof data.country === 'string' ? data.country : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
  })

  return {
    id: company.id,
    type: 'customers',
    name: company.name,
  }
}
