/**
 * Issue Embedding Service
 *
 * Provides semantic similarity search for issue deduplication.
 * Uses OpenAI text-embedding-3-small model (1536 dimensions).
 */

import OpenAI from 'openai'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

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
 * Format embedding array as pgvector string
 */
function formatEmbeddingForPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Generate embedding for issue text (title + description)
 */
export async function generateIssueEmbedding(
  title: string,
  description: string
): Promise<number[]> {
  const text = `${title}\n\n${description}`.trim()

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  return response.data[0].embedding
}

/**
 * Upsert embedding for an issue
 * Only updates if the text has changed (based on MD5 hash)
 */
export async function upsertIssueEmbedding(
  issueId: string,
  projectId: string,
  title: string,
  description: string
): Promise<{ updated: boolean; error?: string }> {
  const supabase = createAdminClient()
  const text = `${title}\n\n${description}`
  const textHash = crypto.createHash('md5').update(text).digest('hex')

  try {
    // Check if embedding exists and is current
    const { data: existing } = await supabase
      .from('issue_embeddings')
      .select('text_hash')
      .eq('issue_id', issueId)
      .single()

    if (existing?.text_hash === textHash) {
      return { updated: false } // No change needed
    }

    // Generate new embedding
    const embedding = await generateIssueEmbedding(title, description)
    const embeddingStr = formatEmbeddingForPgVector(embedding)

    // Upsert the embedding
    const { error } = await supabase.from('issue_embeddings').upsert(
      {
        issue_id: issueId,
        project_id: projectId,
        embedding: embeddingStr,
        text_hash: textHash,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'issue_id',
      }
    )

    if (error) {
      console.error('[issue-embedding] Upsert failed:', error.message)
      return { updated: false, error: error.message }
    }

    console.log(`[issue-embedding] Embedded issue ${issueId}`)
    return { updated: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[issue-embedding] Error:', message)
    return { updated: false, error: message }
  }
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
    threshold = 0.5, // Lower threshold to catch more potential matches
    excludeIssueId,
    includeClosed = false,
  } = options

  const supabase = createAdminClient()

  // Generate query embedding
  const queryEmbedding = await generateIssueEmbedding(title, description)
  const embeddingStr = formatEmbeddingForPgVector(queryEmbedding)

  console.log(
    `[issue-embedding] Searching for similar issues in project ${projectId}`
  )
  console.log(
    `[issue-embedding] Options: type=${type ?? 'all'}, limit=${limit}, threshold=${threshold}, includeClosed=${includeClosed}`
  )

  // Call the search function
  const { data, error } = await supabase.rpc('search_similar_issues', {
    p_project_id: projectId,
    p_query_embedding: embeddingStr,
    p_issue_type: type ?? null,
    p_limit: limit,
    p_similarity_threshold: threshold,
    p_exclude_issue_id: excludeIssueId ?? null,
    p_include_closed: includeClosed,
  })

  if (error) {
    console.error('[issue-embedding] Search failed:', error.message)
    throw new Error(`Search failed: ${error.message}`)
  }

  console.log(`[issue-embedding] Found ${data?.length ?? 0} similar issues`)

  return (data ?? []).map(
    (row: {
      issue_id: string
      title: string
      description: string
      type: string
      status: string
      upvote_count: number
      similarity: number
    }) => ({
      issueId: row.issue_id,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      upvoteCount: row.upvote_count,
      similarity: row.similarity,
    })
  )
}

/**
 * Delete embedding for an issue (called when issue is deleted)
 */
export async function deleteIssueEmbedding(
  issueId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('issue_embeddings')
    .delete()
    .eq('issue_id', issueId)

  if (error) {
    console.error('[issue-embedding] Delete failed:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true }
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
  let embedded = 0
  const errors: string[] = []

  for (const issue of issues) {
    const result = await upsertIssueEmbedding(
      issue.id,
      issue.project_id,
      issue.title,
      issue.description
    )

    if (result.updated) {
      embedded++
    } else if (result.error) {
      errors.push(`${issue.id}: ${result.error}`)
    }
  }

  return { embedded, errors }
}
