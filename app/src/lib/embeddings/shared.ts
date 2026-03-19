/**
 * Shared embedding utilities
 *
 * OpenAI client singleton, constants, and helpers used by all embedding services.
 */

import OpenAI from 'openai'
import crypto from 'crypto'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 100

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
