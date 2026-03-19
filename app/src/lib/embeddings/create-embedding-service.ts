/**
 * Embedding Service Factory
 *
 * Creates resource-specific embedding services with shared upsert/delete/batch logic.
 * Each service operates on a specific embedding table (issue_embeddings, session_embeddings, etc.).
 *
 * Uses raw SQL via db.execute() because the factory is inherently dynamic
 * (operating on different tables/columns based on config). Table/column names
 * are from hardcoded config constants, while values use parameterized queries.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { generateEmbedding, formatEmbeddingForPgVector, computeTextHash } from './shared'

interface EmbeddingServiceConfig {
  table: 'issue_embeddings' | 'session_embeddings' | 'contact_embeddings'
  idColumn: 'issue_id' | 'session_id' | 'contact_id'
  logPrefix: string
}

export interface EmbeddingUpsertResult {
  updated: boolean
  error?: string
}

export interface EmbeddingRemoveResult {
  success: boolean
  error?: string
}

export interface EmbeddingBatchResult {
  embedded: number
  errors: string[]
}

export function createEmbeddingService(config: EmbeddingServiceConfig) {
  const { table, idColumn, logPrefix } = config

  // Build SQL identifiers once (safe: these come from hardcoded config, not user input)
  const tableIdent = sql.raw(table)
  const idColumnIdent = sql.raw(idColumn)

  async function upsert(
    resourceId: string,
    projectId: string,
    text: string
  ): Promise<EmbeddingUpsertResult> {
    const textHash = computeTextHash(text)

    try {
      // Check if embedding exists and is current
      const existing = await db.execute<{ text_hash: string }>(
        sql`SELECT text_hash FROM ${tableIdent} WHERE ${idColumnIdent} = ${resourceId} LIMIT 1`
      )

      if (existing.rows.length > 0 && existing.rows[0].text_hash === textHash) {
        return { updated: false }
      }

      const embedding = await generateEmbedding(text)
      const embeddingStr = formatEmbeddingForPgVector(embedding)

      await db.execute(
        sql`INSERT INTO ${tableIdent} (${idColumnIdent}, project_id, embedding, text_hash, updated_at)
            VALUES (${resourceId}, ${projectId}, ${embeddingStr}::vector, ${textHash}, NOW())
            ON CONFLICT (${idColumnIdent})
            DO UPDATE SET
              project_id = EXCLUDED.project_id,
              embedding = EXCLUDED.embedding,
              text_hash = EXCLUDED.text_hash,
              updated_at = NOW()`
      )

      console.log(`[${logPrefix}] Embedded ${idColumn.replace('_id', '')} ${resourceId}`)
      return { updated: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[${logPrefix}] Error:`, message)
      return { updated: false, error: message }
    }
  }

  async function remove(resourceId: string): Promise<EmbeddingRemoveResult> {
    try {
      await db.execute(
        sql`DELETE FROM ${tableIdent} WHERE ${idColumnIdent} = ${resourceId}`
      )

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[${logPrefix}] Delete failed:`, message)
      return { success: false, error: message }
    }
  }

  async function batch(
    items: Array<{ id: string; project_id: string; text: string }>
  ): Promise<EmbeddingBatchResult> {
    let embedded = 0
    const errors: string[] = []

    for (const item of items) {
      const result = await upsert(item.id, item.project_id, item.text)

      if (result.updated) {
        embedded++
      } else if (result.error) {
        errors.push(`${item.id}: ${result.error}`)
      }
    }

    return { embedded, errors }
  }

  return { upsert, remove, batch }
}
