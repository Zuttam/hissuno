/**
 * Gong integration service layer.
 * Handles database operations for Gong connections and sync tracking.
 */

import { db } from '@/lib/db'
import { eq, and, or, ne, lte, isNull, sql, count as drizzleCount } from 'drizzle-orm'
import { gongConnections, gongSyncRuns, gongSyncedCalls } from '@/lib/db/schema/app'

/**
 * Sync frequency options
 */
export type GongSyncFrequency = 'manual' | '1h' | '6h' | '24h'

/**
 * Filter configuration for sync
 */
export interface GongFilterConfig {
  fromDate?: string // ISO date string
  toDate?: string // ISO date string
}

/**
 * Gong integration status
 */
export interface GongIntegrationStatus {
  connected: boolean
  syncFrequency: GongSyncFrequency | null
  syncEnabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null
  lastSyncError: string | null
  lastSyncCallsCount: number
  nextSyncAt: string | null
  filterConfig: GongFilterConfig | null
}

/**
 * Check if a project has Gong integration connected
 */
export async function hasGongConnection(
  projectId: string
): Promise<GongIntegrationStatus> {
  const rows = await db
    .select({
      sync_frequency: gongConnections.sync_frequency,
      sync_enabled: gongConnections.sync_enabled,
      filter_config: gongConnections.filter_config,
      last_sync_at: gongConnections.last_sync_at,
      last_sync_status: gongConnections.last_sync_status,
      last_sync_error: gongConnections.last_sync_error,
      last_sync_calls_count: gongConnections.last_sync_calls_count,
      next_sync_at: gongConnections.next_sync_at,
    })
    .from(gongConnections)
    .where(eq(gongConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      syncFrequency: null,
      syncEnabled: false,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      lastSyncCallsCount: 0,
      nextSyncAt: null,
      filterConfig: null,
    }
  }

  return {
    connected: true,
    syncFrequency: data.sync_frequency as GongSyncFrequency,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
    lastSyncStatus: data.last_sync_status as 'success' | 'error' | 'in_progress' | null,
    lastSyncError: data.last_sync_error,
    lastSyncCallsCount: data.last_sync_calls_count || 0,
    nextSyncAt: data.next_sync_at?.toISOString() ?? null,
    filterConfig: (data.filter_config as GongFilterConfig) || null,
  }
}

/**
 * Get the connection ID and credentials for a project
 */
