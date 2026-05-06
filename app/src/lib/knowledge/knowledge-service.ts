/**
 * Knowledge Source Service Layer
 *
 * This is the single source of truth for all knowledge source CRUD operations.
 * It orchestrates database operations, product scope linking, and graph evaluation.
 *
 * Use this service instead of calling db.insert(knowledgeSources) directly
 * for any create/update operations.
 *
 * Architecture:
 * - API Routes -> knowledge-service.ts -> db + graph-eval
 * - Integrations -> knowledge-service.ts (Admin) -> db + graph-eval
 * - Sync Jobs -> knowledge-service.ts (Admin) -> db + graph-eval
 */

import { eq, and, desc, ilike, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/db/schema/app'
import { fireGraphEval } from '@/lib/utils/graph-eval'
import { fireSourceAnalysis } from '@/lib/utils/source-processing'
import {
  embedKnowledgeSource,
  searchKnowledgeBySourceIds,
} from '@/lib/knowledge/embedding-service'
import { searchByMode, type SearchMode } from '@/lib/search/search-by-mode'
import { setEntityProductScope } from '@/lib/db/queries/entity-relationships'
import { generateSourceDescription } from '@/mastra/workflows/common/generate-description'
import { evaluateEntityRelationships } from '@/mastra/workflows/graph-evaluation'
import { getNotionCredentials } from '@/lib/integrations/notion'
import { NotionClient } from '@/lib/integrations/notion/client'
import { blocksToMarkdown } from '@/lib/integrations/notion/blocks-to-markdown'
import { crawlDocsPortal, combineCrawlResults } from '@/lib/knowledge/docs-crawler'
import { notifyAutomationEvent } from '@/lib/automations/events'

// ============================================================================
// Source Analysis Types
// ============================================================================

export interface AnalyzeSourceInput {
  projectId: string
  sourceId: string
  sourceType: 'website' | 'docs_portal' | 'uploaded_doc' | 'raw_text' | 'notion'
  url: string | null
  storagePath: string | null
  content: string | null
  analysisScope: string | null
  notionPageId?: string | null
  origin?: string | null
  sourceName?: string | null
}

export interface AnalyzeSourceOptions {
  onProgress?: (step: string, message: string) => void
}

export interface AnalyzeSourceResult {
  saved: boolean
  chunksEmbedded: number
  relationshipsCreated: number
  errors: string[]
}

// ============================================================================
// Source Analysis - Private Helpers
// ============================================================================

/**
 * Basic HTML to text extraction
 */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

interface FetchedContent {
  fetchedContent: string
  hasContent: boolean
}

/**
 * Phase 1: Fetch content from a knowledge source based on its type.
 */
async function fetchSourceContent(
  input: AnalyzeSourceInput,
  onProgress?: (step: string, message: string) => void
): Promise<FetchedContent> {
  const { projectId, sourceType, url, content } = input
  const noContent: FetchedContent = { fetchedContent: '', hasContent: false }

  onProgress?.('fetch-content', `Fetching content for ${sourceType} source...`)

  try {
    switch (sourceType) {
      case 'website': {
        if (!url) return noContent

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HissunoBot/1.0)',
            Accept: 'text/html',
          },
        })

        if (!response.ok) return noContent

        const html = await response.text()
        const textContent = extractTextFromHtml(html)

        return { fetchedContent: textContent, hasContent: Boolean(textContent) }
      }

      case 'docs_portal': {
        if (!url) return noContent

        onProgress?.('fetch-content', `Crawling documentation portal: ${url}`)

        const crawlResults = await crawlDocsPortal(url, { maxPages: 50, rateLimit: 500 })
        const successfulPages = crawlResults.filter((r) => !r.error && r.content)

        if (successfulPages.length === 0) return noContent

        onProgress?.('fetch-content', `Crawled ${successfulPages.length} pages`)

        const combinedContent = combineCrawlResults(crawlResults)
        return { fetchedContent: combinedContent, hasContent: Boolean(combinedContent) }
      }

      case 'raw_text': {
        return {
          fetchedContent: content || '',
          hasContent: Boolean(content),
        }
      }

      case 'uploaded_doc': {
        if (input.origin === 'notion' && input.notionPageId) {
          const credentials = await getNotionCredentials(projectId)
          if (!credentials) {
            console.warn(`[analyzeSource] No Notion credentials for project ${projectId}`)
            return noContent
          }

          const notionClient = new NotionClient(credentials.accessToken)

          onProgress?.('fetch-content', 'Fetching Notion page blocks...')
          const blocks = await notionClient.getAllPageBlocks(input.notionPageId)

          const markdown = blocksToMarkdown(blocks)

          return {
            fetchedContent: markdown || '[Empty Notion page]',
            hasContent: Boolean(markdown),
          }
        }

        return {
          fetchedContent: `[Uploaded document: ${input.storagePath}]`,
          hasContent: Boolean(input.storagePath),
        }
      }

      case 'notion': {
        // Check if content was already fetched by Notion sync
        const [existingSource] = await db
          .select({ analyzed_content: knowledgeSources.analyzed_content })
          .from(knowledgeSources)
          .where(eq(knowledgeSources.id, input.sourceId))
          .limit(1)

        if (existingSource?.analyzed_content) {
          onProgress?.('fetch-content', 'Using pre-fetched Notion content')
          return {
            fetchedContent: existingSource.analyzed_content,
            hasContent: true,
          }
        }

        // Fallback: fetch directly from Notion API
        if (!input.notionPageId) return noContent

        const credentials = await getNotionCredentials(projectId)
        if (!credentials) {
          console.warn(`[analyzeSource] No Notion credentials for project ${projectId}`)
          return noContent
        }

        const notionClient = new NotionClient(credentials.accessToken)

        onProgress?.('fetch-content', 'Fetching Notion page blocks...')
        const blocks = await notionClient.getAllPageBlocks(input.notionPageId)

        const markdown = blocksToMarkdown(blocks)

        return {
          fetchedContent: markdown || '[Empty Notion page]',
          hasContent: Boolean(markdown),
        }
      }

      default:
        return noContent
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[analyzeSource] Fetch error for source ${input.sourceId}:`, message)
    return noContent
  }
}

// ============================================================================
// Source Analysis - Public API
// ============================================================================

/**
 * Analyzes a single knowledge source end-to-end: fetch -> save+embed -> graph eval.
 *
 * Sanitization (redacting secrets/credentials) is handled separately by the
 * hissuno-knowledge-sanitizer automation skill, triggered by the
 * knowledge.created event after the source is saved.
 */
export async function analyzeSource(
  input: AnalyzeSourceInput,
  opts?: AnalyzeSourceOptions
): Promise<AnalyzeSourceResult> {
  const { projectId, sourceId } = input
  const onProgress = opts?.onProgress
  const errors: string[] = []
  let chunksEmbedded = 0
  let relationshipsCreated = 0

  // Phase 1: Fetch content
  const fetched = await fetchSourceContent(input, onProgress)
  const fetchedContent = fetched.hasContent ? fetched.fetchedContent : ''

  // Phase 2: Save and embed
  try {
    if (!fetched.hasContent || !fetchedContent) {
      onProgress?.('save-and-embed', 'No content to save')

      await db
        .update(knowledgeSources)
        .set({ status: 'failed', error_message: 'No content extracted from source' })
        .where(eq(knowledgeSources.id, sourceId))

      return { saved: false, chunksEmbedded: 0, relationshipsCreated: 0, errors: ['No content extracted'] }
    }

    // Generate description if the source doesn't already have one
    let generatedDescription: string | null = null
    try {
      const [existingSource] = await db
        .select({ description: knowledgeSources.description })
        .from(knowledgeSources)
        .where(eq(knowledgeSources.id, sourceId))
        .limit(1)

      if (!existingSource?.description) {
        onProgress?.('save-and-embed', 'Generating description...')
        generatedDescription = await generateSourceDescription(fetchedContent, input.sourceName, projectId)
      }
    } catch (descErr) {
      // Non-critical - continue without description
      console.warn('[analyzeSource] Description generation failed:', descErr instanceof Error ? descErr.message : descErr)
    }

    // Save analyzed content to DB
    onProgress?.('save-and-embed', 'Saving analyzed content...')

    try {
      const updateFields: Record<string, unknown> = {
        status: 'done',
        analyzed_content: fetchedContent,
        analyzed_at: new Date(),
        error_message: null,
      }
      if (generatedDescription) {
        updateFields.description = generatedDescription
      }

      await db
        .update(knowledgeSources)
        .set(updateFields)
        .where(eq(knowledgeSources.id, sourceId))
    } catch (updateErr) {
      const msg = updateErr instanceof Error ? updateErr.message : 'Unknown error'
      errors.push(`DB update failed: ${msg}`)
      console.error('[analyzeSource] DB update failed:', msg)
    }

    // Generate embeddings
    if (errors.length === 0) {
      onProgress?.('save-and-embed', 'Generating embeddings...')

      const embedResult = await embedKnowledgeSource({
        id: sourceId,
        project_id: projectId,
        analyzed_content: fetchedContent,
      })

      chunksEmbedded = embedResult.chunksEmbedded
      if (embedResult.errors.length > 0) {
        errors.push(...embedResult.errors)
      }

      onProgress?.('save-and-embed', `Embedded ${chunksEmbedded} chunks`)
    }

    onProgress?.('save-and-embed', 'Source analysis complete')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(message)
    console.error('[analyzeSource] Save/embed error:', message)

    // Update source status to failed
    try {
      await db
        .update(knowledgeSources)
        .set({ status: 'failed', error_message: message })
        .where(eq(knowledgeSources.id, sourceId))
    } catch (statusErr) {
      // Best effort: the original error is the important one, but log this too
      // so we know when status propagation is also broken.
      console.warn(`[analyzeSource] Failed to mark source ${sourceId} as failed:`, statusErr instanceof Error ? statusErr.message : statusErr)
    }
  }

  // Phase 4: Graph evaluation
  try {
    onProgress?.('trigger-graph-eval', 'Discovering relationships...')

    const graphResult = await evaluateEntityRelationships(projectId, 'knowledge_source', sourceId)
    relationshipsCreated = graphResult.relationshipsCreated

    if (graphResult.errors.length > 0) {
      console.warn('[analyzeSource] Graph eval errors:', graphResult.errors)
    }

    onProgress?.('trigger-graph-eval', `Found ${relationshipsCreated} relationships${graphResult.productScopeId ? ' + product scope' : ''}`)
  } catch (error) {
    console.error('[analyzeSource] Graph eval error:', error instanceof Error ? error.message : error)
    // Non-fatal - don't add to errors
  }

  return {
    saved: errors.length === 0,
    chunksEmbedded,
    relationshipsCreated,
    errors,
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Generate embeddings for a knowledge source that already has analyzed content.
 * Non-blocking - logs on failure rather than throwing.
 */
async function embedKnowledgeSourceInline(
  sourceId: string,
  projectId: string,
  analyzedContent: string,
  logPrefix: string
): Promise<boolean> {
  try {
    const result = await embedKnowledgeSource({
      id: sourceId,
      project_id: projectId,
      analyzed_content: analyzedContent,
    })
    return result.success
  } catch (error) {
    console.warn(`[${logPrefix}] Failed to embed source ${sourceId}:`, error)
    return false
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Input for creating a knowledge source via admin/internal context
 */
export interface CreateKnowledgeSourceAdminInput {
  projectId: string
  type: string
  name?: string | null
  description?: string | null
  url?: string | null
  content?: string | null
  storagePath?: string | null
  notionPageId?: string | null
  analyzedContent?: string | null
  analysisScope?: string | null
  origin?: string | null
  enabled?: boolean
  customFields?: Record<string, unknown> | null
  /**
   * Required: every knowledge source lives under a product scope. The caller
   * is responsible for resolving which scope (route param, plugin setting,
   * or project default lookup).
   */
  productScopeId: string
  parentId?: string | null
  /** When true, stores content as pending and skips inline embedding/graph-eval.
   *  Use when the source will go through the analysis workflow separately. */
  skipInlineProcessing?: boolean
}

/**
 * Input for updating a knowledge source
 */
export interface UpdateKnowledgeSourceAdminInput {
  name?: string | null
  description?: string | null
  url?: string | null
  analyzedContent?: string | null
  status?: string
  enabled?: boolean
}

// ============================================================================
// Admin Operations (for integrations, sync jobs, and workflows)
// ============================================================================

/**
 * Creates a knowledge source with graph eval. No user auth required.
 * Use this for integrations, sync jobs, and internal workflows.
 */
export async function createKnowledgeSource(
  input: CreateKnowledgeSourceAdminInput
) {
  const hasContent = !!input.analyzedContent
  const skipProcessing = input.skipInlineProcessing ?? false

  const [source] = await db
    .insert(knowledgeSources)
    .values({
      project_id: input.projectId,
      type: input.type,
      name: input.name ?? null,
      description: input.description ?? null,
      url: input.url ?? null,
      content: input.content ?? null,
      storage_path: input.storagePath ?? null,
      notion_page_id: input.notionPageId ?? null,
      analyzed_content: input.analyzedContent ?? null,
      analysis_scope: input.analysisScope ?? null,
      origin: input.origin ?? null,
      custom_fields: input.customFields ?? null,
      parent_id: input.parentId ?? null,
      status: input.type === 'folder' ? 'done' : (skipProcessing ? 'pending' : (hasContent ? 'done' : 'pending')),
      analyzed_at: (!skipProcessing && hasContent) ? new Date() : null,
      enabled: input.enabled ?? true,
    })
    .returning()

  await setEntityProductScope(input.projectId, 'knowledge_source', source.id, input.productScopeId)

  // Generate embeddings inline when content is available and not skipping
  if (hasContent && !skipProcessing) {
    await embedKnowledgeSourceInline(
      source.id,
      input.projectId,
      input.analyzedContent!,
      'knowledge-service.createAdmin'
    )
  }

  if (!skipProcessing) {
    if (hasContent) {
      // Content is already analyzed/provided; just run graph-eval to link it.
      fireGraphEval(input.projectId, 'knowledge_source', source.id)
    } else if (input.type !== 'folder') {
      // Needs fetching + analysis in the background. Folders have no content.
      fireSourceAnalysis(source.id, input.projectId)
    }
  }

  if (input.type !== 'folder') {
    notifyAutomationEvent('knowledge.created', {
      projectId: input.projectId,
      entity: {
        type: 'knowledge_source',
        id: source.id,
        snapshot: { productScopeId: input.productScopeId },
      },
    })
  }

  return source
}

/**
 * Creates multiple knowledge sources in bulk. No user auth required.
 * Fires graph eval for each inserted source.
 */
export async function createKnowledgeSourceBulkAdmin(
  projectId: string,
  sources: Array<Omit<CreateKnowledgeSourceAdminInput, 'projectId' | 'productScopeId'>>
) {
  const inserted = await db
    .insert(knowledgeSources)
    .values(
      sources.map((s) => ({
        project_id: projectId,
        type: s.type,
        name: s.name ?? null,
        description: s.description ?? null,
        url: s.url ?? null,
        content: s.content ?? null,
        storage_path: s.storagePath ?? null,
        notion_page_id: s.notionPageId ?? null,
        analyzed_content: s.analyzedContent ?? null,
        analysis_scope: s.analysisScope ?? null,
        origin: s.origin ?? null,
        status: 'pending' as const,
        enabled: s.enabled ?? true,
      }))
    )
    .returning()

  // Non-blocking: sources with inline analyzed content only need graph-eval;
  // sources without it need full fetch + analyze in the background.
  for (const source of inserted) {
    if (source.analyzed_content) {
      fireGraphEval(projectId, 'knowledge_source', source.id)
    } else if (source.type !== 'folder') {
      fireSourceAnalysis(source.id, projectId)
    }
  }

  return inserted
}

/**
 * Updates a knowledge source with graph eval. No user auth required.
 * Use this for integrations, sync jobs, and internal workflows.
 */
export async function updateKnowledgeSource(
  sourceId: string,
  projectId: string,
  input: UpdateKnowledgeSourceAdminInput
) {
  const hasContent = !!input.analyzedContent

  const updates: Record<string, unknown> = { updated_at: new Date() }
  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description
  if (input.url !== undefined) updates.url = input.url
  if (input.analyzedContent !== undefined) updates.analyzed_content = input.analyzedContent
  if (input.status !== undefined) updates.status = input.status
  if (input.enabled !== undefined) updates.enabled = input.enabled

  // When analyzed content is provided, auto-complete the analysis
  // (unless an explicit status was set, e.g. 'pending' for workflow processing)
  if (hasContent && input.status === undefined) {
    updates.status = 'done'
    updates.analyzed_at = new Date()
  }

  const [source] = await db
    .update(knowledgeSources)
    .set(updates)
    .where(eq(knowledgeSources.id, sourceId))
    .returning()

  // Re-embed when content changes
  if (hasContent) {
    await embedKnowledgeSourceInline(
      sourceId,
      projectId,
      input.analyzedContent!,
      'knowledge-service.updateAdmin'
    )
  }

  // Non-blocking graph eval
  fireGraphEval(projectId, 'knowledge_source', sourceId)

  return source
}


// ============================================================================
// Search Operations
// ============================================================================

export interface SearchKnowledgeResult {
  id: string
  name: string
  snippet: string
  score?: number
}

/**
 * Searches knowledge sources using semantic search with ILIKE fallback.
 */
export async function searchKnowledge(
  projectId: string,
  query: string,
  limit: number = 10,
  options?: { mode?: SearchMode; threshold?: number }
): Promise<SearchKnowledgeResult[]> {
  return searchByMode<SearchKnowledgeResult>({
    logPrefix: '[knowledge-service]',
    mode: options?.mode,
    semanticSearch: async () => {
      const results = await searchKnowledgeBySourceIds(projectId, query, {
        limit,
        similarityThreshold: options?.threshold ?? 0.5,
      })
      return results.map((r) => ({
        id: r.id,
        name: r.sectionHeading ?? 'Knowledge chunk',
        snippet: r.chunkText.slice(0, 200),
        score: r.similarity,
      }))
    },
    keywordSearch: async () => {
      const s = `%${query}%`
      const data = await db
        .select({
          id: knowledgeSources.id,
          name: knowledgeSources.name,
          analyzed_content: knowledgeSources.analyzed_content,
        })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.project_id, projectId),
            eq(knowledgeSources.status, 'done'),
            eq(knowledgeSources.enabled, true),
            or(
              ilike(knowledgeSources.name, s),
              ilike(knowledgeSources.description, s),
              ilike(knowledgeSources.analyzed_content, s)
            )
          )
        )
        .orderBy(desc(knowledgeSources.created_at))
        .limit(limit)

      return data.map((r) => ({
        id: r.id,
        name: r.name ?? 'Knowledge source',
        snippet: (r.analyzed_content ?? '').slice(0, 200),
        score: 0,
      }))
    },
  })
}
