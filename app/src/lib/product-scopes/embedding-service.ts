/**
 * Product Scope Embedding Service
 *
 * Provides text building, semantic search, and batch embedding for product scopes.
 * Uses the shared embedding utilities from @/lib/utils/embeddings.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { generateEmbedding, formatEmbeddingForPgVector, embeddingService } from '@/lib/utils/embeddings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemanticProductScopeResult {
  scopeId: string
  name: string
  description: string
  type: string
  similarity: number
}

export interface SearchProductScopesSemanticOptions {
  limit?: number
  threshold?: number
  type?: string
}

// ---------------------------------------------------------------------------
// Text builder
// ---------------------------------------------------------------------------

/**
 * Build embedding text from product scope fields.
 */
export function buildProductScopeEmbeddingText(scope: {
  name: string
  description?: string | null
  type?: string | null
  goals?: Array<{ id: string; text: string }> | null
  content?: string | null
}): string {
  const lines: string[] = [scope.name]

  if (scope.description) lines.push(scope.description)
  if (scope.type) lines.push(`Type: ${scope.type}`)
  if (scope.goals && scope.goals.length > 0) {
    lines.push(`Goals: ${scope.goals.map((g) => g.text).join(', ')}`)
  }
  if (scope.content) {
    lines.push(scope.content.slice(0, 2000))
  }

  return lines.join('\n\n')
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search for semantically similar product scopes using direct vector similarity.
 */
export async function searchProductScopesSemantic(
  projectId: string,
  query: string,
  options: SearchProductScopesSemanticOptions = {}
): Promise<SemanticProductScopeResult[]> {
  const { limit = 10, threshold = 0.5, type } = options

  const queryEmbedding = await generateEmbedding(query)
  const embeddingStr = formatEmbeddingForPgVector(queryEmbedding)

  const results = await db.execute<{
    scope_id: string
    name: string
    description: string
    type: string
    similarity: number
  }>(sql`
    SELECT
      ps.id AS scope_id,
      ps.name,
      ps.description,
      ps.type,
      1 - (e.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM embeddings e
    JOIN product_scopes ps ON ps.id = e.entity_id
    WHERE e.entity_type = 'product_scope'
      AND e.project_id = ${projectId}
      AND 1 - (e.embedding <=> ${embeddingStr}::vector) >= ${threshold}
      ${type ? sql`AND ps.type = ${type}` : sql``}
    ORDER BY e.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `)

  return results.rows.map((row) => ({
    scopeId: row.scope_id,
    name: row.name,
    description: row.description,
    type: row.type,
    similarity: row.similarity,
  }))
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

/**
 * Batch embed multiple product scopes (for backfill)
 */
export async function batchEmbedProductScopes(
  scopes: Array<{
    id: string
    project_id: string
    name: string
    description?: string | null
    type?: string | null
    goals?: Array<{ id: string; text: string }> | null
    content?: string | null
  }>
): Promise<{ embedded: number; errors: string[] }> {
  return embeddingService.batch(
    scopes.map((s) => ({
      id: s.id,
      entityType: 'product_scope' as const,
      project_id: s.project_id,
      text: buildProductScopeEmbeddingText(s),
    }))
  )
}
