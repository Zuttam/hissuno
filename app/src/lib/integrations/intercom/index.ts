/**
 * Intercom integration service layer.
 * Handles database operations for Intercom connections and sync tracking.
 */

import { db } from '@/lib/db'
import { eq, and, or, ne, lte, isNull, sql, count as drizzleCount } from 'drizzle-orm'
import { intercomConnections, intercomSyncRuns, intercomSyncedConversations } from '@/lib/db/schema/app'
import { type SyncFrequency } from '@/lib/integrations/shared/sync-constants'
export type { SyncFrequency }
import { calculateNextSyncTime } from '@/lib/integrations/shared/sync-utils'

/**
 * Filter configuration for sync
 */
export interface IntercomFilterConfig {
  fromDate?: string // ISO date string
  toDate?: string // ISO date string
}

/**
 * Intercom connection record
 */
export interface IntercomConnection {
  id: string
  projectId: string
  workspaceId: string
  workspaceName: string | null
  syncFrequency: SyncFrequency
  syncEnabled: boolean
  filterConfig: IntercomFilterConfig
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null
  lastSyncError: string | null
  lastSyncConversationsCount: number
  nextSyncAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Intercom integration status
 */
export type IntercomAuthMethod = 'token' | 'oauth'

export interface IntercomIntegrationStatus {
  connected: boolean
  workspaceId: string | null
  workspaceName: string | null
  authMethod: IntercomAuthMethod | null
  syncFrequency: SyncFrequency | null
  syncEnabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null
  lastSyncConversationsCount: number
  nextSyncAt: string | null
  filterConfig: IntercomFilterConfig | null
}

/**
 * Check if a project has Intercom integration connected
 */
export async function hasIntercomConnection(
  projectId: string
): Promise<IntercomIntegrationStatus> {
  const rows = await db
    .select({
      workspace_id: intercomConnections.workspace_id,
      workspace_name: intercomConnections.workspace_name,
      auth_method: intercomConnections.auth_method,
      sync_frequency: intercomConnections.sync_frequency,
      sync_enabled: intercomConnections.sync_enabled,
      filter_config: intercomConnections.filter_config,
      last_sync_at: intercomConnections.last_sync_at,
      last_sync_status: intercomConnections.last_sync_status,
      last_sync_conversations_count: intercomConnections.last_sync_conversations_count,
      next_sync_at: intercomConnections.next_sync_at,
    })
    .from(intercomConnections)
    .where(eq(intercomConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      workspaceId: null,
      workspaceName: null,
      authMethod: null,
      syncFrequency: null,
      syncEnabled: false,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncConversationsCount: 0,
      nextSyncAt: null,
      filterConfig: null,
    }
  }

  return {
    connected: true,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name,
    authMethod: (data.auth_method as IntercomAuthMethod) || 'token',
    syncFrequency: data.sync_frequency as SyncFrequency,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
    lastSyncStatus: data.last_sync_status as 'success' | 'error' | 'in_progress' | null,
    lastSyncConversationsCount: data.last_sync_conversations_count || 0,
    nextSyncAt: data.next_sync_at?.toISOString() ?? null,
    filterConfig: (data.filter_config as IntercomFilterConfig) || null,
  }
}

/**
 * Get the connection ID and token for a project
 */
export async function getIntercomCredentials(
  projectId: string
): Promise<{ connectionId: string; accessToken: string; workspaceId: string; lastSyncAt: string | null } | null> {
  const rows = await db
    .select({
      id: intercomConnections.id,
      access_token: intercomConnections.access_token,
      workspace_id: intercomConnections.workspace_id,
      last_sync_at: intercomConnections.last_sync_at,
    })
    .from(intercomConnections)
    .where(eq(intercomConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    connectionId: data.id,
    accessToken: data.access_token,
    workspaceId: data.workspace_id,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
  }
}

/**
 * Store Intercom credentials after validation
 */
export async function storeIntercomCredentials(
  params: {
    projectId: string
    accessToken: string
    workspaceId: string
    workspaceName: string | null
    syncFrequency: SyncFrequency
    filterConfig?: IntercomFilterConfig
    authMethod?: IntercomAuthMethod
  }
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  try {
    const inserted = await db
      .insert(intercomConnections)
      .values({
        project_id: params.projectId,
        access_token: params.accessToken,
        workspace_id: params.workspaceId,
        workspace_name: params.workspaceName,
        auth_method: params.authMethod || 'token',
        sync_frequency: params.syncFrequency,
        sync_enabled: params.syncFrequency !== 'manual',
        filter_config: params.filterConfig || {},
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: intercomConnections.project_id,
        set: {
          access_token: params.accessToken,
          workspace_id: params.workspaceId,
          workspace_name: params.workspaceName,
          auth_method: params.authMethod || 'token',
          sync_frequency: params.syncFrequency,
          sync_enabled: params.syncFrequency !== 'manual',
          filter_config: params.filterConfig || {},
          next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
          updated_at: new Date(),
        },
      })
      .returning({ id: intercomConnections.id })

    const data = inserted[0]
    if (!data) {
      return { success: false, error: 'Failed to store Intercom credentials.' }
    }

    return { success: true, connectionId: data.id }
  } catch (error) {
    console.error('[intercom.storeIntercomCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Intercom credentials.' }
  }
}

/**
 * Update Intercom sync settings
 */
export async function updateIntercomSettings(
  projectId: string,
  settings: {
    syncFrequency?: SyncFrequency
    syncEnabled?: boolean
    filterConfig?: IntercomFilterConfig
  }
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    updated_at: new Date(),
  }

  if (settings.syncFrequency !== undefined) {
    updateData.sync_frequency = settings.syncFrequency
    const nextSync = calculateNextSyncTime(settings.syncFrequency)
    updateData.next_sync_at = nextSync ? new Date(nextSync) : null
    if (settings.syncEnabled === undefined) {
      updateData.sync_enabled = settings.syncFrequency !== 'manual'
    }
  }

  if (settings.syncEnabled !== undefined) {
    updateData.sync_enabled = settings.syncEnabled
  }

  if (settings.filterConfig !== undefined) {
    updateData.filter_config = settings.filterConfig
  }

  try {
    await db
      .update(intercomConnections)
      .set(updateData)
      .where(eq(intercomConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[intercom.updateIntercomSettings] Failed:', error)
    return { success: false, error: 'Failed to update Intercom settings.' }
  }
}

/**
 * Disconnect Intercom integration
 */
export async function disconnectIntercom(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(intercomConnections)
      .where(eq(intercomConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[intercom.disconnectIntercom] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Intercom.' }
  }
}

/**
 * Clear all synced conversation records for a connection.
 * Used by "start from scratch" sync mode.
 */
export async function clearSyncedConversations(
  connectionId: string
): Promise<void> {
  try {
    await db
      .delete(intercomSyncedConversations)
      .where(eq(intercomSyncedConversations.connection_id, connectionId))
  } catch (error) {
    console.error('[intercom.clearSyncedConversations] Failed:', error)
    throw new Error('Failed to clear synced conversations.')
  }
}

/**
 * Check if a conversation has already been synced
 */
export async function isConversationSynced(
  connectionId: string,
  intercomConversationId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: intercomSyncedConversations.id })
    .from(intercomSyncedConversations)
    .where(
      and(
        eq(intercomSyncedConversations.connection_id, connectionId),
        eq(intercomSyncedConversations.intercom_conversation_id, intercomConversationId)
      )
    )

  return rows.length > 0
}

/**
 * Get all synced conversation IDs for a connection (batch pre-fetch to avoid N+1)
 */
export async function getSyncedConversationIds(
  connectionId: string
): Promise<Set<string>> {
  const rows = await db
    .select({ intercom_conversation_id: intercomSyncedConversations.intercom_conversation_id })
    .from(intercomSyncedConversations)
    .where(eq(intercomSyncedConversations.connection_id, connectionId))

  return new Set(rows.map((row) => row.intercom_conversation_id))
}

/**
 * Record a synced conversation
 */
export async function recordSyncedConversation(
  params: {
    connectionId: string
    intercomConversationId: string
    sessionId: string
    conversationCreatedAt?: string
    conversationUpdatedAt?: string
    partsCount: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(intercomSyncedConversations).values({
      connection_id: params.connectionId,
      intercom_conversation_id: params.intercomConversationId,
      session_id: params.sessionId,
      conversation_created_at: params.conversationCreatedAt ? new Date(params.conversationCreatedAt) : null,
      conversation_updated_at: params.conversationUpdatedAt ? new Date(params.conversationUpdatedAt) : null,
      parts_count: params.partsCount,
    })

    return { success: true }
  } catch (error) {
    console.error('[intercom.recordSyncedConversation] Failed:', error)
    return { success: false, error: 'Failed to record synced conversation.' }
  }
}

/**
 * Update sync state after a sync operation
 */
export async function updateSyncState(
  projectId: string,
  state: {
    status: 'success' | 'error' | 'in_progress'
    conversationsCount?: number
    error?: string
  }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    last_sync_status: state.status,
    updated_at: new Date(),
  }

  if (state.status === 'success' || state.status === 'error') {
    updateData.last_sync_at = new Date()

    const connRows = await db
      .select({ sync_frequency: intercomConnections.sync_frequency })
      .from(intercomConnections)
      .where(eq(intercomConnections.project_id, projectId))

    const conn = connRows[0]
    if (conn) {
      const nextSync = calculateNextSyncTime(conn.sync_frequency as SyncFrequency)
      updateData.next_sync_at = nextSync ? new Date(nextSync) : null
    }
  }

  if (state.conversationsCount !== undefined) {
    updateData.last_sync_conversations_count = state.conversationsCount
  }

  if (state.error) {
    updateData.last_sync_error = state.error
  } else if (state.status === 'success') {
    updateData.last_sync_error = null
  }

  await db
    .update(intercomConnections)
    .set(updateData)
    .where(eq(intercomConnections.project_id, projectId))
}

/**
 * Create a sync run record
 */
export async function createSyncRun(
  connectionId: string,
  triggeredBy: 'manual' | 'cron'
): Promise<{ runId: string } | null> {
  try {
    const inserted = await db
      .insert(intercomSyncRuns)
      .values({
        connection_id: connectionId,
        triggered_by: triggeredBy,
        status: 'in_progress',
      })
      .returning({ id: intercomSyncRuns.id })

    const data = inserted[0]
    if (!data) {
      return null
    }

    return { runId: data.id }
  } catch (error) {
    console.error('[intercom.createSyncRun] Failed:', error)
    return null
  }
}

/**
 * Complete a sync run
 */
export async function completeSyncRun(
  runId: string,
  result: {
    status: 'success' | 'error'
    conversationsFound: number
    conversationsSynced: number
    conversationsSkipped: number
    errorMessage?: string
  }
): Promise<void> {
  await db
    .update(intercomSyncRuns)
    .set({
      status: result.status,
      conversations_found: result.conversationsFound,
      conversations_synced: result.conversationsSynced,
      conversations_skipped: result.conversationsSkipped,
      error_message: result.errorMessage,
      completed_at: new Date(),
    })
    .where(eq(intercomSyncRuns.id, runId))
}

/**
 * Get connections that are due for sync
 */
export async function getConnectionsDueForSync(): Promise<Array<{ id: string; projectId: string }>> {
  const now = new Date()

  const rows = await db
    .select({ id: intercomConnections.id, project_id: intercomConnections.project_id })
    .from(intercomConnections)
    .where(
      and(
        eq(intercomConnections.sync_enabled, true),
        ne(intercomConnections.sync_frequency, 'manual'),
        lte(intercomConnections.next_sync_at, now),
        or(isNull(intercomConnections.last_sync_status), ne(intercomConnections.last_sync_status, 'in_progress'))
      )
    )

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
  }))
}

