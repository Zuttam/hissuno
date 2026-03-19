/**
 * Embedding service for knowledge sources
 *
 * Uses shared embedding utilities for vector generation.
 * Knowledge sources use chunking and batch insert (not the factory pattern).
 */

import { db } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'
import { knowledgeEmbeddings } from '@/lib/db/schema/app'
import {
  generateEmbedding,
  generateEmbeddings,
  formatEmbeddingForPgVector,
} from '@/lib/embeddings/shared'
import { chunkKnowledgeContent } from './chunking'

export interface EmbeddingResult {
  success: boolean
  chunksEmbedded: number
  errors: string[]
}

/**
 * Generate embedding for a search query
 */
export async function embedQuery(query: string): Promise<number[]> {
  return generateEmbedding(query)
}

/**
 * Embed a single knowledge source's analyzed content
 */
export async function embedKnowledgeSource(source: {
  id: string
  project_id: string
  analyzed_content: string
}): Promise<EmbeddingResult> {
  const errors: string[] = []

  try {
    const content = source.analyzed_content
    if (!content) {
      return { success: false, chunksEmbedded: 0, errors: ['No analyzed content provided'] }
    }

    const chunks = chunkKnowledgeContent(content)

    if (chunks.length === 0) {
      console.log(`[embedding-service] No chunks generated for source ${source.id}`)
      return { success: true, chunksEmbedded: 0, errors: [] }
    }

    console.log(`[embedding-service] Generating embeddings for ${chunks.length} chunks (source ${source.id})...`)

    const texts = chunks.map((c) => c.text)
    const embeddings = await generateEmbeddings(texts)

    // Delete existing source-level embeddings for this source (re-analysis)
    try {
      await db
        .delete(knowledgeEmbeddings)
        .where(eq(knowledgeEmbeddings.source_id, source.id))
    } catch (deleteError) {
      const msg = deleteError instanceof Error ? deleteError.message : 'Unknown error'
      console.warn(`[embedding-service] Failed to delete old source embeddings: ${msg}`)
    }

    const records = chunks.map((chunk, i) => ({
      project_id: source.project_id,
      source_id: source.id,
      chunk_index: chunk.index,
      chunk_text: chunk.text,
      chunk_start_line: chunk.startLine,
      chunk_end_line: chunk.endLine,
      section_heading: chunk.sectionHeading,
      parent_headings: chunk.parentHeadings,
      embedding: sql`${formatEmbeddingForPgVector(embeddings[i])}::vector`,
      version: 1,
    }))

    let insertedCount = 0
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50)
      try {
        await db.insert(knowledgeEmbeddings).values(batch)
        insertedCount += batch.length
      } catch (insertError) {
        const msg = insertError instanceof Error ? insertError.message : 'Unknown error'
        errors.push(`Batch ${Math.floor(i / 50) + 1}: ${msg}`)
        console.error(`[embedding-service] Insert error for batch: ${msg}`)
      }
    }

    console.log(`[embedding-service] Embedded ${insertedCount}/${records.length} chunks for source ${source.id}`)

    return {
      success: errors.length === 0,
      chunksEmbedded: insertedCount,
      errors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[embedding-service] Failed to embed source ${source.id}: ${message}`)
    return { success: false, chunksEmbedded: 0, errors: [message] }
  }
}

/**
 * Search knowledge embeddings by source IDs (or all project sources)
 * Uses the search_knowledge_embeddings_v2 RPC function
 */
export async function searchKnowledgeBySourceIds(
  projectId: string,
  query: string,
  options: {
    sourceIds?: string[]
    limit?: number
    similarityThreshold?: number
  } = {}
): Promise<
  Array<{
    id: string
    sourceId: string | null
    chunkText: string
    sectionHeading: string | null
    parentHeadings: string[]
    similarity: number
  }>
> {
  const { sourceIds, limit = 5, similarityThreshold = 0.5 } = options

  const queryEmbedding = await embedQuery(query)

  console.log(`[embedding-service] Searching v2 for "${query}" in project ${projectId}`)

  const results = await db.execute<{
    id: string
    source_id: string | null
    chunk_text: string
    section_heading: string | null
    parent_headings: string[]
    similarity: number
  }>(sql`
    SELECT * FROM search_knowledge_embeddings_v2(
      ${projectId},
      ${formatEmbeddingForPgVector(queryEmbedding)}::vector,
      ${sourceIds ?? null},
      ${limit},
      ${similarityThreshold}
    )
  `)

  console.log(`[embedding-service] Search v2 returned ${results.rows.length} results`)

  return results.rows.map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    chunkText: row.chunk_text,
    sectionHeading: row.section_heading,
    parentHeadings: row.parent_headings ?? [],
    similarity: row.similarity,
  }))
}
