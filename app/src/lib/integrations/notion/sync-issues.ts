/**
 * Notion issue sync service.
 * Syncs pages from a Notion database into the issues table.
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { notionIssueSyncs, notionSyncConfigs } from '@/lib/db/schema/app'
import { getNotionSyncConfig, getNotionCredentials } from '@/lib/integrations/notion'
import { NotionClient } from './client'
import type { NotionPage } from './client'
import { extractPropertyValue } from './property-mapper'
import { blocksToMarkdown } from './blocks-to-markdown'
import { createIssueAdmin, updateIssueAdmin } from '@/lib/issues/issues-service'
import { calculateNextSyncTime, type SyncFrequency } from '@/lib/integrations/shared/sync-utils'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface SyncProgressEvent {
  type: 'progress' | 'complete' | 'error'
  message: string
  processed?: number
  total?: number
  created?: number
  updated?: number
  skipped?: number
}

// ---------------------------------------------------------------------------
// Field mapping types (matches the flat shape sent by the UI)
// ---------------------------------------------------------------------------

interface NotionFieldMapping {
  title: string // Notion property name
  description?: string
  type?: string // Notion property name for type
  typeValueMap?: Record<string, string>
  priority?: string // Notion property name for priority
  priorityValueMap?: Record<string, string>
  status?: string // Notion property name for status
  statusValueMap?: Record<string, string>
  customFields?: string[] // Notion property names
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set(['bug', 'feature_request', 'change_request'])
const VALID_PRIORITIES = new Set(['low', 'medium', 'high'])
const VALID_STATUSES = new Set(['open', 'ready', 'in_progress', 'resolved', 'closed'])

/**
 * Find a property in a Notion page by its name.
 * Notion API returns properties keyed by their name.
 */
function findPropertyByName(
  properties: Record<string, unknown>,
  propertyName: string
): Record<string, unknown> | null {
  const prop = properties[propertyName]
  return prop ? (prop as Record<string, unknown>) : null
}

/**
 * Extract a string value from a Notion property by property name.
 */
function extractStringByPropertyName(
  properties: Record<string, unknown>,
  propertyName: string
): string {
  const prop = findPropertyByName(properties, propertyName)
  if (!prop) return ''
  const val = extractPropertyValue(prop)
  if (Array.isArray(val)) return val.join(', ')
  return val != null ? String(val) : ''
}

/**
 * Map a Notion property value through a valueMap, falling back to a default.
 */
