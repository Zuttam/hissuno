/**
 * Customers Service Layer
 *
 * This is the single source of truth for all company and contact
 * create/upsert operations. It orchestrates database operations,
 * merge strategies, and embedding updates.
 *
 * Use this service instead of calling lib/db/queries/companies.ts or
 * lib/db/queries/contacts.ts directly for any create/upsert operations.
 *
 * Architecture:
 * - API Routes -> customers-service.ts -> db/queries/{companies,contacts}.ts + embedding-service
 * - Integrations -> customers-service.ts (upsert with merge strategy)
 * - Resource Adapters -> customers-service.ts (direct creation)
 */

import { eq, and, ilike, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema/app'
import { fireGraphEval } from '@/lib/utils/graph-eval'
import { searchByMode, type SearchMode } from '@/lib/search/search-by-mode'
import {
  insertCompany,
  updateCompanyById,
  type InsertCompanyData,
} from '@/lib/db/queries/companies'
import {
  insertContact,
  updateContactById,
  type InsertContactData,
} from '@/lib/db/queries/contacts'
import type {
  CompanyRecord,
  ContactRecord,
  UpdateCompanyInput,
  UpdateContactInput,
} from '@/types/customer'

// ============================================================================
// Types
// ============================================================================

export type MergeStrategy = 'fill_nulls' | 'overwrite' | 'never_overwrite'

export interface UpsertCompanyAdminInput {
  projectId: string
  domain: string
  name?: string
  industry?: string | null
  country?: string | null
  employeeCount?: number | null
  notes?: string | null
  customFields?: Record<string, unknown>
  mergeStrategy?: MergeStrategy
}

export interface UpsertContactAdminInput {
  projectId: string
  email: string
  name?: string
  phone?: string | null
  title?: string | null
  companyId?: string | null
  customFields?: Record<string, unknown>
  mergeStrategy?: MergeStrategy
}

export interface UpsertResult<T> {
  record: T
  action: 'created' | 'updated' | 'skipped'
}

// ============================================================================
// Merge Strategy
// ============================================================================

/**
 * Apply merge strategy when updating an existing record.
 * Returns only the fields that should be updated based on the strategy.
 *
 * - `fill_nulls`: only set fields that are currently null/undefined in existing
 * - `overwrite`: set all non-undefined incoming fields
 * - `never_overwrite`: return empty object (no updates)
 */
export function applyMergeStrategy(
  strategy: MergeStrategy,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  if (strategy === 'never_overwrite') {
    return {}
  }

  if (strategy === 'overwrite') {
    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(incoming)) {
      if (value !== undefined) {
        updates[key] = value
      }
    }
    return updates
  }

  // fill_nulls: only set fields that are currently null/undefined
  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined && value !== null && (existing[key] === null || existing[key] === undefined)) {
      updates[key] = value
    }
  }
  return updates
}

// ============================================================================
// Helpers
// ============================================================================

function fireContactEmbedding(
  contactId: string,
  projectId: string,
  fields: { name: string; email: string; role?: string | null; title?: string | null; companyId?: string | null; notes?: string | null }
): void {
  void (async () => {
    try {
      const { fireEmbedding } = await import('@/lib/utils/embeddings')
      const { buildContactEmbeddingText } = await import('@/lib/customers/customer-embedding-service')
      let companyName: string | null = null
      if (fields.companyId) {
        const companyRow = await db.query.companies.findFirst({
          where: eq(companies.id, fields.companyId),
          columns: { name: true },
        })
        companyName = companyRow?.name ?? null
      }
      const text = buildContactEmbeddingText({
        name: fields.name,
        email: fields.email,
        role: fields.role ?? null,
        title: fields.title ?? null,
        companyName,
        notes: fields.notes ?? null,
      })
      fireEmbedding(contactId, 'contact', projectId, text)
    } catch (err) {
      console.warn('[customers-service] Contact embedding failed', contactId, err)
    }
  })()
}

function fireCompanyEmbedding(
  companyId: string,
  projectId: string,
  fields: { name: string; domain: string; industry?: string | null; country?: string | null; stage?: string | null; plan_tier?: string | null; product_used?: string | null; notes?: string | null }
): void {
  void (async () => {
    try {
      const { fireEmbedding } = await import('@/lib/utils/embeddings')
      const { buildCompanyEmbeddingText } = await import('@/lib/customers/customer-embedding-service')
      fireEmbedding(companyId, 'company', projectId, buildCompanyEmbeddingText(fields))
    } catch (err) {
      console.warn('[customers-service] Company embedding failed', companyId, err)
    }
  })()
}

// ============================================================================
// Admin Operations (no auth required - for integrations, sync, workflows)
// ============================================================================

/**
 * Upserts a company by domain. Uses admin client (no user auth required).
 * Applies merge strategy when updating existing records.
 */
