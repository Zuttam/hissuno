/**
 * Session Embedding Service
 *
 * Provides semantic similarity search for feedback sessions.
 * Uses shared embedding utilities and factory for upsert/batch.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { generateEmbedding, formatEmbeddingForPgVector } from '@/lib/embeddings/shared'
import { createEmbeddingService } from '@/lib/embeddings/create-embedding-service'

const service = createEmbeddingService({
  table: 'session_embeddings',
  idColumn: 'session_id',
  logPrefix: 'session-embedding',
})

export interface SemanticSessionResult {
  sessionId: string
  name: string
  description: string
  similarity: number
}

export interface SearchSessionsSemanticOptions {
  limit?: number
  threshold?: number
  status?: string
  source?: string
  isArchived?: boolean
}

/**
 * Generate embedding for session text (name + description)
 */
export async function generateSessionEmbedding(
  name: string,
  description: string
): Promise<number[]> {
  return generateEmbedding(`${name}\n\n${description}`)
}

/**
 * Upsert embedding for a session.
 * Only updates if the text has changed (based on MD5 hash).
 */
export async function upsertSessionEmbedding(
  sessionId: string,
  projectId: string,
  name: string,
  description: string
): Promise<{ updated: boolean; error?: string }> {
  return service.upsert(sessionId, projectId, `${name}\n\n${description}`)
}

/**
 * Search for semantically similar sessions
 */
export async function searchSessionsSemantic(
  projectId: string,
  query: string,
  options: SearchSessionsSemanticOptions = {}
): Promise<SemanticSessionResult[]> {
  const {
    limit = 10,
    threshold = 0.5,
    status,
    source,
    isArchived = false,
  } = options

  const queryEmbedding = await generateEmbedding(query)
  const embeddingStr = formatEmbeddingForPgVector(queryEmbedding)

  const results = await db.execute<{
    session_id: string
    name: string
    description: string
    similarity: number
  }>(sql`
    SELECT * FROM search_sessions_semantic(
      ${projectId},
      ${embeddingStr}::vector,
      ${limit},
      ${threshold},
      ${status ?? null},
      ${source ?? null},
      ${isArchived}
    )
  `)

  return results.rows.map((row) => ({
    sessionId: row.session_id,
    name: row.name,
    description: row.description,
    similarity: row.similarity,
  }))
}

/**
 * Batch embed multiple sessions (for backfill)
 */
export async function batchEmbedSessions(
  sessions: Array<{
    id: string
    project_id: string
    name: string
    description: string
  }>
): Promise<{ embedded: number; errors: string[] }> {
  return service.batch(
    sessions.map((s) => ({
      id: s.id,
      project_id: s.project_id,
      text: `${s.name}\n\n${s.description}`,
    }))
  )
}
