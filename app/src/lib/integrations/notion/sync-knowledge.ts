/**
 * Notion knowledge sync service.
 * Syncs pages from Notion into the knowledge_sources table.
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { notionSyncConfigs, knowledgeSources } from '@/lib/db/schema/app'
import { getNotionSyncConfig, getNotionCredentials } from './index'
import {
  createKnowledgeSourceAdmin,
  updateKnowledgeSourceAdmin,
} from '@/lib/knowledge/knowledge-service'
import { NotionClient } from './client'
import type { NotionPage } from './client'
import { blocksToMarkdown } from './blocks-to-markdown'
import { calculateNextSyncTime, type SyncFrequency } from '@/lib/integrations/shared/sync-utils'
import type { SyncProgressEvent } from './sync-issues'

import { triggerSourceAnalysisBatch } from '@/lib/knowledge/analysis-service'

// Re-export so callers can import from either file
export type { SyncProgressEvent }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the page title from a Notion page's properties.
 */
function extractPageTitle(page: NotionPage): string {
  const properties = page.properties as Record<string, Record<string, unknown>>
  for (const prop of Object.values(properties)) {
    if (prop.type === 'title') {
      const titleArray = prop.title as Array<{ plain_text: string }> | undefined
      if (titleArray && titleArray.length > 0) {
        return titleArray.map((t) => t.plain_text).join('')
      }
    }
  }
  return 'Untitled'
}

interface ProcessResult {
  outcome: 'created' | 'updated' | 'skipped'
  /** Block IDs of child_page blocks found within this page */
  childPageIds: string[]
  /** ID of the created/updated knowledge source (for triggering analysis) */
  sourceId: string
}

/**
 * Process a single Notion page: fetch its blocks, convert to markdown,
 * and upsert into knowledge_sources.
 * Returns the outcome, source ID (for triggering analysis), and child_page block IDs.
 */
async function processKnowledgePage(
  client: NotionClient,
  page: NotionPage,
  projectId: string
): Promise<ProcessResult> {
  const notionPageId = page.id
  const lastEditedTime = new Date(page.last_edited_time)

  // Check for existing knowledge source with this notion_page_id
  const existing = await db
    .select({
      id: knowledgeSources.id,
      updated_at: knowledgeSources.updated_at,
      status: knowledgeSources.status,
    })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.project_id, projectId),
        eq(knowledgeSources.notion_page_id, notionPageId)
      )
    )

  const existingRow = existing[0]

  // Fetch blocks once - needed by all paths for child page discovery + content
  const blocks = await client.getAllPageBlocks(notionPageId)
  const childPageIds = blocks
    .filter((b) => b.type === 'child_page')
    .map((b) => b.id)

  if (existingRow) {
    // Check if the page has been edited since last sync
    const existingUpdated = existingRow.updated_at
    if (
      existingUpdated &&
      existingUpdated.getTime() >= lastEditedTime.getTime() &&
      existingRow.status !== 'error'
    ) {
      return { outcome: 'skipped', childPageIds, sourceId: existingRow.id }
    }

    // Page changed - convert and update
    const markdown = blocksToMarkdown(blocks)

    await updateKnowledgeSourceAdmin(existingRow.id, projectId, {
      name: extractPageTitle(page),
      url: page.url,
      analyzedContent: markdown,
      status: 'pending',
    })

    return { outcome: 'updated', childPageIds, sourceId: existingRow.id }
  }

  // New page - convert and insert with skipInlineProcessing
  const markdown = blocksToMarkdown(blocks)

  const source = await createKnowledgeSourceAdmin({
    projectId,
    type: 'notion',
    notionPageId,
    name: extractPageTitle(page),
    url: page.url,
    analyzedContent: markdown,
    origin: 'notion_sync',
    skipInlineProcessing: true,
  })

  return { outcome: 'created', childPageIds, sourceId: source.id }
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Sync knowledge from Notion pages into the knowledge_sources table.
 */
