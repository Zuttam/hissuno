/**
 * Contact Embedding Service
 *
 * Provides semantic similarity search for contacts.
 * Uses shared embedding utilities and factory for upsert/batch.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { generateEmbedding, formatEmbeddingForPgVector } from '@/lib/embeddings/shared'
import { createEmbeddingService } from '@/lib/embeddings/create-embedding-service'

const service = createEmbeddingService({
  table: 'contact_embeddings',
  idColumn: 'contact_id',
  logPrefix: 'contact-embedding',
})

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
 * Upsert embedding for a contact.
 * Only updates if the text has changed (based on MD5 hash).
 */
export async function upsertContactEmbedding(
  contactId: string,
  projectId: string,
  text: string
): Promise<{ updated: boolean; error?: string }> {
  return service.upsert(contactId, projectId, text)
}

/**
 * Search for semantically similar contacts
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
    SELECT * FROM search_contacts_semantic(
      ${projectId},
      ${embeddingStr}::vector,
      ${limit},
      ${threshold},
      ${isArchived}
    )
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
  return service.batch(
    contacts.map((c) => ({
      id: c.id,
      project_id: c.project_id,
      text: buildContactEmbeddingText(c),
    }))
  )
}
