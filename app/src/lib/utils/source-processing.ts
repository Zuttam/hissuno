import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/db/schema/app'

/**
 * Fire-and-forget: run single-source analysis in the background. Mirrors
 * fireSessionProcessing — non-blocking, never throws. analyzeSource owns its
 * own status transitions (pending/analyzing -> done/failed) and error_message
 * writes, so the wrapper just guards against double-entry and swallows errors.
 */
export function fireSourceAnalysis(sourceId: string, projectId: string) {
  void (async () => {
    try {
      const [src] = await db
        .select()
        .from(knowledgeSources)
        .where(and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.project_id, projectId),
        ))
        .limit(1)

      if (!src) return
      if (src.status === 'analyzing') return

      await db
        .update(knowledgeSources)
        .set({ status: 'analyzing', error_message: null })
        .where(eq(knowledgeSources.id, sourceId))

      const { analyzeSource } = await import('@/lib/knowledge/knowledge-service')
      await analyzeSource({
        projectId,
        sourceId,
        sourceType: src.type as 'website' | 'docs_portal' | 'uploaded_doc' | 'raw_text' | 'notion',
        url: src.url,
        storagePath: src.storage_path,
        content: src.content,
        analysisScope: src.analysis_scope ?? null,
        notionPageId: src.notion_page_id ?? null,
        origin: src.origin ?? null,
        sourceName: src.name ?? null,
      })
    } catch (error) {
      console.error(
        `[fireSourceAnalysis] Error for source ${sourceId}:`,
        error instanceof Error ? error.stack ?? error.message : error,
      )
    }
  })()
}
