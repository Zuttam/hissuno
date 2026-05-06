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
import { embedKnowledgeSource } from '@/lib/knowledge/embedding-service'
import { searchByMode, type SearchMode } from '@/lib/search/search-by-mode'
import { setEntityProductScope } from '@/lib/db/queries/entity-relationships'
import { generateSourceDescription } from '@/mastra/workflows/common/generate-description'
import { evaluateEntityRelationships } from '@/mastra/workflows/graph-evaluation'

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
 * Strips common LLM preamble/introduction lines from agent output.
 */
function stripLLMPreamble(text: string): string {
  return text
    .replace(
      /^(?:here(?:'s| is) (?:the )?(?:sanitized|redacted|cleaned|analyzed|extracted|organized|processed)[\s\S]*?:\s*\n+)/i,
      '',
    )
    .replace(/^(?:below is (?:the )?(?:sanitized|redacted|cleaned|analyzed|extracted|organized|processed)[\s\S]*?:\s*\n+)/i, '')
    .replace(/^(?:i'?ve (?:sanitized|redacted|cleaned|analyzed|extracted|organized|processed)[\s\S]*?:\s*\n+)/i, '')
    .trim()
}

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

const REDACTION_PATTERNS = [
  { pattern: /\[REDACTED_AWS_KEY\]/g, type: 'aws_key' },
  { pattern: /\[REDACTED_API_KEY\]/g, type: 'api_key' },
  { pattern: /\[REDACTED_GITHUB_TOKEN\]/g, type: 'github_token' },
  { pattern: /\[REDACTED_DATABASE_URL\]/g, type: 'database_url' },
  { pattern: /\[REDACTED_PASSWORD\]/g, type: 'password' },
  { pattern: /\[REDACTED_PRIVATE_KEY\]/g, type: 'private_key' },
  { pattern: /\[REDACTED_INTERNAL_IP\]/g, type: 'internal_ip' },
  { pattern: /\[REDACTED_SECRET\]/g, type: 'secret' },
  { pattern: /\[REDACTED_TOKEN\]/g, type: 'token' },
  { pattern: /\[REDACTED_CREDENTIAL\]/g, type: 'credential' },
]

function countRedactions(content: string): number {
  let count = 0
  for (const { pattern } of REDACTION_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) count += matches.length
  }
  return count
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

        const { webScraperAgent: webAgent = null } = await import('@/mastra/agents/web-scraper-agent').catch(() => ({ webScraperAgent: null as null }))

        if (webAgent) {
          const prompt = `Analyze this website content and extract key information:

URL: ${url}

Content:
${textContent.slice(0, 20000)}

Please extract:
1. Company/Product Overview
2. Key Features and Capabilities
3. Pricing Information (if available)
4. Documentation highlights
5. Support resources`

          const agentResponse = await webAgent.generate([{ role: 'user', content: prompt }])
          return {
            fetchedContent: stripLLMPreamble(agentResponse.text) || textContent,
            hasContent: true,
          }
        }

        return { fetchedContent: textContent, hasContent: true }
      }

      case 'docs_portal': {
        if (!url) return noContent

        onProgress?.('fetch-content', `Crawling documentation portal: ${url}`)

        const { crawlDocsPortal, combineCrawlResults } = await import('@/lib/knowledge/docs-crawler')
        const crawlResults = await crawlDocsPortal(url, { maxPages: 50, rateLimit: 500 })
        const successfulPages = crawlResults.filter((r) => !r.error && r.content)

        if (successfulPages.length === 0) return noContent

        onProgress?.('fetch-content', `Crawled ${successfulPages.length} pages`)

        const combinedContent = combineCrawlResults(crawlResults)

        const { webScraperAgent: webAgent = null } = await import('@/mastra/agents/web-scraper-agent').catch(() => ({ webScraperAgent: null as null }))

        if (webAgent) {
          const prompt = `Analyze this documentation portal content and extract key information:

${combinedContent.slice(0, 30000)}

Please extract and organize:
1. Main product/service overview
2. Key features and capabilities
3. Getting started guides
4. API documentation highlights
5. Common FAQs or troubleshooting
6. Best practices and tutorials`

          const agentResponse = await webAgent.generate([{ role: 'user', content: prompt }])
          return {
            fetchedContent: stripLLMPreamble(agentResponse.text) || combinedContent,
            hasContent: true,
          }
        }

        return { fetchedContent: combinedContent, hasContent: true }
      }

      case 'raw_text': {
        return {
          fetchedContent: content || '',
          hasContent: Boolean(content),
        }
      }

      case 'uploaded_doc': {
        if (input.origin === 'notion' && input.notionPageId) {
          const { getNotionCredentials } = await import('@/lib/integrations/notion')
          const credentials = await getNotionCredentials(projectId)
          if (!credentials) {
            console.warn(`[analyzeSource] No Notion credentials for project ${projectId}`)
            return noContent
          }

          const { NotionClient } = await import('@/lib/integrations/notion/client')
          const notionClient = new NotionClient(credentials.accessToken)

          onProgress?.('fetch-content', 'Fetching Notion page blocks...')
          const blocks = await notionClient.getAllPageBlocks(input.notionPageId)

          const { blocksToMarkdown } = await import('@/lib/integrations/notion/blocks-to-markdown')
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

        const { getNotionCredentials } = await import('@/lib/integrations/notion')
        const credentials = await getNotionCredentials(projectId)
        if (!credentials) {
          console.warn(`[analyzeSource] No Notion credentials for project ${projectId}`)
          return noContent
        }

        const { NotionClient } = await import('@/lib/integrations/notion/client')
        const notionClient = new NotionClient(credentials.accessToken)

        onProgress?.('fetch-content', 'Fetching Notion page blocks...')
        const blocks = await notionClient.getAllPageBlocks(input.notionPageId)

        const { blocksToMarkdown } = await import('@/lib/integrations/notion/blocks-to-markdown')
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

/**
 * Phase 2: Sanitize content by scanning for sensitive information.
 */
async function sanitizeSourceContent(
  fetchedContent: string,
  onProgress?: (step: string, message: string) => void
): Promise<{ sanitizedContent: string; redactionCount: number }> {
  if (!fetchedContent) {
    return { sanitizedContent: '', redactionCount: 0 }
  }

  onProgress?.('sanitize-content', 'Scanning for sensitive information...')

  const { securityScannerAgent: agent = null } = await import('@/mastra/agents/security-scanner-agent').catch(() => ({ securityScannerAgent: null as null }))

  if (!agent) {
    console.warn('[analyzeSource] Security scanner agent not found, skipping sanitization')
    return { sanitizedContent: fetchedContent, redactionCount: 0 }
  }

  try {
    const prompt = `Scan the following knowledge content for sensitive information and redact any secrets, credentials, API keys, or other sensitive data you find. Return the content with all sensitive information replaced by appropriate placeholders.

---
CONTENT TO SCAN:
${fetchedContent.slice(0, 50000)}
---

Return the sanitized content maintaining the exact same structure and formatting. Only replace sensitive values with redaction placeholders.`

    const response = await agent.generate([{ role: 'user', content: prompt }])
    const sanitizedContent = stripLLMPreamble(response.text) || fetchedContent
    const redactionCount = countRedactions(sanitizedContent)

    if (redactionCount > 0) {
      onProgress?.('sanitize-content', `Redacted ${redactionCount} sensitive item(s)`)
    } else {
      onProgress?.('sanitize-content', 'Security scan complete - no sensitive data found')
    }

    return { sanitizedContent, redactionCount }
  } catch (error) {
    console.error('[analyzeSource] Sanitization error:', error instanceof Error ? error.message : error)
    // On error, return original content to avoid data loss
    return { sanitizedContent: fetchedContent, redactionCount: 0 }
  }
}

// ============================================================================
// Source Analysis - Public API
// ============================================================================

/**
 * Analyzes a single knowledge source end-to-end.
 *
 * Consolidates the 4 workflow steps (fetch, sanitize, save+embed, graph eval)
 * into a single service function. Replaces the Mastra sourceAnalysisWorkflow.
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

  // Phase 2: Sanitize
  let sanitizedContent = ''
  if (fetched.hasContent && fetched.fetchedContent) {
    const sanitized = await sanitizeSourceContent(fetched.fetchedContent, onProgress)
    sanitizedContent = sanitized.sanitizedContent
  }

  // Phase 3: Save and embed
  try {
    if (!fetched.hasContent || !sanitizedContent) {
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
        generatedDescription = await generateSourceDescription(sanitizedContent, input.sourceName, projectId)
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
        analyzed_content: sanitizedContent,
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
        analyzed_content: sanitizedContent,
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
export async function createKnowledgeSourceAdmin(
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
    const { notifyAutomationEvent } = await import('@/lib/automations/events')
    notifyAutomationEvent('knowledge.created', {
      projectId: input.projectId,
      entity: { type: 'knowledge_source', id: source.id },
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
export async function updateKnowledgeSourceAdmin(
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
// Aliases - auth is handled at the route level, not in the service layer
// ============================================================================

export const createKnowledgeSource = createKnowledgeSourceAdmin
export const updateKnowledgeSource = updateKnowledgeSourceAdmin

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
      const { searchKnowledgeBySourceIds } = await import(
        '@/lib/knowledge/embedding-service'
      )
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