export async function upsertCompanyAdmin(
  input: UpsertCompanyAdminInput
): Promise<UpsertResult<CompanyRecord>> {
  const { projectId, domain, mergeStrategy = 'fill_nulls' } = input

  // Look up existing company by domain within this project
  const existing = await db.query.companies.findFirst({
    where: and(eq(companies.project_id, projectId), eq(companies.domain, domain)),
  })

  if (existing) {
    // Never overwrite - skip entirely
    if (mergeStrategy === 'never_overwrite') {
      return { record: existing as unknown as CompanyRecord, action: 'skipped' }
    }

    // Build incoming fields for merge
    const incoming: Record<string, unknown> = {}
    if (input.name !== undefined) incoming.name = input.name
    if (input.industry !== undefined) incoming.industry = input.industry
    if (input.country !== undefined) incoming.country = input.country
    if (input.employeeCount !== undefined) incoming.employee_count = input.employeeCount
    if (input.notes !== undefined) incoming.notes = input.notes
    if (input.customFields !== undefined) incoming.custom_fields = input.customFields

    const merged = applyMergeStrategy(
      mergeStrategy,
      existing as unknown as Record<string, unknown>,
      incoming
    ) as UpdateCompanyInput

    // Nothing to update after merge
    if (Object.keys(merged).length === 0) {
      return { record: existing as unknown as CompanyRecord, action: 'skipped' }
    }

    const record = await updateCompanyById(existing.id, merged)
    fireCompanyEmbedding(record.id, projectId, record)
    fireGraphEval(projectId, 'company', record.id)
    return { record, action: 'updated' }
  }

  // New company
  const insertData: InsertCompanyData = {
    projectId,
    name: input.name || domain,
    domain,
    industry: input.industry ?? null,
    country: input.country ?? null,
    employeeCount: input.employeeCount ?? null,
    notes: input.notes ?? null,
    customFields: input.customFields,
  }

  const record = await insertCompany(insertData)
  fireCompanyEmbedding(record.id, projectId, record)
  fireGraphEval(projectId, 'company', record.id)
  return { record, action: 'created' }
}

/**
 * Upserts a contact by email. Uses admin client (no user auth required).
 * Applies merge strategy when updating existing records.
 */
export async function upsertContactAdmin(
  input: UpsertContactAdminInput
): Promise<UpsertResult<ContactRecord>> {
  const { projectId, email, mergeStrategy = 'fill_nulls' } = input

  // Look up existing contact by email within this project
  const existing = await db.query.contacts.findFirst({
    where: and(eq(contacts.project_id, projectId), eq(contacts.email, email)),
  })

  if (existing) {
    // Never overwrite - skip entirely
    if (mergeStrategy === 'never_overwrite') {
      return { record: existing as unknown as ContactRecord, action: 'skipped' }
    }

    // Build incoming fields for merge
    const incoming: Record<string, unknown> = {}
    if (input.name !== undefined) incoming.name = input.name
    if (input.phone !== undefined) incoming.phone = input.phone
    if (input.title !== undefined) incoming.title = input.title
    if (input.companyId !== undefined) incoming.company_id = input.companyId
    if (input.customFields !== undefined) incoming.custom_fields = input.customFields

    const merged = applyMergeStrategy(
      mergeStrategy,
      existing as unknown as Record<string, unknown>,
      incoming
    ) as UpdateContactInput

    // Nothing to update after merge
    if (Object.keys(merged).length === 0) {
      return { record: existing as unknown as ContactRecord, action: 'skipped' }
    }

    const record = await updateContactById(existing.id, merged)

    // Re-embed if any embedded fields changed (fire-and-forget)
    const embeddedFieldChanged =
      merged.name !== undefined ||
      merged.email !== undefined ||
      merged.role !== undefined ||
      merged.title !== undefined ||
      merged.notes !== undefined ||
      merged.company_id !== undefined

    if (embeddedFieldChanged) {
      fireContactEmbedding(record.id, record.project_id, {
        name: record.name,
        email: record.email,
        role: record.role,
        title: record.title,
        companyId: record.company_id,
        notes: record.notes,
      })
    }

    fireGraphEval(projectId, 'contact', record.id)
    return { record, action: 'updated' }
  }

  // New contact
  const name = input.name || email
  const insertData: InsertContactData = {
    projectId,
    name,
    email,
    phone: input.phone ?? null,
    title: input.title ?? null,
    companyId: input.companyId ?? null,
    customFields: input.customFields,
  }

  const contact = await insertContact(insertData)

  // Fire-and-forget contact embedding
  fireContactEmbedding(contact.id, projectId, {
    name,
    email,
    title: input.title ?? null,
    companyId: input.companyId ?? null,
    notes: null,
  })

  fireGraphEval(projectId, 'contact', contact.id)
  return { record: contact, action: 'created' }
}

/**
 * Creates a company directly. Uses admin client (no user auth required).
 * For resource adapters and simple creation flows.
 */
