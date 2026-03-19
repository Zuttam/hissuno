/**
 * Issue Embedding Service
 *
 * Provides semantic similarity search for issue deduplication.
 * Uses shared embedding utilities and factory for upsert/delete/batch.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { generateEmbedding, formatEmbeddingForPgVector } from '@/lib/embeddings/shared'
import { createEmbeddingService } from '@/lib/embeddings/create-embedding-service'

const service = createEmbeddingService({
  table: 'issue_embeddings',
  idColumn: 'issue_id',
  logPrefix: 'issue-embedding',
})

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
 * Generate embedding for issue text (title + description)
 */
export async function generateIssueEmbedding(
  title: string,
  description: string
): Promise<number[]> {
  return generateEmbedding(`${title}\n\n${description}`)
}

/**
 * Upsert embedding for an issue.
 * Only updates if the text has changed (based on MD5 hash).
 */
export async function upsertIssueEmbedding(
  issueId: string,
  projectId: string,
  title: string,
  description: string
): Promise<{ updated: boolean; error?: string }> {
  return service.upsert(issueId, projectId, `${title}\n\n${description}`)
}

/**
 * Search for semantically similar issues
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

  const queryEmbedding = await generateIssueEmbedding(title, description)
  const embeddingStr = formatEmbeddingForPgVector(queryEmbedding)

  console.log(
    `[issue-embedding] Searching for similar issues in project ${projectId}`
  )
  console.log(
    `[issue-embedding] Options: type=${type ?? 'all'}, limit=${limit}, threshold=${threshold}, includeClosed=${includeClosed}`
  )

  const results = await db.execute<{
    issue_id: string
    title: string
    description: string
    type: string
    status: string
    upvote_count: number
    similarity: number
  }>(sql`
    SELECT * FROM search_similar_issues(
      ${projectId},
      ${embeddingStr}::vector,
      ${type ?? null},
      ${limit},
      ${threshold},
      ${excludeIssueId ?? null},
      ${includeClosed}
    )
  `)

  console.log(`[issue-embedding] Found ${results.rows.length} similar issues`)

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
 * Delete embedding for an issue (called when issue is deleted)
 */
export async function deleteIssueEmbedding(
  issueId: string
): Promise<{ success: boolean; error?: string }> {
  return service.remove(issueId)
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
  return service.batch(
    issues.map((issue) => ({
      id: issue.id,
      project_id: issue.project_id,
      text: `${issue.title}\n\n${issue.description}`,
    }))
  )
}
