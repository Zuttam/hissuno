/**
 * Customer Embedding Service
 *
 * Provides text building, semantic search, and batch embedding for
 * both contacts and companies. Uses the unified embeddings table.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { generateEmbedding, formatEmbeddingForPgVector, embeddingService } from '@/lib/utils/embeddings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemanticContactResult {
  contactId: string
  name: string
  email: string
  role: string | null
  similarity: number
}

export interface SearchContactsSemanticOptions {
  limit?: number
  threshold?: number
  isArchived?: boolean
}

// ---------------------------------------------------------------------------
// Text builders
// ---------------------------------------------------------------------------

/**
 * Build embedding text from contact fields.
 * Only includes non-null fields.
 */
export function buildContactEmbeddingText(contact: {
  name: string
  email: string
  role?: string | null
  title?: string | null
  companyName?: string | null
  notes?: string | null
}): string {
  const lines: string[] = [contact.name, contact.email]

  if (contact.role) lines.push(`Role: ${contact.role}`)
  if (contact.title) lines.push(`Title: ${contact.title}`)
  if (contact.companyName) lines.push(`Company: ${contact.companyName}`)
  if (contact.notes) lines.push(`Notes: ${contact.notes}`)

  return lines.join('\n')
}

/**
 * Build embedding text from company fields.
 * Only includes non-null fields.
 */
export function buildCompanyEmbeddingText(company: {
  name: string
  domain: string
  industry?: string | null
  country?: string | null
  stage?: string | null
  plan_tier?: string | null
  product_used?: string | null
  notes?: string | null
}): string {
  const lines: string[] = [company.name, company.domain]

  if (company.industry) lines.push(`Industry: ${company.industry}`)
  if (company.country) lines.push(`Country: ${company.country}`)
  if (company.stage) lines.push(`Stage: ${company.stage}`)
  if (company.plan_tier) lines.push(`Plan: ${company.plan_tier}`)
  if (company.product_used) lines.push(`Product: ${company.product_used}`)
  if (company.notes) lines.push(`Notes: ${company.notes}`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search for semantically similar contacts using direct vector similarity.
 */
export async function searchContactsSemantic(
  projectId: string,
  query: string,
  options: SearchContactsSemanticOptions = {}
): Promise<SemanticContactResult[]> {
  const {
    limit = 10,
    threshold = 0.5,
    isArchived = false,
  } = options

  const queryEmbedding = await generateEmbedding(query)
  const embeddingStr = formatEmbeddingForPgVector(queryEmbedding)

  const results = await db.execute<{
    contact_id: string
    name: string
    email: string
    role: string | null
    similarity: number
  }>(sql`
    SELECT
      c.id AS contact_id,
      c.name,
      c.email,
      c.role,
      1 - (e.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM embeddings e
    JOIN contacts c ON c.id = e.entity_id
    WHERE e.entity_type = 'contact'
      AND e.project_id = ${projectId}
      AND 1 - (e.embedding <=> ${embeddingStr}::vector) >= ${threshold}
      AND c.is_archived = ${isArchived}
    ORDER BY e.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `)

  return results.rows.map((row) => ({
    contactId: row.contact_id,
    name: row.name,
    email: row.email,
    role: row.role,
    similarity: row.similarity,
  }))
}

/**
 * Search for semantically similar companies using direct vector similarity.
 */
export async function searchCompaniesSemantic(
  projectId: string,
  query: string,
  options: { limit?: number; threshold?: number; isArchived?: boolean } = {}
): Promise<Array<{ companyId: string; name: string; domain: string; similarity: number }>> {
  const { limit = 10, threshold = 0.5, isArchived = false } = options

  const queryEmbedding = await generateEmbedding(query)
  const embeddingStr = formatEmbeddingForPgVector(queryEmbedding)

  const results = await db.execute<{
    company_id: string
    name: string
    domain: string
    similarity: number
  }>(sql`
    SELECT
      co.id AS company_id,
      co.name,
      co.domain,
      1 - (e.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM embeddings e
    JOIN companies co ON co.id = e.entity_id
    WHERE e.entity_type = 'company'
      AND e.project_id = ${projectId}
      AND 1 - (e.embedding <=> ${embeddingStr}::vector) >= ${threshold}
      AND co.is_archived = ${isArchived}
    ORDER BY e.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `)

  return results.rows.map((row) => ({
    companyId: row.company_id,
    name: row.name,
    domain: row.domain,
    similarity: row.similarity,
  }))
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

/**
 * Batch embed multiple contacts (for backfill)
 */
export async function batchEmbedContacts(
  contacts: Array<{
    id: string
    project_id: string
    name: string
    email: string
    role?: string | null
    title?: string | null
    companyName?: string | null
    notes?: string | null
  }>
): Promise<{ embedded: number; errors: string[] }> {
  return embeddingService.batch(
    contacts.map((c) => ({
      id: c.id,
      entityType: 'contact' as const,
      project_id: c.project_id,
      text: buildContactEmbeddingText(c),
    }))
  )
}

/**
 * Batch embed multiple companies (for backfill)
 */
export async function batchEmbedCompanies(
  companies: Array<{
    id: string
    project_id: string
    name: string
    domain: string
    industry?: string | null
    country?: string | null
    stage?: string | null
    plan_tier?: string | null
    product_used?: string | null
    notes?: string | null
  }>
): Promise<{ embedded: number; errors: string[] }> {
  return embeddingService.batch(
    companies.map((c) => ({
      id: c.id,
      entityType: 'company' as const,
      project_id: c.project_id,
      text: buildCompanyEmbeddingText(c),
    }))
  )
}
