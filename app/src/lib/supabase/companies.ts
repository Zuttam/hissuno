/**
 * Companies Database Layer
 *
 * Pure database operations for companies.
 */

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from './server'
import type {
  CompanyRecord,
  CompanyWithContacts,
  CompanyFilters,
  UpdateCompanyInput,
} from '@/types/customer'

/** Escape special PostgREST filter characters to prevent filter injection. */
function sanitizeSearchInput(input: string): string {
  return input.replace(/[\\%_.,()]/g, '\\$&')
}

const selectCompanyWithContacts = `
  *,
  contacts:contacts(id, name, email)
`

// ============================================================================
// Pure DB Operations (accept Supabase client)
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
  supabase: SupabaseClient,
  data: InsertCompanyData
): Promise<CompanyRecord> {
  const { data: company, error } = await supabase
    .from('companies')
    .insert({
      project_id: data.projectId,
      name: data.name,
      domain: data.domain,
      arr: data.arr ?? null,
      stage: data.stage ?? 'prospect',
      product_used: data.productUsed ?? null,
      industry: data.industry ?? null,
      employee_count: data.employeeCount ?? null,
      plan_tier: data.planTier ?? null,
      renewal_date: data.renewalDate ?? null,
      health_score: data.healthScore ?? null,
      country: data.country ?? null,
      notes: data.notes ?? null,
      custom_fields: data.customFields ?? {},
      is_archived: false,
    })
    .select()
    .single()

  if (error || !company) {
    console.error('[supabase.companies.insertCompany] Failed', error)
    throw new Error(`Failed to insert company: ${error?.message ?? 'Unknown error'}`)
  }

  return company as CompanyRecord
}

export async function updateCompanyById(
  supabase: SupabaseClient,
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
  if (data.renewal_date !== undefined) updates.renewal_date = data.renewal_date
  if (data.health_score !== undefined) updates.health_score = data.health_score
  if (data.country !== undefined) updates.country = data.country
  if (data.notes !== undefined) updates.notes = data.notes
  if (data.custom_fields !== undefined) updates.custom_fields = data.custom_fields

  const { data: company, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', companyId)
    .select()
    .single()

  if (error || !company) {
    console.error('[supabase.companies.updateCompanyById] Failed', companyId, error)
    throw new Error(`Failed to update company: ${error?.message ?? 'Unknown error'}`)
  }

  return company as CompanyRecord
}

export async function deleteCompanyById(
  supabase: SupabaseClient,
  companyId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', companyId)

  if (error) {
    console.error('[supabase.companies.deleteCompanyById] Failed', companyId, error)
    throw new Error(`Failed to delete company: ${error.message}`)
  }

  return true
}

export async function updateCompanyArchiveStatus(
  supabase: SupabaseClient,
  companyId: string,
  isArchived: boolean
): Promise<CompanyRecord> {
  const { data, error } = await supabase
    .from('companies')
    .update({
      is_archived: isArchived,
    })
    .eq('id', companyId)
    .select()
    .single()

  if (error || !data) {
    console.error('[supabase.companies.updateCompanyArchiveStatus] Failed', companyId, error)
    throw new Error(`Failed to update company archive status: ${error?.message ?? 'Unknown error'}`)
  }

  return data as CompanyRecord
}

// ============================================================================
// Query Functions (use user-authenticated client, with caching)
// ============================================================================

export const listCompanies = cache(async (filters: CompanyFilters = {}): Promise<{ companies: CompanyWithContacts[], total: number }> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    // Build query
    let query = supabase
      .from('companies')
      .select(selectCompanyWithContacts, { count: 'exact' })
      .order('updated_at', { ascending: false })

    // Filter archived (hidden by default)
    if (!filters.showArchived) {
      query = query.eq('is_archived', false)
    }

    // Apply filters
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }
    if (filters.stage) {
      query = query.eq('stage', filters.stage)
    }
    if (filters.search) {
      const s = sanitizeSearchInput(filters.search)
      query = query.or(`name.ilike.%${s}%,domain.ilike.%${s}%`)
    }
    if (filters.industry) {
      query = query.ilike('industry', `%${sanitizeSearchInput(filters.industry)}%`)
    }
    if (filters.planTier) {
      query = query.ilike('plan_tier', `%${sanitizeSearchInput(filters.planTier)}%`)
    }
    if (filters.country) {
      query = query.ilike('country', `%${sanitizeSearchInput(filters.country)}%`)
    }

    // Pagination
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0
    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('[supabase.companies] failed to list companies', error)
      throw new Error('Unable to load companies.')
    }

    const companies = (data ?? []).map((c) => ({
      ...c,
      contact_count: Array.isArray(c.contacts) ? c.contacts.length : 0,
    })) as CompanyWithContacts[]

    return { companies, total: count ?? 0 }
  } catch (error) {
    console.error('[supabase.companies] unexpected error listing companies', error)
    throw error
  }
})

export const getCompanyById = cache(async (companyId: string): Promise<CompanyWithContacts | null> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select(selectCompanyWithContacts)
      .eq('id', companyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('[supabase.companies] failed to get company', companyId, error)
      throw new Error('Unable to load company.')
    }

    // Verify user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', company.project_id)
      .single()

    if (!project) {
      return null
    }

    return {
      ...company,
      contact_count: Array.isArray(company.contacts) ? company.contacts.length : 0,
    } as CompanyWithContacts
  } catch (error) {
    console.error('[supabase.companies] unexpected error getting company', companyId, error)
    throw error
  }
})
