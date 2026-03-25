/**
 * Session Embedding Service
 *
 * Provides text building, semantic search, and batch embedding for sessions.
 * Uses the shared embedding utilities from @/lib/utils/embeddings.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { generateEmbedding, formatEmbeddingForPgVector, embeddingService } from '@/lib/utils/embeddings'

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
 * Build embedding text for a session
 */
export function buildSessionEmbeddingText(name: string, description: string): string {
  return `${name}\n\n${description}`
}

/**
 * Search for semantically similar sessions using direct vector similarity on the unified embeddings table.
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
    SELECT
      s.id AS session_id,
      s.name,
      s.description,
      1 - (e.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM embeddings e
    JOIN sessions s ON s.id = e.entity_id
    WHERE e.entity_type = 'session'
      AND e.project_id = ${projectId}
      AND 1 - (e.embedding <=> ${embeddingStr}::vector) >= ${threshold}
      AND s.is_archived = ${isArchived}
      ${status ? sql`AND s.status = ${status}` : sql``}
      ${source ? sql`AND s.source = ${source}` : sql``}
    ORDER BY e.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
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
  return embeddingService.batch(
    sessions.map((s) => ({
      id: s.id,
      entityType: 'session' as const,
      project_id: s.project_id,
      text: buildSessionEmbeddingText(s.name, s.description),
    }))
  )
}
