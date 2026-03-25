/**
 * Companies Queries (Drizzle)
 *
 * Pure database operations for companies.
 */

import { eq, and, desc, ilike, or, count as drizzleCount } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema/app'
import { sanitizeSearchInput } from '@/lib/db/server'
import type {
  CompanyRecord,
  CompanyWithContacts,
  CompanyFilters,
  UpdateCompanyInput,
} from '@/types/customer'

export type CompanyRow = typeof companies.$inferSelect
export type CompanyInsert = typeof companies.$inferInsert

// ============================================================================
// Pure DB Operations
// ============================================================================

export interface InsertCompanyData {
  projectId: string
  name: string
  domain: string
  arr?: number | null
  stage?: string
  productUsed?: string | null
  industry?: string | null
  employeeCount?: number | null
  planTier?: string | null
  renewalDate?: string | null
  healthScore?: number | null
  country?: string | null
  notes?: string | null
  customFields?: Record<string, unknown>
}

export async function insertCompany(
  data: InsertCompanyData
): Promise<CompanyRecord> {
  const [company] = await db
    .insert(companies)
    .values({
      project_id: data.projectId,
      name: data.name,
      domain: data.domain,
      arr: data.arr ?? null,
      stage: data.stage ?? 'prospect',
      product_used: data.productUsed ?? null,
      industry: data.industry ?? null,
      employee_count: data.employeeCount ?? null,
      plan_tier: data.planTier ?? null,
      renewal_date: data.renewalDate ? new Date(data.renewalDate) : null,
      health_score: data.healthScore ?? null,
      country: data.country ?? null,
      notes: data.notes ?? null,
      custom_fields: data.customFields ?? {},
      is_archived: false,
    })
    .returning()

  if (!company) {
    throw new Error('Failed to insert company: Unknown error')
  }

  return company as unknown as CompanyRecord
}

export async function updateCompanyById(
  companyId: string,
  data: UpdateCompanyInput
): Promise<CompanyRecord> {
  const updates: Record<string, unknown> = {}

  if (data.name !== undefined) updates.name = data.name
  if (data.domain !== undefined) updates.domain = data.domain
  if (data.arr !== undefined) updates.arr = data.arr
  if (data.stage !== undefined) updates.stage = data.stage
  if (data.product_used !== undefined) updates.product_used = data.product_used
  if (data.industry !== undefined) updates.industry = data.industry
  if (data.employee_count !== undefined) updates.employee_count = data.employee_count
  if (data.plan_tier !== undefined) updates.plan_tier = data.plan_tier
  if (data.renewal_date !== undefined) updates.renewal_date = data.renewal_date ? new Date(data.renewal_date) : null
  if (data.health_score !== undefined) updates.health_score = data.health_score
  if (data.country !== undefined) updates.country = data.country
  if (data.notes !== undefined) updates.notes = data.notes
  if (data.custom_fields !== undefined) updates.custom_fields = data.custom_fields

  const [company] = await db
    .update(companies)
    .set(updates)
    .where(eq(companies.id, companyId))
    .returning()

  if (!company) {
    throw new Error(`Failed to update company: Not found`)
  }

  return company as unknown as CompanyRecord
}

export async function deleteCompanyById(
  companyId: string
): Promise<boolean> {
  await db
    .delete(companies)
    .where(eq(companies.id, companyId))

  return true
}

export async function updateCompanyArchiveStatus(
  companyId: string,
  isArchived: boolean
): Promise<CompanyRecord> {
  const [data] = await db
    .update(companies)
    .set({ is_archived: isArchived })
    .where(eq(companies.id, companyId))
    .returning()

  if (!data) {
    throw new Error('Failed to update company archive status: Not found')
  }

  return data as unknown as CompanyRecord
}

// ============================================================================
// Query Functions (use user-authenticated client, with caching)
// ============================================================================

export async function listCompanies(
  projectId: string,
  filters: CompanyFilters
): Promise<{ companies: CompanyWithContacts[]; total: number }> {
  try {
    // Build conditions
    const conditions = []

    // Filter archived (hidden by default)
    if (!filters.showArchived) {
      conditions.push(eq(companies.is_archived, false))
    }

    conditions.push(eq(companies.project_id, projectId))

    if (filters.stage) {
      conditions.push(eq(companies.stage, filters.stage))
    }
    if (filters.search) {
      const s = sanitizeSearchInput(filters.search)
      conditions.push(
        or(
          ilike(companies.name, `%${s}%`),
          ilike(companies.domain, `%${s}%`)
        )!
      )
    }
    if (filters.industry) {
      conditions.push(ilike(companies.industry, `%${sanitizeSearchInput(filters.industry)}%`))
    }
    if (filters.planTier) {
      conditions.push(ilike(companies.plan_tier, `%${sanitizeSearchInput(filters.planTier)}%`))
    }
    if (filters.country) {
      conditions.push(ilike(companies.country, `%${sanitizeSearchInput(filters.country)}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const [countResult] = await db
      .select({ count: drizzleCount() })
      .from(companies)
      .where(whereClause)

    const total = countResult?.count ?? 0

    // Get paginated results with contacts relation
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    const rows = await db.query.companies.findMany({
      where: whereClause,
      with: {
        contacts: {
          columns: { id: true, name: true, email: true },
        },
      },
      orderBy: desc(companies.updated_at),
      limit,
      offset,
    })

    const companiesWithContacts = rows.map((c) => ({
      ...c,
      contact_count: Array.isArray(c.contacts) ? c.contacts.length : 0,
    })) as unknown as CompanyWithContacts[]

    return { companies: companiesWithContacts, total }
  } catch (error) {
    console.error('[db.companies] unexpected error listing companies', error)
    throw error
  }
}

export async function getCompanyById(companyId: string): Promise<CompanyWithContacts | null> {
  try {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      with: {
        contacts: {
          columns: { id: true, name: true, email: true },
        },
      },
    })

    if (!company) {
      return null
    }

    return {
      ...company,
      contact_count: Array.isArray(company.contacts) ? company.contacts.length : 0,
    } as unknown as CompanyWithContacts
  } catch (error) {
    console.error('[db.companies] unexpected error getting company', companyId, error)
    throw error
  }
}