/**
 * Get sync statistics for a connection
 */
export async function getSyncStats(
  projectId: string
): Promise<{ totalSynced: number; lastSyncRuns: Array<{ status: string; startedAt: string; conversationsSynced: number }> }> {
  const connRows = await db
    .select({ id: intercomConnections.id })
    .from(intercomConnections)
    .where(eq(intercomConnections.project_id, projectId))

  const connection = connRows[0]

  if (!connection) {
    return { totalSynced: 0, lastSyncRuns: [] }
  }

  const countRows = await db
    .select({ count: drizzleCount() })
    .from(intercomSyncedConversations)
    .where(eq(intercomSyncedConversations.connection_id, connection.id))

  const totalSynced = countRows[0]?.count ?? 0

  const runs = await db
    .select({
      status: intercomSyncRuns.status,
      started_at: intercomSyncRuns.started_at,
      conversations_synced: intercomSyncRuns.conversations_synced,
    })
    .from(intercomSyncRuns)
    .where(eq(intercomSyncRuns.connection_id, connection.id))
    .orderBy(sql`${intercomSyncRuns.started_at} DESC`)
    .limit(5)

  return {
    totalSynced,
    lastSyncRuns: runs.map((run) => ({
      status: run.status,
      startedAt: run.started_at?.toISOString() ?? '',
      conversationsSynced: run.conversations_synced || 0,
    })),
  }
}