function mapPropertyValue(
  properties: Record<string, unknown>,
  propertyName: string | undefined,
  valueMap: Record<string, string> | undefined,
  defaultValue: string,
  validValues: Set<string>
): string {
  if (!propertyName) return defaultValue

  const rawValue = extractStringByPropertyName(properties, propertyName)
  if (!rawValue) return defaultValue

  // Try to find a mapped value
  if (valueMap) {
    const mapped = valueMap[rawValue]
    if (mapped && validValues.has(mapped)) return mapped
  }

  // Try the raw value directly (case-insensitive)
  const normalized = rawValue.toLowerCase().replace(/\s+/g, '_')
  if (validValues.has(normalized)) return normalized

  return defaultValue
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Sync issues from Notion database into the issues table.
 */
export async function syncNotionIssues(
  projectId: string,
  onProgress?: (event: SyncProgressEvent) => void
): Promise<void> {
  const config = await getNotionSyncConfig(projectId, 'issues')
  if (!config) {
    throw new Error('Notion issue sync is not configured for this project')
  }

  const credentials = await getNotionCredentials(projectId)
  if (!credentials) {
    throw new Error('Notion is not connected for this project')
  }

  const fieldMapping = (config.field_mapping as Record<string, unknown> | null) as NotionFieldMapping | null
  if (!fieldMapping?.title) {
    throw new Error('Field mapping is not configured - at least a title mapping is required')
  }

  const databaseId = config.notion_database_id
  if (!databaseId) {
    throw new Error('No Notion database selected for issue sync')
  }

  // Update sync status to in_progress
  await db
    .update(notionSyncConfigs)
    .set({ last_sync_status: 'in_progress', updated_at: new Date() })
    .where(eq(notionSyncConfigs.id, config.id))

  let created = 0
  let updated = 0
  let skipped = 0

  try {
    const client = new NotionClient(credentials.accessToken)
    const pages = await client.getAllDatabasePages(databaseId)

    onProgress?.({
      type: 'progress',
      message: `Fetched ${pages.length} items from Notion`,
      total: pages.length,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    })

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i] as NotionPage
      const notionPageId = page.id
      const properties = page.properties as Record<string, unknown>

      // Check if this page already exists in our sync tracking
      const existingSync = await db
        .select()
        .from(notionIssueSyncs)
        .where(
          and(
            eq(notionIssueSyncs.connection_id, credentials.connectionId),
            eq(notionIssueSyncs.notion_page_id, notionPageId)
          )
        )

      const existingRow = existingSync[0]

      // Extract field values from the Notion page
      const title = extractStringByPropertyName(properties, fieldMapping.title) || 'Untitled'

      // Description: try mapped property first, fall back to page body content
      let description = fieldMapping.description
        ? extractStringByPropertyName(properties, fieldMapping.description)
        : ''
      if (!description) {
        const blocks = await client.getAllPageBlocks(notionPageId, 5)
        description = blocksToMarkdown(blocks)
      }

      const issueType = mapPropertyValue(properties, fieldMapping.type, fieldMapping.typeValueMap, 'feature_request', VALID_TYPES) as
        'bug' | 'feature_request' | 'change_request'
      const priority = mapPropertyValue(properties, fieldMapping.priority, fieldMapping.priorityValueMap, 'medium', VALID_PRIORITIES) as
        'low' | 'medium' | 'high'
      const status = mapPropertyValue(properties, fieldMapping.status, fieldMapping.statusValueMap, 'open', VALID_STATUSES) as
        'open' | 'ready' | 'in_progress' | 'resolved' | 'closed'

      // Build custom fields
      const customFields: Record<string, unknown> = {}
      if (fieldMapping.customFields) {
        for (const propName of fieldMapping.customFields) {
          const val = extractStringByPropertyName(properties, propName)
          if (val !== '') {
            customFields[propName.toLowerCase().replace(/[^a-z0-9_]/g, '_')] = val
          }
        }
      }

      const lastEditedTime = new Date(page.last_edited_time)

      if (!existingRow) {
        // New issue - create via service layer (handles embeddings + graph eval)
        const { issue } = await createIssueAdmin({
          projectId,
          type: issueType,
          title,
          description,
          priority,
          status,
          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
        })

        await db.insert(notionIssueSyncs).values({
          connection_id: credentials.connectionId,
          issue_id: issue.id,
          notion_page_id: notionPageId,
          notion_page_url: page.url,
          last_notion_edited_time: lastEditedTime,
          last_synced_at: new Date(),
        })

        created++
      } else if (
        !existingRow.last_notion_edited_time ||
        existingRow.last_notion_edited_time.getTime() !== lastEditedTime.getTime()
      ) {
        // Existing but changed - update via service layer (handles embeddings + graph eval)
        await updateIssueAdmin(existingRow.issue_id, projectId, {
          title,
          description,
          type: issueType,
          priority,
          status,
          custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined,
        })

        await db
          .update(notionIssueSyncs)
          .set({
            last_notion_edited_time: lastEditedTime,
            last_synced_at: new Date(),
          })
          .where(eq(notionIssueSyncs.id, existingRow.id))

        updated++
      } else {
        // Unchanged
        skipped++
      }

      // Report progress every 10 items
      if ((i + 1) % 10 === 0 || i === pages.length - 1) {
        onProgress?.({
          type: 'progress',
          message: `Processed ${i + 1} of ${pages.length} items`,
          processed: i + 1,
          total: pages.length,
          created,
          updated,
          skipped,
        })
      }
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
        last_sync_count: pages.length,
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .where(eq(notionSyncConfigs.id, config.id))

    onProgress?.({
      type: 'complete',
      message: `Sync complete: ${created} created, ${updated} updated, ${skipped} skipped`,
      processed: pages.length,
      total: pages.length,
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
      message: `Sync failed: ${errorMessage}`,
    })

    throw error
  }
}