export async function createCompanyAdmin(input: InsertCompanyData): Promise<CompanyRecord> {
  const record = await insertCompany(input)
  fireCompanyEmbedding(record.id, input.projectId, record)
  fireGraphEval(input.projectId, 'company', record.id)
  return record
}

/**
 * Creates a contact directly. Uses admin client (no user auth required).
 * For resource adapters and simple creation flows.
 */
export async function createContactAdmin(input: InsertContactData): Promise<ContactRecord> {
  const record = await insertContact(input)
  fireContactEmbedding(record.id, input.projectId, {
    name: input.name,
    email: input.email,
    role: input.role ?? null,
    title: input.title ?? null,
    companyId: input.companyId ?? null,
    notes: input.notes ?? null,
  })
  fireGraphEval(input.projectId, 'contact', record.id)
  return record
}

// ============================================================================
// Aliases — auth is handled at the route level, not in the service layer
// ============================================================================

export const createCompany = createCompanyAdmin
export const createContact = createContactAdmin

// ============================================================================
// Search Operations
// ============================================================================

export interface SearchResult {
  id: string
  name: string
  snippet: string
  score?: number
  subtype?: 'contact' | 'company'
}


/**
 * Searches contacts using semantic search with ILIKE fallback.
 */
export async function searchContacts(
  projectId: string,
  query: string,
  limit: number = 10,
  options?: { mode?: SearchMode; threshold?: number }
): Promise<SearchResult[]> {
  return searchByMode<SearchResult>({
    logPrefix: '[customers-service:contacts]',
    mode: options?.mode,
    semanticSearch: async () => {
      const { searchContactsSemantic } = await import(
        '@/lib/customers/customer-embedding-service'
      )
      const semanticResults = await searchContactsSemantic(projectId, query, {
        limit,
        threshold: options?.threshold ?? 0.5,
        isArchived: false,
      })
      return semanticResults.map((r) => ({
        id: r.contactId,
        name: r.name,
        snippet: [r.email, r.role].filter(Boolean).join(' | '),
        score: r.similarity,
        subtype: 'contact' as const,
      }))
    },
    keywordSearch: async () => {
      const s = `%${query}%`
      const data = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          role: contacts.role,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.project_id, projectId),
            eq(contacts.is_archived, false),
            or(
              ilike(contacts.name, s),
              ilike(contacts.email, s)
            )
          )
        )
        .limit(limit)

      return data.map((c) => ({
        id: c.id,
        name: c.name,
        snippet: [c.email, c.role].filter(Boolean).join(' | '),
        subtype: 'contact' as const,
      }))
    },
  })
}

/**
 * Searches companies using semantic search with ILIKE fallback.
 */
export async function searchCompanies(
  projectId: string,
  query: string,
  limit: number = 10,
  options?: { mode?: SearchMode; threshold?: number }
): Promise<SearchResult[]> {
  return searchByMode<SearchResult>({
    logPrefix: '[customers-service:companies]',
    mode: options?.mode,
    semanticSearch: async () => {
      const { searchCompaniesSemantic } = await import(
        '@/lib/customers/customer-embedding-service'
      )
      const results = await searchCompaniesSemantic(projectId, query, {
        limit,
        threshold: options?.threshold ?? 0.5,
        isArchived: false,
      })
      return results.map((r) => ({
        id: r.companyId,
        name: r.name,
        snippet: r.domain,
        score: r.similarity,
        subtype: 'company' as const,
      }))
    },
    keywordSearch: async () => {
      const s = `%${query}%`
      const data = await db
        .select({
          id: companies.id,
          name: companies.name,
          domain: companies.domain,
        })
        .from(companies)
        .where(
          and(
            eq(companies.project_id, projectId),
            eq(companies.is_archived, false),
            or(
              ilike(companies.name, s),
              ilike(companies.domain, s)
            )
          )
        )
        .limit(limit)

      return data.map((c) => ({
        id: c.id,
        name: c.name,
        snippet: c.domain,
        subtype: 'company' as const,
      }))
    },
  })
}

/**
 * Searches both contacts and companies in parallel, merges by score.
 */
export async function searchCustomers(
  projectId: string,
  query: string,
  limit: number = 10,
  options?: { mode?: SearchMode; threshold?: number }
): Promise<SearchResult[]> {
  const [contactResults, companyResults] = await Promise.allSettled([
    searchContacts(projectId, query, limit, options),
    searchCompanies(projectId, query, limit, options),
  ])

  const results: SearchResult[] = []
  if (contactResults.status === 'fulfilled') results.push(...contactResults.value)
  if (companyResults.status === 'fulfilled') results.push(...companyResults.value)

  results.sort((a, b) => {
    if (a.score != null && b.score != null) return b.score - a.score
    if (a.score != null) return -1
    if (b.score != null) return 1
    return 0
  })

  return results.slice(0, limit)
}
