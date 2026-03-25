/**
 * Shared Embedding Utilities
 *
 * Provides the core embedding infrastructure used by all resource types.
 * - OpenAI client singleton for vector generation
 * - Unified `embeddingService` for upsert/remove/batch on the `embeddings` table
 * - `fireEmbedding()` fire-and-forget wrapper used by all service layers
 *
 * Knowledge embeddings use their own chunked table but still import
 * generateEmbedding/generateEmbeddings from here.
 */

import OpenAI from 'openai'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// OpenAI client singleton
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 100

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityType = 'issue' | 'session' | 'contact' | 'company' | 'product_scope'

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

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

/**
 * Format embedding array as pgvector string
 */
export function formatEmbeddingForPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Generate embedding for a single text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
    dimensions: EMBEDDING_DIMENSIONS,
  })

  return response.data[0].embedding
}

/**
 * Generate embeddings for an array of texts.
 * Handles batching internally to respect API limits.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    for (const item of response.data) {
      embeddings.push(item.embedding)
    }
  }

  return embeddings
}

/**
 * Compute MD5 hash of text for change detection
 */
export function computeTextHash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex')
}

// ---------------------------------------------------------------------------
// Embedding service - operates on the unified `embeddings` table
// ---------------------------------------------------------------------------

async function upsert(
  entityId: string,
  entityType: EntityType,
  projectId: string,
  text: string
): Promise<EmbeddingUpsertResult> {
  const textHash = computeTextHash(text)

  try {
    // Check if embedding exists and is current
    const existing = await db.execute<{ text_hash: string }>(
      sql`SELECT text_hash FROM embeddings WHERE entity_id = ${entityId} LIMIT 1`
    )

    if (existing.rows.length > 0 && existing.rows[0].text_hash === textHash) {
      return { updated: false }
    }

    const embedding = await generateEmbedding(text)
    const embeddingStr = formatEmbeddingForPgVector(embedding)

    await db.execute(
      sql`INSERT INTO embeddings (entity_id, entity_type, project_id, embedding, text_hash, updated_at)
          VALUES (${entityId}, ${entityType}, ${projectId}, ${embeddingStr}::vector, ${textHash}, NOW())
          ON CONFLICT (entity_id)
          DO UPDATE SET
            entity_type = EXCLUDED.entity_type,
            project_id = EXCLUDED.project_id,
            embedding = EXCLUDED.embedding,
            text_hash = EXCLUDED.text_hash,
            updated_at = NOW()`
    )

    console.log(`[embedding] Embedded ${entityType} ${entityId}`)
    return { updated: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[embedding] Error embedding ${entityType} ${entityId}:`, message)
    return { updated: false, error: message }
  }
}

async function remove(entityId: string): Promise<EmbeddingRemoveResult> {
  try {
    await db.execute(
      sql`DELETE FROM embeddings WHERE entity_id = ${entityId}`
    )
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[embedding] Delete failed for ${entityId}:`, message)
    return { success: false, error: message }
  }
}

async function batch(
  items: Array<{ id: string; entityType: EntityType; project_id: string; text: string }>
): Promise<EmbeddingBatchResult> {
  let embedded = 0
  const errors: string[] = []

  for (const item of items) {
    const result = await upsert(item.id, item.entityType, item.project_id, item.text)

    if (result.updated) {
      embedded++
    } else if (result.error) {
      errors.push(`${item.id}: ${result.error}`)
    }
  }

  return { embedded, errors }
}

export const embeddingService = { upsert, remove, batch }

// ---------------------------------------------------------------------------
// Fire-and-forget wrapper - used by all service layers
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget embedding upsert. Logs on failure, never throws.
 */
export function fireEmbedding(
  entityId: string,
  entityType: EntityType,
  projectId: string,
  text: string
): void {
  void embeddingService.upsert(entityId, entityType, projectId, text)
    .catch((err) => console.warn(`[embedding] ${entityType} ${entityId} failed:`, err))
}