export async function syncNotionKnowledge(
  projectId: string,
  onProgress?: (event: SyncProgressEvent) => void
): Promise<void> {
  const config = await getNotionSyncConfig(projectId, 'knowledge')
  if (!config) {
    throw new Error('Notion knowledge sync is not configured for this project')
  }

  const credentials = await getNotionCredentials(projectId)
  if (!credentials) {
    throw new Error('Notion is not connected for this project')
  }

  const rootPageIds = (config.notion_root_page_ids as string[] | null) ?? []
  if (rootPageIds.length === 0) {
    throw new Error('No root pages configured for knowledge sync')
  }

  const includeChildren = config.include_children ?? true

  // Update sync status to in_progress
  await db
    .update(notionSyncConfigs)
    .set({ last_sync_status: 'in_progress', updated_at: new Date() })
    .where(eq(notionSyncConfigs.id, config.id))

  let created = 0
  let updated = 0
  let skipped = 0
  let processed = 0
  let totalEstimate = rootPageIds.length
  const sourceIdsToAnalyze: string[] = []

  try {
    const client = new NotionClient(credentials.accessToken)

    onProgress?.({
      type: 'progress',
      message: `Starting knowledge sync for ${rootPageIds.length} root page(s)`,
      processed: 0,
      total: totalEstimate,
      created: 0,
      updated: 0,
      skipped: 0,
    })

    for (const pageId of rootPageIds) {
      let page: NotionPage
      try {
        page = await client.getPage(pageId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        onProgress?.({
          type: 'progress',
          message: `Failed to fetch page ${pageId}: ${msg}`,
          processed,
          total: totalEstimate,
          created,
          updated,
          skipped,
        })
        continue
      }

      // Process the root page itself
      let childPageIds: string[] = []
      try {
        const result = await processKnowledgePage(client, page, projectId)
        if (result.outcome === 'created') created++
        else if (result.outcome === 'updated') updated++
        else skipped++
        childPageIds = result.childPageIds
        if (result.outcome !== 'skipped') {
          sourceIdsToAnalyze.push(result.sourceId)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        onProgress?.({
          type: 'progress',
          message: `Error processing page "${extractPageTitle(page)}": ${msg}`,
          processed,
          total: totalEstimate,
          created,
          updated,
          skipped,
        })
      }

      processed++

      // If include_children, sync child pages found in the page's blocks
      // and also try querying as a database (for database-type parents)
      if (includeChildren) {
        const childPages: NotionPage[] = []

        // 1. Collect child pages found as child_page blocks (regular pages)
        for (const childId of childPageIds) {
          try {
            const childPage = await client.getPage(childId)
            childPages.push(childPage)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            onProgress?.({
              type: 'progress',
              message: `Failed to fetch child page ${childId}: ${msg}`,
              processed,
              total: totalEstimate,
              created,
              updated,
              skipped,
            })
          }
        }

        // 2. Also try querying as a database (for database-type parents)
        try {
          const dbResponse = await client.getDatabasePages(pageId)
          const dbChildIds = new Set(childPages.map((p) => p.id))
          for (const dbPage of dbResponse.results) {
            if (!dbChildIds.has(dbPage.id)) {
              childPages.push(dbPage)
            }
          }
        } catch {
          // Not a database - expected for regular pages
        }

        if (childPages.length > 0) {
          totalEstimate += childPages.length

          onProgress?.({
            type: 'progress',
            message: `Found ${childPages.length} child page(s) under "${extractPageTitle(page)}"`,
            processed,
            total: totalEstimate,
            created,
            updated,
            skipped,
          })

          for (const childPage of childPages) {
            try {
              const result = await processKnowledgePage(client, childPage, projectId)
              if (result.outcome === 'created') created++
              else if (result.outcome === 'updated') updated++
              else skipped++
              if (result.outcome !== 'skipped') {
                sourceIdsToAnalyze.push(result.sourceId)
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error'
              onProgress?.({
                type: 'progress',
                message: `Error processing child page: ${msg}`,
                processed,
                total: totalEstimate,
                created,
                updated,
                skipped,
              })
            }

            processed++

            // Report progress every 10 items
            if (processed % 10 === 0) {
              onProgress?.({
                type: 'progress',
                message: `Processed ${processed} of ~${totalEstimate} pages`,
                processed,
                total: totalEstimate,
                created,
                updated,
                skipped,
              })
            }
          }
        }
      }

      // Report progress after each root page
      onProgress?.({
        type: 'progress',
        message: `Processed ${processed} of ~${totalEstimate} pages`,
        processed,
        total: totalEstimate,
        created,
        updated,
        skipped,
      })
    }

    // Trigger analysis for all new/updated sources (fire-and-forget)
    if (sourceIdsToAnalyze.length > 0) {
      onProgress?.({
        type: 'progress',
        message: `Triggering analysis for ${sourceIdsToAnalyze.length} source(s)...`,
        processed,
        total: totalEstimate,
        created,
        updated,
        skipped,
      })

      // Run in background - don't block the sync completion
      triggerSourceAnalysisBatch(projectId, sourceIdsToAnalyze).catch((err) => {
        console.error('[sync-knowledge] Background analysis failed:', err)
      })
    }

    // Update sync config with results
    const syncFrequency = (config.sync_frequency || 'manual') as SyncFrequency
    const nextSyncAt = calculateNextSyncTime(syncFrequency)

    await db
      .update(notionSyncConfigs)
      .set({
        last_sync_at: new Date(),
        last_sync_status: 'completed',
        last_sync_error: null,
        last_sync_count: created + updated + skipped,
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .where(eq(notionSyncConfigs.id, config.id))

    onProgress?.({
      type: 'complete',
      message: `Knowledge sync complete: ${created} created, ${updated} updated, ${skipped} skipped`,
      processed,
      total: totalEstimate,
      created,
      updated,
      skipped,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'

    await db
      .update(notionSyncConfigs)
      .set({
        last_sync_status: 'error',
        last_sync_error: errorMessage,
        updated_at: new Date(),
      })
      .where(eq(notionSyncConfigs.id, config.id))

    onProgress?.({
      type: 'error',
      message: `Knowledge sync failed: ${errorMessage}`,
    })

    throw error
  }
}