export async function getGongCredentials(
  projectId: string
): Promise<{ connectionId: string; accessKey: string; accessKeySecret: string; baseUrl: string; lastSyncAt: string | null } | null> {
  const rows = await db
    .select({
      id: gongConnections.id,
      access_key: gongConnections.access_key,
      access_key_secret: gongConnections.access_key_secret,
      base_url: gongConnections.base_url,
      last_sync_at: gongConnections.last_sync_at,
    })
    .from(gongConnections)
    .where(eq(gongConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    connectionId: data.id,
    accessKey: data.access_key,
    accessKeySecret: data.access_key_secret,
    baseUrl: data.base_url,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
  }
}

/**
 * Store Gong credentials after validation
 */
export async function storeGongCredentials(
  params: {
    projectId: string
    accessKey: string
    accessKeySecret: string
    baseUrl: string
    syncFrequency: GongSyncFrequency
    filterConfig?: GongFilterConfig
  }
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  try {
    const inserted = await db
      .insert(gongConnections)
      .values({
        project_id: params.projectId,
        access_key: params.accessKey,
        access_key_secret: params.accessKeySecret,
        base_url: params.baseUrl,
        sync_frequency: params.syncFrequency,
        sync_enabled: params.syncFrequency !== 'manual',
        filter_config: params.filterConfig || {},
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: gongConnections.project_id,
        set: {
          access_key: params.accessKey,
          access_key_secret: params.accessKeySecret,
          base_url: params.baseUrl,
          sync_frequency: params.syncFrequency,
          sync_enabled: params.syncFrequency !== 'manual',
          filter_config: params.filterConfig || {},
          next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
          updated_at: new Date(),
        },
      })
      .returning({ id: gongConnections.id })

    const data = inserted[0]
    if (!data) {
      return { success: false, error: 'Failed to store Gong credentials.' }
    }

    return { success: true, connectionId: data.id }
  } catch (error) {
    console.error('[gong.storeGongCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Gong credentials.' }
  }
}

/**
 * Update Gong sync settings
 */
export async function updateGongSettings(
  projectId: string,
  settings: {
    syncFrequency?: GongSyncFrequency
    syncEnabled?: boolean
    filterConfig?: GongFilterConfig
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
      .update(gongConnections)
      .set(updateData)
      .where(eq(gongConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[gong.updateGongSettings] Failed:', error)
    return { success: false, error: 'Failed to update Gong settings.' }
  }
}

/**
 * Disconnect Gong integration
 */
export async function disconnectGong(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(gongConnections)
      .where(eq(gongConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[gong.disconnectGong] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Gong.' }
  }
}

/**
 * Clear all synced call records for a connection.
 * Used by "start from scratch" sync mode.
 */
export async function clearSyncedCalls(
  connectionId: string
): Promise<void> {
  try {
    await db
      .delete(gongSyncedCalls)
      .where(eq(gongSyncedCalls.connection_id, connectionId))
  } catch (error) {
    console.error('[gong.clearSyncedCalls] Failed:', error)
    throw new Error('Failed to clear synced calls.')
  }
}

/**
 * Check if a call has already been synced
 */
export async function isCallAlreadySynced(
  connectionId: string,
  gongCallId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: gongSyncedCalls.id })
    .from(gongSyncedCalls)
    .where(
      and(
        eq(gongSyncedCalls.connection_id, connectionId),
        eq(gongSyncedCalls.gong_call_id, gongCallId)
      )
    )

  return rows.length > 0
}

/**
 * Record a synced call
 */
export async function recordSyncedCall(
  params: {
    connectionId: string
    gongCallId: string
    sessionId: string
    callCreatedAt?: string
    callDurationSeconds?: number
    messagesCount: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(gongSyncedCalls).values({
      connection_id: params.connectionId,
      gong_call_id: params.gongCallId,
      session_id: params.sessionId,
      call_created_at: params.callCreatedAt ? new Date(params.callCreatedAt) : null,
      call_duration_seconds: params.callDurationSeconds,
      messages_count: params.messagesCount,
    })

    return { success: true }
  } catch (error) {
    console.error('[gong.recordSyncedCall] Failed:', error)
    return { success: false, error: 'Failed to record synced call.' }
  }
}

/**
 * Update sync state after a sync operation
 */
export async function updateSyncState(
  projectId: string,
  state: {
    status: 'success' | 'error' | 'in_progress'
    callsCount?: number
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
      .select({ sync_frequency: gongConnections.sync_frequency })
      .from(gongConnections)
      .where(eq(gongConnections.project_id, projectId))

    const conn = connRows[0]
    if (conn) {
      const nextSync = calculateNextSyncTime(conn.sync_frequency as GongSyncFrequency)
      updateData.next_sync_at = nextSync ? new Date(nextSync) : null
    }
  }

  if (state.callsCount !== undefined) {
    updateData.last_sync_calls_count = state.callsCount
  }

  if (state.error) {
    updateData.last_sync_error = state.error
  } else if (state.status === 'success') {
    updateData.last_sync_error = null
  }

  await db
    .update(gongConnections)
    .set(updateData)
    .where(eq(gongConnections.project_id, projectId))
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
      .insert(gongSyncRuns)
      .values({
        connection_id: connectionId,
        triggered_by: triggeredBy,
        status: 'in_progress',
      })
      .returning({ id: gongSyncRuns.id })

    const data = inserted[0]
    if (!data) {
      return null
    }

    return { runId: data.id }
  } catch (error) {
    console.error('[gong.createSyncRun] Failed:', error)
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
    callsFound: number
    callsSynced: number
    callsSkipped: number
    errorMessage?: string
  }
): Promise<void> {
  await db
    .update(gongSyncRuns)
    .set({
      status: result.status,
      calls_found: result.callsFound,
      calls_synced: result.callsSynced,
      calls_skipped: result.callsSkipped,
      error_message: result.errorMessage,
      completed_at: new Date(),
    })
    .where(eq(gongSyncRuns.id, runId))
}

/**
 * Get connections that are due for sync
 */
export async function getConnectionsDueForSync(): Promise<Array<{ id: string; projectId: string }>> {
  const now = new Date()

  const rows = await db
    .select({ id: gongConnections.id, project_id: gongConnections.project_id })
    .from(gongConnections)
    .where(
      and(
        eq(gongConnections.sync_enabled, true),
        ne(gongConnections.sync_frequency, 'manual'),
        lte(gongConnections.next_sync_at, now),
        or(isNull(gongConnections.last_sync_status), ne(gongConnections.last_sync_status, 'in_progress'))
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
): Promise<{ totalSynced: number; lastSyncRuns: Array<{ status: string; startedAt: string; callsSynced: number }> }> {
  const connRows = await db
    .select({ id: gongConnections.id })
    .from(gongConnections)
    .where(eq(gongConnections.project_id, projectId))

  const connection = connRows[0]

  if (!connection) {
    return { totalSynced: 0, lastSyncRuns: [] }
  }

  const countRows = await db
    .select({ count: drizzleCount() })
    .from(gongSyncedCalls)
    .where(eq(gongSyncedCalls.connection_id, connection.id))

  const totalSynced = countRows[0]?.count ?? 0

  const runs = await db
    .select({
      status: gongSyncRuns.status,
      started_at: gongSyncRuns.started_at,
      calls_synced: gongSyncRuns.calls_synced,
    })
    .from(gongSyncRuns)
    .where(eq(gongSyncRuns.connection_id, connection.id))
    .orderBy(sql`${gongSyncRuns.started_at} DESC`)
    .limit(5)

  return {
    totalSynced,
    lastSyncRuns: runs.map((run) => ({
      status: run.status,
      startedAt: run.started_at?.toISOString() ?? '',
      callsSynced: run.calls_synced || 0,
    })),
  }
}

/**
 * Calculate next sync time based on frequency
 */
export function calculateNextSyncTime(frequency: GongSyncFrequency): string | null {
  if (frequency === 'manual') {
    return null
  }

  const now = new Date()
  switch (frequency) {
    case '1h':
      now.setHours(now.getHours() + 1)
      break
    case '6h':
      now.setHours(now.getHours() + 6)
      break
    case '24h':
      now.setDate(now.getDate() + 1)
      break
  }

  return now.toISOString()
}
