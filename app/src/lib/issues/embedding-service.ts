/**
 * Issue Embedding Service
 *
 * Provides text building, semantic search, and batch embedding for issues.
 * Uses the shared embedding utilities from @/lib/utils/embeddings.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { generateEmbedding, formatEmbeddingForPgVector, embeddingService } from '@/lib/utils/embeddings'

export interface SimilarIssue {
  issueId: string
  title: string
  description: string
  type: string
  status: string
  upvoteCount: number
  similarity: number
}

export interface SearchSimilarIssuesOptions {
  type?: string
  limit?: number
  threshold?: number
  excludeIssueId?: string
  includeClosed?: boolean
}

/**
 * Build embedding text for an issue
 */
export function buildIssueEmbeddingText(title: string, description: string): string {
  return `${title}\n\n${description}`
}

/**
 * Search for semantically similar issues using direct vector similarity on the unified embeddings table.
 */
export async function searchSimilarIssues(
  projectId: string,
  title: string,
  description: string,
  options: SearchSimilarIssuesOptions = {}
): Promise<SimilarIssue[]> {
  const {
    type,
    limit = 5,
    threshold = 0.5,
    excludeIssueId,
    includeClosed = false,
  } = options

  const queryEmbedding = await generateEmbedding(buildIssueEmbeddingText(title, description))
  const embeddingStr = formatEmbeddingForPgVector(queryEmbedding)

  const results = await db.execute<{
    issue_id: string
    title: string
    description: string
    type: string
    status: string
    upvote_count: number
    similarity: number
  }>(sql`
    SELECT
      i.id AS issue_id,
      i.title,
      i.description,
      i.type,
      i.status,
      i.upvote_count,
      1 - (e.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM embeddings e
    JOIN issues i ON i.id = e.entity_id
    WHERE e.entity_type = 'issue'
      AND e.project_id = ${projectId}
      AND 1 - (e.embedding <=> ${embeddingStr}::vector) >= ${threshold}
      ${excludeIssueId ? sql`AND i.id != ${excludeIssueId}` : sql``}
      ${type ? sql`AND i.type = ${type}` : sql``}
      ${!includeClosed ? sql`AND i.status != 'closed'` : sql``}
    ORDER BY e.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `)

  return results.rows.map((row) => ({
    issueId: row.issue_id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    upvoteCount: row.upvote_count,
    similarity: row.similarity,
  }))
}

/**
 * Batch embed multiple issues (for backfill)
 */
export async function batchEmbedIssues(
  issues: Array<{
    id: string
    project_id: string
    title: string
    description: string
  }>
): Promise<{ embedded: number; errors: string[] }> {
  return embeddingService.batch(
    issues.map((issue) => ({
      id: issue.id,
      entityType: 'issue' as const,
      project_id: issue.project_id,
      text: buildIssueEmbeddingText(issue.title, issue.description),
    }))
  )
}
