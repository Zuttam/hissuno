/**
 * Notion integration service layer.
 * Handles database operations for Notion connections.
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { notionConnections, notionSyncConfigs } from '@/lib/db/schema/app'
import { calculateNextSyncTime, type SyncFrequency } from '@/lib/integrations/shared/sync-utils'

export interface NotionIntegrationStatus {
  connected: boolean
  workspaceId: string | null
  workspaceName: string | null
  authMethod: 'oauth' | 'token' | null
}

/**
 * Check if a project has Notion integration connected.
 */
export async function hasNotionConnection(
  projectId: string
): Promise<NotionIntegrationStatus> {
  const rows = await db
    .select({
      workspace_id: notionConnections.workspace_id,
      workspace_name: notionConnections.workspace_name,
      auth_method: notionConnections.auth_method,
    })
    .from(notionConnections)
    .where(eq(notionConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      workspaceId: null,
      workspaceName: null,
      authMethod: null,
    }
  }

  return {
    connected: true,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name,
    authMethod: data.auth_method as 'oauth' | 'token',
  }
}

/**
 * Get the access token for a project's Notion connection.
 */
export async function getNotionCredentials(
  projectId: string
): Promise<{ connectionId: string; accessToken: string; workspaceId: string } | null> {
  const rows = await db
    .select({
      id: notionConnections.id,
      access_token: notionConnections.access_token,
      workspace_id: notionConnections.workspace_id,
    })
    .from(notionConnections)
    .where(eq(notionConnections.project_id, projectId))

  const data = rows[0]
  if (!data) return null

  return {
    connectionId: data.id,
    accessToken: data.access_token,
    workspaceId: data.workspace_id,
  }
}

/**
 * Store Notion credentials after OAuth flow.
 * Uses upsert (onConflictDoUpdate on project_id).
 */
export async function storeNotionCredentials(params: {
  projectId: string
  accessToken: string
  workspaceId: string
  workspaceName: string | null
  workspaceIcon?: string | null
  botId: string | null
  installedByUserId: string | null
}): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  try {
    const values = {
      project_id: params.projectId,
      access_token: params.accessToken,
      workspace_id: params.workspaceId,
      workspace_name: params.workspaceName,
      workspace_icon: params.workspaceIcon ?? null,
      bot_id: params.botId,
      auth_method: params.workspaceId === 'token' ? 'token' as const : 'oauth' as const,
      installed_by_user_id: params.installedByUserId,
      updated_at: new Date(),
    }

    const inserted = await db
      .insert(notionConnections)
      .values(values)
      .onConflictDoUpdate({
        target: notionConnections.project_id,
        set: values,
      })
      .returning({ id: notionConnections.id })

    const data = inserted[0]
    if (!data) {
      return { success: false, error: 'Failed to store Notion credentials.' }
    }

    return { success: true, connectionId: data.id }
  } catch (error) {
    console.error('[notion.storeNotionCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Notion credentials.' }
  }
}

/**
 * Store a Notion Internal Integration Token for a project.
 * Delegates to storeNotionCredentials with workspace_id='token'.
 */
export async function storeNotionToken(params: {
  projectId: string
  accessToken: string
  workspaceName: string | null
  botId: string | null
  installedByUserId: string | null
}): Promise<{ success: boolean; error?: string }> {
  return storeNotionCredentials({
    ...params,
    workspaceId: 'token',
  })
}

/**
 * Disconnect Notion integration.
 */
export async function disconnectNotion(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(notionConnections)
      .where(eq(notionConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[notion.disconnectNotion] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Notion.' }
  }
}

// ---------------------------------------------------------------------------
// Sync Config CRUD
// ---------------------------------------------------------------------------

export type NotionSyncType = 'issues' | 'knowledge'

export type NotionSyncConfigRow = typeof notionSyncConfigs.$inferSelect

/**
 * Fetch a single sync config for a project + sync type.
 */
export async function getNotionSyncConfig(
  projectId: string,
  syncType: NotionSyncType
): Promise<NotionSyncConfigRow | null> {
  const rows = await db
    .select()
    .from(notionSyncConfigs)
    .where(
      and(
        eq(notionSyncConfigs.project_id, projectId),
        eq(notionSyncConfigs.sync_type, syncType)
      )
    )

  return rows[0] ?? null
}

/**
 * Upsert a sync config. Uses onConflictDoUpdate on (connection_id, sync_type).
 */
export async function upsertNotionSyncConfig(params: {
  projectId: string
  connectionId: string
  syncType: NotionSyncType
  notionDatabaseId?: string | null
  notionDatabaseName?: string | null
  fieldMapping?: Record<string, unknown> | null
  notionRootPageIds?: string[] | null
  includeChildren?: boolean
  syncEnabled?: boolean
  syncFrequency?: SyncFrequency
}): Promise<NotionSyncConfigRow> {
  const frequency = params.syncFrequency ?? 'manual'
  const syncEnabled = params.syncEnabled ?? (frequency !== 'manual')
  const nextSyncAt = calculateNextSyncTime(frequency)

  const values = {
    connection_id: params.connectionId,
    project_id: params.projectId,
    sync_type: params.syncType,
    notion_database_id: params.notionDatabaseId ?? null,
    notion_database_name: params.notionDatabaseName ?? null,
    field_mapping: params.fieldMapping ?? null,
    notion_root_page_ids: params.notionRootPageIds ?? null,
    include_children: params.includeChildren ?? true,
    sync_enabled: syncEnabled,
    sync_frequency: frequency,
    next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
    updated_at: new Date(),
  }

  const [row] = await db
    .insert(notionSyncConfigs)
    .values(values)
    .onConflictDoUpdate({
      target: [notionSyncConfigs.connection_id, notionSyncConfigs.sync_type],
      set: {
        notion_database_id: values.notion_database_id,
        notion_database_name: values.notion_database_name,
        field_mapping: values.field_mapping,
        notion_root_page_ids: values.notion_root_page_ids,
        include_children: values.include_children,
        sync_enabled: values.sync_enabled,
        sync_frequency: values.sync_frequency,
        next_sync_at: values.next_sync_at,
        updated_at: values.updated_at,
      },
    })
    .returning()

  if (!row) {
    throw new Error('Failed to upsert Notion sync config')
  }

  return row
}

/**
 * Delete a sync config for a project + sync type.
 */
export async function deleteNotionSyncConfig(
  projectId: string,
  syncType: NotionSyncType
): Promise<void> {
  await db
    .delete(notionSyncConfigs)
    .where(
      and(
        eq(notionSyncConfigs.project_id, projectId),
        eq(notionSyncConfigs.sync_type, syncType)
      )
    )
}
