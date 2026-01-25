/**
 * Embedding service for knowledge packages
 *
 * Uses OpenAI text-embedding-3-small model to generate vector embeddings
 * for semantic search across knowledge packages.
 */

import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'
import { chunkKnowledgeContent } from './chunking'
import { downloadKnowledgePackage } from './storage'
import type { KnowledgeCategory } from './types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 100 // OpenAI allows up to 2048, but batch for memory efficiency

export interface EmbeddingResult {
  success: boolean
  chunksEmbedded: number
  errors: string[]
}

interface KnowledgePackageRow {
  id: string
  project_id: string
  category: string
  storage_path: string
  version: number
  generated_at: string
  named_package_id: string | null
}

/**
 * Generate embeddings for an array of texts
 * Handles batching internally to respect API limits
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    const response = await openai.embeddings.create({
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
 * Format embedding array as pgvector string
 */
function formatEmbeddingForPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Embed a single knowledge package
 */
export async function embedKnowledgePackage(pkg: KnowledgePackageRow): Promise<EmbeddingResult> {
  const supabase = createAdminClient()
  const errors: string[] = []

  try {
    // Download package content
    const { content, error: downloadError } = await downloadKnowledgePackage(pkg.storage_path, supabase)

    if (downloadError || !content) {
      return {
        success: false,
        chunksEmbedded: 0,
        errors: [downloadError?.message ?? 'Failed to download package'],
      }
    }

    // Chunk the content
    const chunks = chunkKnowledgeContent(content)

    if (chunks.length === 0) {
      console.log(`[embedding-service] No chunks generated for ${pkg.category} package`)
      return {
        success: true,
        chunksEmbedded: 0,
        errors: [],
      }
    }

    console.log(`[embedding-service] Generating embeddings for ${chunks.length} chunks in ${pkg.category}...`)

    // Generate embeddings
    const texts = chunks.map((c) => c.text)
    const embeddings = await generateEmbeddings(texts)

    // Delete existing embeddings for this package (to handle re-analysis)
    const { error: deleteError } = await supabase.from('knowledge_embeddings').delete().eq('package_id', pkg.id)

    if (deleteError) {
      console.warn(`[embedding-service] Failed to delete old embeddings: ${deleteError.message}`)
    }

    // Prepare records for insertion
    const records = chunks.map((chunk, i) => ({
      project_id: pkg.project_id,
      package_id: pkg.id,
      named_package_id: pkg.named_package_id,
      category: pkg.category,
      chunk_index: chunk.index,
      chunk_text: chunk.text,
      chunk_start_line: chunk.startLine,
      chunk_end_line: chunk.endLine,
      section_heading: chunk.sectionHeading,
      parent_headings: chunk.parentHeadings,
      embedding: formatEmbeddingForPgVector(embeddings[i]),
      version: pkg.version,
    }))

    // Insert in batches to avoid payload limits
    let insertedCount = 0
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50)
      const { error: insertError } = await supabase.from('knowledge_embeddings').insert(batch)

      if (insertError) {
        errors.push(`Batch ${Math.floor(i / 50) + 1}: ${insertError.message}`)
        console.error(`[embedding-service] Insert error for batch: ${insertError.message}`)
      } else {
        insertedCount += batch.length
      }
    }

    console.log(`[embedding-service] Embedded ${insertedCount}/${records.length} chunks for ${pkg.category}`)

    return {
      success: errors.length === 0,
      chunksEmbedded: insertedCount,
      errors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[embedding-service] Failed to embed ${pkg.category}: ${message}`)
    return {
      success: false,
      chunksEmbedded: 0,
      errors: [message],
    }
  }
}

/**
 * Embed all knowledge packages for a project
 * Called after knowledge analysis workflow completes
 */
export async function embedProjectKnowledge(
  projectId: string,
  options: { namedPackageId?: string } = {}
): Promise<EmbeddingResult> {
  const { namedPackageId } = options
  const supabase = createAdminClient()
  let totalChunks = 0
  const allErrors: string[] = []

  console.log(`[embedding-service] Starting embedding for project ${projectId}${namedPackageId ? `, package ${namedPackageId}` : ''}`)

  // Fetch packages for the project (optionally filtered by named package)
  let query = supabase
    .from('knowledge_packages')
    .select('id, project_id, category, storage_path, version, generated_at, named_package_id')
    .eq('project_id', projectId)

  if (namedPackageId) {
    query = query.eq('named_package_id', namedPackageId)
  }

  const { data: packages, error: fetchError } = await query

  if (fetchError || !packages) {
    return {
      success: false,
      chunksEmbedded: 0,
      errors: [fetchError?.message ?? 'Failed to fetch packages'],
    }
  }

  if (packages.length === 0) {
    console.log(`[embedding-service] No packages found for project ${projectId}`)
    return {
      success: true,
      chunksEmbedded: 0,
      errors: [],
    }
  }

  console.log(`[embedding-service] Found ${packages.length} packages to embed`)

  // Embed each package
  for (const pkg of packages) {
    const result = await embedKnowledgePackage(pkg as KnowledgePackageRow)
    totalChunks += result.chunksEmbedded
    if (result.errors.length > 0) {
      allErrors.push(...result.errors.map((e) => `${pkg.category}: ${e}`))
    }
  }

  console.log(`[embedding-service] Completed embedding. Total chunks: ${totalChunks}, Errors: ${allErrors.length}`)

  return {
    success: allErrors.length === 0,
    chunksEmbedded: totalChunks,
    errors: allErrors,
  }
}

/**
 * Generate embedding for a search query
 */
export async function embedQuery(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query.trim(),
    dimensions: EMBEDDING_DIMENSIONS,
  })

  return response.data[0].embedding
}

/**
 * Search knowledge embeddings by semantic similarity
 * Returns matching chunks with similarity scores
 */
export async function searchKnowledgeEmbeddings(
  projectId: string,
  query: string,
  options: {
    namedPackageId?: string
    categories?: KnowledgeCategory[]
    limit?: number
    similarityThreshold?: number
  } = {}
): Promise<
  Array<{
    id: string
    category: KnowledgeCategory
    chunkText: string
    sectionHeading: string | null
    parentHeadings: string[]
    similarity: number
  }>
> {
  // Default threshold of 0.5 - configurable via options, no DB changes needed
  const { namedPackageId, categories, limit = 5, similarityThreshold = 0.5 } = options
  const supabase = createAdminClient()

  // Generate query embedding
  const queryEmbedding = await embedQuery(query)

  console.log(`[embedding-service] Searching for "${query}" in project ${projectId}`)
  console.log(`[embedding-service] Options: namedPackageId=${namedPackageId ?? 'all'}, categories=${categories?.join(',') ?? 'all'}, limit=${limit}, threshold=${similarityThreshold}`)

  // Call the search function
  const { data, error } = await supabase.rpc('search_knowledge_embeddings', {
    p_project_id: projectId,
    p_query_embedding: formatEmbeddingForPgVector(queryEmbedding),
    p_named_package_id: namedPackageId ?? null,
    p_categories: categories ?? null,
    p_limit: limit,
    p_similarity_threshold: similarityThreshold,
  })

  if (error) {
    console.error(`[embedding-service] Search failed: ${error.message}`)
    throw new Error(`Search failed: ${error.message}`)
  }

  console.log(`[embedding-service] Search returned ${data?.length ?? 0} results`)

  return (data ?? []).map(
    (row: {
      id: string
      category: string
      chunk_text: string
      section_heading: string | null
      parent_headings: string[]
      similarity: number
    }) => ({
      id: row.id,
      category: row.category as KnowledgeCategory,
      chunkText: row.chunk_text,
      sectionHeading: row.section_heading,
      parentHeadings: row.parent_headings ?? [],
      similarity: row.similarity,
    })
  )
}
