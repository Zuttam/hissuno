/**
 * Fathom integration service layer.
 * Handles database operations for Fathom connections and sync tracking.
 */

import { db } from '@/lib/db'
import { eq, and, or, ne, lte, isNull, sql, count as drizzleCount } from 'drizzle-orm'
import { fathomConnections, fathomSyncRuns, fathomSyncedMeetings } from '@/lib/db/schema/app'

/**
 * Sync frequency options
 */
export type FathomSyncFrequency = 'manual' | '1h' | '6h' | '24h'

/**
 * Filter configuration for sync
 */
export interface FathomFilterConfig {
  fromDate?: string // ISO date string
  toDate?: string // ISO date string
}

/**
 * Fathom integration status
 */
export interface FathomIntegrationStatus {
  connected: boolean
  syncFrequency: FathomSyncFrequency | null
  syncEnabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null
  lastSyncError: string | null
  lastSyncMeetingsCount: number
  nextSyncAt: string | null
  filterConfig: FathomFilterConfig | null
}

/**
 * Check if a project has Fathom integration connected
 */
export async function hasFathomConnection(
  projectId: string
): Promise<FathomIntegrationStatus> {
  const rows = await db
    .select({
      sync_frequency: fathomConnections.sync_frequency,
      sync_enabled: fathomConnections.sync_enabled,
      filter_config: fathomConnections.filter_config,
      last_sync_at: fathomConnections.last_sync_at,
      last_sync_status: fathomConnections.last_sync_status,
      last_sync_error: fathomConnections.last_sync_error,
      last_sync_meetings_count: fathomConnections.last_sync_meetings_count,
      next_sync_at: fathomConnections.next_sync_at,
    })
    .from(fathomConnections)
    .where(eq(fathomConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      syncFrequency: null,
      syncEnabled: false,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      lastSyncMeetingsCount: 0,
      nextSyncAt: null,
      filterConfig: null,
    }
  }

  return {
    connected: true,
    syncFrequency: data.sync_frequency as FathomSyncFrequency,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
    lastSyncStatus: data.last_sync_status as 'success' | 'error' | 'in_progress' | null,
    lastSyncError: data.last_sync_error,
    lastSyncMeetingsCount: data.last_sync_meetings_count || 0,
    nextSyncAt: data.next_sync_at?.toISOString() ?? null,
    filterConfig: (data.filter_config as FathomFilterConfig) || null,
  }
}

/**
 * Get the connection ID and credentials for a project
 */
