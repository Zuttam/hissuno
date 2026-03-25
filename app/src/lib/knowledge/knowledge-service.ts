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
import { embedKnowledgeSource } from '@/lib/knowledge/embedding-service'
import { searchWithFallback } from '@/lib/search/search-with-fallback'
import { setEntityProductScope } from '@/lib/db/queries/entity-relationships'

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
  sourceCodeId?: string | null
  analysisScope?: string | null
  origin?: string | null
  enabled?: boolean
  productScopeId?: string | null
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
      source_code_id: input.sourceCodeId ?? null,
      analysis_scope: input.analysisScope ?? null,
      origin: input.origin ?? null,
      status: skipProcessing ? 'pending' : (hasContent ? 'done' : 'pending'),
      analyzed_at: (!skipProcessing && hasContent) ? new Date() : null,
      enabled: input.enabled ?? true,
    })
    .returning()

  if (input.productScopeId) {
    await setEntityProductScope(input.projectId, 'knowledge_source', source.id, input.productScopeId)
  }

  // Generate embeddings inline when content is available and not skipping
  if (hasContent && !skipProcessing) {
    await embedKnowledgeSourceInline(
      source.id,
      input.projectId,
      input.analyzedContent!,
      'knowledge-service.createAdmin'
    )
  }

  // Non-blocking graph eval (skip if processing will be done by workflow)
  if (!skipProcessing) {
    fireGraphEval(input.projectId, 'knowledge_source', source.id)
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
        source_code_id: s.sourceCodeId ?? null,
        analysis_scope: s.analysisScope ?? null,
        origin: s.origin ?? null,
        status: 'pending' as const,
        enabled: s.enabled ?? true,
      }))
    )
    .returning()

  // Non-blocking graph eval for each source
  for (const source of inserted) {
    fireGraphEval(projectId, 'knowledge_source', source.id)
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
  limit: number = 10
): Promise<SearchKnowledgeResult[]> {
  return searchWithFallback<SearchKnowledgeResult>({
    logPrefix: '[knowledge-service]',
    semanticSearch: async () => {
      const { searchKnowledgeBySourceIds } = await import(
        '@/lib/knowledge/embedding-service'
      )
      const results = await searchKnowledgeBySourceIds(projectId, query, {
        limit,
        similarityThreshold: 0.5,
      })
      return results.map((r) => ({
        id: r.id,
        name: r.sectionHeading ?? 'Knowledge chunk',
        snippet: r.chunkText.slice(0, 200),
        score: r.similarity,
      }))
    },
    textFallback: async () => {
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