export async function getFathomCredentials(
  projectId: string
): Promise<{ connectionId: string; apiKey: string; lastSyncAt: string | null; filterConfig: FathomFilterConfig | null } | null> {
  const rows = await db
    .select({
      id: fathomConnections.id,
      api_key: fathomConnections.api_key,
      last_sync_at: fathomConnections.last_sync_at,
      filter_config: fathomConnections.filter_config,
    })
    .from(fathomConnections)
    .where(eq(fathomConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    connectionId: data.id,
    apiKey: data.api_key,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
    filterConfig: (data.filter_config as FathomFilterConfig) || null,
  }
}

/**
 * Store Fathom credentials after validation
 */
export async function storeFathomCredentials(
  params: {
    projectId: string
    apiKey: string
    syncFrequency: FathomSyncFrequency
    filterConfig?: FathomFilterConfig
  }
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  try {
    const inserted = await db
      .insert(fathomConnections)
      .values({
        project_id: params.projectId,
        api_key: params.apiKey,
        sync_frequency: params.syncFrequency,
        sync_enabled: params.syncFrequency !== 'manual',
        filter_config: params.filterConfig || {},
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: fathomConnections.project_id,
        set: {
          api_key: params.apiKey,
          sync_frequency: params.syncFrequency,
          sync_enabled: params.syncFrequency !== 'manual',
          filter_config: params.filterConfig || {},
          next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
          updated_at: new Date(),
        },
      })
      .returning({ id: fathomConnections.id })

    const data = inserted[0]
    if (!data) {
      return { success: false, error: 'Failed to store Fathom credentials.' }
    }

    return { success: true, connectionId: data.id }
  } catch (error) {
    console.error('[fathom.storeFathomCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Fathom credentials.' }
  }
}

/**
 * Update Fathom sync settings
 */
export async function updateFathomSettings(
  projectId: string,
  settings: {
    syncFrequency?: FathomSyncFrequency
    syncEnabled?: boolean
    filterConfig?: FathomFilterConfig
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
      .update(fathomConnections)
      .set(updateData)
      .where(eq(fathomConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[fathom.updateFathomSettings] Failed:', error)
    return { success: false, error: 'Failed to update Fathom settings.' }
  }
}

/**
 * Disconnect Fathom integration
 */
export async function disconnectFathom(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(fathomConnections)
      .where(eq(fathomConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[fathom.disconnectFathom] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Fathom.' }
  }
}

/**
 * Clear all synced meeting records for a connection.
 * Used by "start from scratch" sync mode.
 */
export async function clearSyncedMeetings(
  connectionId: string
): Promise<void> {
  try {
    await db
      .delete(fathomSyncedMeetings)
      .where(eq(fathomSyncedMeetings.connection_id, connectionId))
  } catch (error) {
    console.error('[fathom.clearSyncedMeetings] Failed:', error)
    throw new Error('Failed to clear synced meetings.')
  }
}

/**
 * Check if a meeting has already been synced
 */
export async function isMeetingAlreadySynced(
  connectionId: string,
  fathomMeetingId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: fathomSyncedMeetings.id })
    .from(fathomSyncedMeetings)
    .where(
      and(
        eq(fathomSyncedMeetings.connection_id, connectionId),
        eq(fathomSyncedMeetings.fathom_meeting_id, fathomMeetingId)
      )
    )

  return rows.length > 0
}

/**
 * Get all synced meeting IDs for a connection (batch pre-fetch to avoid N+1)
 */
export async function getSyncedMeetingIds(
  connectionId: string
): Promise<Set<string>> {
  const rows = await db
    .select({ fathom_meeting_id: fathomSyncedMeetings.fathom_meeting_id })
    .from(fathomSyncedMeetings)
    .where(eq(fathomSyncedMeetings.connection_id, connectionId))

  return new Set(rows.map((row) => row.fathom_meeting_id))
}

/**
 * Record a synced meeting
 */
export async function recordSyncedMeeting(
  params: {
    connectionId: string
    fathomMeetingId: string
    sessionId: string
    meetingCreatedAt?: string
    meetingDurationSeconds?: number
    messagesCount: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(fathomSyncedMeetings).values({
      connection_id: params.connectionId,
      fathom_meeting_id: params.fathomMeetingId,
      session_id: params.sessionId,
      meeting_created_at: params.meetingCreatedAt ? new Date(params.meetingCreatedAt) : null,
      meeting_duration_seconds: params.meetingDurationSeconds,
      messages_count: params.messagesCount,
    })

    return { success: true }
  } catch (error) {
    console.error('[fathom.recordSyncedMeeting] Failed:', error)
    return { success: false, error: 'Failed to record synced meeting.' }
  }
}

/**
 * Update sync state after a sync operation
 */
export async function updateSyncState(
  projectId: string,
  state: {
    status: 'success' | 'error' | 'in_progress'
    meetingsCount?: number
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
      .select({ sync_frequency: fathomConnections.sync_frequency })
      .from(fathomConnections)
      .where(eq(fathomConnections.project_id, projectId))

    const conn = connRows[0]
    if (conn) {
      const nextSync = calculateNextSyncTime(conn.sync_frequency as FathomSyncFrequency)
      updateData.next_sync_at = nextSync ? new Date(nextSync) : null
    }
  }

  if (state.meetingsCount !== undefined) {
    updateData.last_sync_meetings_count = state.meetingsCount
  }

  if (state.error) {
    updateData.last_sync_error = state.error
  } else if (state.status === 'success') {
    updateData.last_sync_error = null
  }

  await db
    .update(fathomConnections)
    .set(updateData)
    .where(eq(fathomConnections.project_id, projectId))
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
      .insert(fathomSyncRuns)
      .values({
        connection_id: connectionId,
        triggered_by: triggeredBy,
        status: 'in_progress',
      })
      .returning({ id: fathomSyncRuns.id })

    const data = inserted[0]
    if (!data) {
      return null
    }

    return { runId: data.id }
  } catch (error) {
    console.error('[fathom.createSyncRun] Failed:', error)
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
    meetingsFound: number
    meetingsSynced: number
    meetingsSkipped: number
    errorMessage?: string
  }
): Promise<void> {
  await db
    .update(fathomSyncRuns)
    .set({
      status: result.status,
      meetings_found: result.meetingsFound,
      meetings_synced: result.meetingsSynced,
      meetings_skipped: result.meetingsSkipped,
      error_message: result.errorMessage,
      completed_at: new Date(),
    })
    .where(eq(fathomSyncRuns.id, runId))
}

/**
 * Get connections that are due for sync
 */
export async function getConnectionsDueForSync(): Promise<Array<{ id: string; projectId: string }>> {
  const now = new Date()

  const rows = await db
    .select({ id: fathomConnections.id, project_id: fathomConnections.project_id })
    .from(fathomConnections)
    .where(
      and(
        eq(fathomConnections.sync_enabled, true),
        ne(fathomConnections.sync_frequency, 'manual'),
        lte(fathomConnections.next_sync_at, now),
        or(isNull(fathomConnections.last_sync_status), ne(fathomConnections.last_sync_status, 'in_progress'))
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
): Promise<{ totalSynced: number; lastSyncRuns: Array<{ status: string; startedAt: string; meetingsSynced: number }> }> {
  const connRows = await db
    .select({ id: fathomConnections.id })
    .from(fathomConnections)
    .where(eq(fathomConnections.project_id, projectId))

  const connection = connRows[0]

  if (!connection) {
    return { totalSynced: 0, lastSyncRuns: [] }
  }

  const [countRows, runs] = await Promise.all([
    db
      .select({ count: drizzleCount() })
      .from(fathomSyncedMeetings)
      .where(eq(fathomSyncedMeetings.connection_id, connection.id)),
    db
      .select({
        status: fathomSyncRuns.status,
        started_at: fathomSyncRuns.started_at,
        meetings_synced: fathomSyncRuns.meetings_synced,
      })
      .from(fathomSyncRuns)
      .where(eq(fathomSyncRuns.connection_id, connection.id))
      .orderBy(sql`${fathomSyncRuns.started_at} DESC`)
      .limit(5),
  ])

  const totalSynced = countRows[0]?.count ?? 0

  return {
    totalSynced,
    lastSyncRuns: runs.map((run) => ({
      status: run.status,
      startedAt: run.started_at?.toISOString() ?? '',
      meetingsSynced: run.meetings_synced || 0,
    })),
  }
}

/**
 * Calculate next sync time based on frequency
 */
export function calculateNextSyncTime(frequency: FathomSyncFrequency): string | null {
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
