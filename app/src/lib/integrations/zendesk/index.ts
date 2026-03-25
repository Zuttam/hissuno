/**
 * Zendesk integration service layer.
 * Handles database operations for Zendesk connections and sync tracking.
 */

import { db } from '@/lib/db'
import { eq, and, or, ne, lte, isNull, sql, count as drizzleCount } from 'drizzle-orm'
import { zendeskConnections, zendeskSyncRuns, zendeskSyncedTickets } from '@/lib/db/schema/app'
import { type SyncFrequency } from '@/lib/integrations/shared/sync-constants'
export type { SyncFrequency }
import { calculateNextSyncTime } from '@/lib/integrations/shared/sync-utils'

/**
 * Filter configuration for sync
 */
export interface ZendeskFilterConfig {
  fromDate?: string // ISO date string
  toDate?: string // ISO date string
}

/**
 * Zendesk connection record
 */
export interface ZendeskConnection {
  id: string
  projectId: string
  subdomain: string
  accountName: string | null
  syncFrequency: SyncFrequency
  syncEnabled: boolean
  filterConfig: ZendeskFilterConfig
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null
  lastSyncError: string | null
  lastSyncTicketsCount: number
  nextSyncAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Zendesk integration status
 */
export interface ZendeskIntegrationStatus {
  connected: boolean
  subdomain: string | null
  accountName: string | null
  syncFrequency: SyncFrequency | null
  syncEnabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null
  lastSyncTicketsCount: number
  nextSyncAt: string | null
  filterConfig: ZendeskFilterConfig | null
}

/**
 * Check if a project has Zendesk integration connected
 */
export async function hasZendeskConnection(
  projectId: string
): Promise<ZendeskIntegrationStatus> {
  const rows = await db
    .select({
      subdomain: zendeskConnections.subdomain,
      account_name: zendeskConnections.account_name,
      sync_frequency: zendeskConnections.sync_frequency,
      sync_enabled: zendeskConnections.sync_enabled,
      filter_config: zendeskConnections.filter_config,
      last_sync_at: zendeskConnections.last_sync_at,
      last_sync_status: zendeskConnections.last_sync_status,
      last_sync_tickets_count: zendeskConnections.last_sync_tickets_count,
      next_sync_at: zendeskConnections.next_sync_at,
    })
    .from(zendeskConnections)
    .where(eq(zendeskConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      subdomain: null,
      accountName: null,
      syncFrequency: null,
      syncEnabled: false,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncTicketsCount: 0,
      nextSyncAt: null,
      filterConfig: null,
    }
  }

  return {
    connected: true,
    subdomain: data.subdomain,
    accountName: data.account_name,
    syncFrequency: data.sync_frequency as SyncFrequency,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
    lastSyncStatus: data.last_sync_status as 'success' | 'error' | 'in_progress' | null,
    lastSyncTicketsCount: data.last_sync_tickets_count || 0,
    nextSyncAt: data.next_sync_at?.toISOString() ?? null,
    filterConfig: (data.filter_config as ZendeskFilterConfig) || null,
  }
}

/**
 * Get the connection ID and credentials for a project
 */
export async function getZendeskCredentials(
  projectId: string
): Promise<{
  connectionId: string
  subdomain: string
  adminEmail: string
  apiToken: string
  lastSyncAt: string | null
} | null> {
  const rows = await db
    .select({
      id: zendeskConnections.id,
      subdomain: zendeskConnections.subdomain,
      admin_email: zendeskConnections.admin_email,
      api_token: zendeskConnections.api_token,
      last_sync_at: zendeskConnections.last_sync_at,
    })
    .from(zendeskConnections)
    .where(eq(zendeskConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    connectionId: data.id,
    subdomain: data.subdomain,
    adminEmail: data.admin_email,
    apiToken: data.api_token,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
  }
}

/**
 * Store Zendesk credentials after validation
 */
export async function storeZendeskCredentials(
  params: {
    projectId: string
    subdomain: string
    adminEmail: string
    apiToken: string
    accountName: string | null
    syncFrequency: SyncFrequency
    filterConfig?: ZendeskFilterConfig
  }
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  try {
    const inserted = await db
      .insert(zendeskConnections)
      .values({
        project_id: params.projectId,
        subdomain: params.subdomain,
        admin_email: params.adminEmail,
        api_token: params.apiToken,
        account_name: params.accountName,
        sync_frequency: params.syncFrequency,
        sync_enabled: params.syncFrequency !== 'manual',
        filter_config: params.filterConfig || {},
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: zendeskConnections.project_id,
        set: {
          subdomain: params.subdomain,
          admin_email: params.adminEmail,
          api_token: params.apiToken,
          account_name: params.accountName,
          sync_frequency: params.syncFrequency,
          sync_enabled: params.syncFrequency !== 'manual',
          filter_config: params.filterConfig || {},
          next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
          updated_at: new Date(),
        },
      })
      .returning({ id: zendeskConnections.id })

    const data = inserted[0]
    if (!data) {
      return { success: false, error: 'Failed to store Zendesk credentials.' }
    }

    return { success: true, connectionId: data.id }
  } catch (error) {
    console.error('[zendesk.storeZendeskCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Zendesk credentials.' }
  }
}

/**
 * Update Zendesk sync settings
 */
export async function updateZendeskSettings(
  projectId: string,
  settings: {
    syncFrequency?: SyncFrequency
    syncEnabled?: boolean
    filterConfig?: ZendeskFilterConfig
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
      .update(zendeskConnections)
      .set(updateData)
      .where(eq(zendeskConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[zendesk.updateZendeskSettings] Failed:', error)
    return { success: false, error: 'Failed to update Zendesk settings.' }
  }
}

/**
 * Disconnect Zendesk integration
 */
export async function disconnectZendesk(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(zendeskConnections)
      .where(eq(zendeskConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[zendesk.disconnectZendesk] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Zendesk.' }
  }
}

/**
 * Clear all synced ticket records for a connection.
 * Used by "start from scratch" sync mode.
 */
export async function clearSyncedTickets(
  connectionId: string
): Promise<void> {
  try {
    await db
      .delete(zendeskSyncedTickets)
      .where(eq(zendeskSyncedTickets.connection_id, connectionId))
  } catch (error) {
    console.error('[zendesk.clearSyncedTickets] Failed:', error)
    throw new Error('Failed to clear synced tickets.')
  }
}

/**
 * Check if a ticket has already been synced
 */
export async function isTicketSynced(
  connectionId: string,
  zendeskTicketId: number
): Promise<boolean> {
  const rows = await db
    .select({ id: zendeskSyncedTickets.id })
    .from(zendeskSyncedTickets)
    .where(
      and(
        eq(zendeskSyncedTickets.connection_id, connectionId),
        eq(zendeskSyncedTickets.zendesk_ticket_id, zendeskTicketId)
      )
    )

  return rows.length > 0
}

/**
 * Get all synced ticket IDs for a connection (batch pre-fetch to avoid N+1)
 */
export async function getSyncedTicketIds(
  connectionId: string
): Promise<Set<number>> {
  const rows = await db
    .select({ zendesk_ticket_id: zendeskSyncedTickets.zendesk_ticket_id })
    .from(zendeskSyncedTickets)
    .where(eq(zendeskSyncedTickets.connection_id, connectionId))

  return new Set(rows.map((row) => row.zendesk_ticket_id))
}

/**
 * Record a synced ticket
 */
export async function recordSyncedTicket(
  params: {
    connectionId: string
    zendeskTicketId: number
    sessionId: string
    ticketCreatedAt?: string
    ticketUpdatedAt?: string
    commentsCount: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(zendeskSyncedTickets).values({
      connection_id: params.connectionId,
      zendesk_ticket_id: params.zendeskTicketId,
      session_id: params.sessionId,
      ticket_created_at: params.ticketCreatedAt ? new Date(params.ticketCreatedAt) : null,
      ticket_updated_at: params.ticketUpdatedAt ? new Date(params.ticketUpdatedAt) : null,
      comments_count: params.commentsCount,
    })

    return { success: true }
  } catch (error) {
    console.error('[zendesk.recordSyncedTicket] Failed:', error)
    return { success: false, error: 'Failed to record synced ticket.' }
  }
}

/**
 * Update sync state after a sync operation
 */
export async function updateSyncState(
  projectId: string,
  state: {
    status: 'success' | 'error' | 'in_progress'
    ticketsCount?: number
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
      .select({ sync_frequency: zendeskConnections.sync_frequency })
      .from(zendeskConnections)
      .where(eq(zendeskConnections.project_id, projectId))

    const conn = connRows[0]
    if (conn) {
      const nextSync = calculateNextSyncTime(conn.sync_frequency as SyncFrequency)
      updateData.next_sync_at = nextSync ? new Date(nextSync) : null
    }
  }

  if (state.ticketsCount !== undefined) {
    updateData.last_sync_tickets_count = state.ticketsCount
  }

  if (state.error) {
    updateData.last_sync_error = state.error
  } else if (state.status === 'success') {
    updateData.last_sync_error = null
  }

  await db
    .update(zendeskConnections)
    .set(updateData)
    .where(eq(zendeskConnections.project_id, projectId))
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
      .insert(zendeskSyncRuns)
      .values({
        connection_id: connectionId,
        triggered_by: triggeredBy,
        status: 'in_progress',
      })
      .returning({ id: zendeskSyncRuns.id })

    const data = inserted[0]
    if (!data) {
      return null
    }

    return { runId: data.id }
  } catch (error) {
    console.error('[zendesk.createSyncRun] Failed:', error)
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
    ticketsFound: number
    ticketsSynced: number
    ticketsSkipped: number
    errorMessage?: string
  }
): Promise<void> {
  await db
    .update(zendeskSyncRuns)
    .set({
      status: result.status,
      tickets_found: result.ticketsFound,
      tickets_synced: result.ticketsSynced,
      tickets_skipped: result.ticketsSkipped,
      error_message: result.errorMessage,
      completed_at: new Date(),
    })
    .where(eq(zendeskSyncRuns.id, runId))
}

/**
 * Get connections that are due for sync
 */
export async function getConnectionsDueForSync(): Promise<Array<{ id: string; projectId: string }>> {
  const now = new Date()

  const rows = await db
    .select({ id: zendeskConnections.id, project_id: zendeskConnections.project_id })
    .from(zendeskConnections)
    .where(
      and(
        eq(zendeskConnections.sync_enabled, true),
        ne(zendeskConnections.sync_frequency, 'manual'),
        lte(zendeskConnections.next_sync_at, now),
        or(isNull(zendeskConnections.last_sync_status), ne(zendeskConnections.last_sync_status, 'in_progress'))
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
): Promise<{ totalSynced: number; lastSyncRuns: Array<{ status: string; startedAt: string; ticketsSynced: number }> }> {
  const connRows = await db
    .select({ id: zendeskConnections.id })
    .from(zendeskConnections)
    .where(eq(zendeskConnections.project_id, projectId))

  const connection = connRows[0]

  if (!connection) {
    return { totalSynced: 0, lastSyncRuns: [] }
  }

  const countRows = await db
    .select({ count: drizzleCount() })
    .from(zendeskSyncedTickets)
    .where(eq(zendeskSyncedTickets.connection_id, connection.id))

  const totalSynced = countRows[0]?.count ?? 0

  const runs = await db
    .select({
      status: zendeskSyncRuns.status,
      started_at: zendeskSyncRuns.started_at,
      tickets_synced: zendeskSyncRuns.tickets_synced,
    })
    .from(zendeskSyncRuns)
    .where(eq(zendeskSyncRuns.connection_id, connection.id))
    .orderBy(sql`${zendeskSyncRuns.started_at} DESC`)
    .limit(5)

  return {
    totalSynced,
    lastSyncRuns: runs.map((run) => ({
      status: run.status,
      startedAt: run.started_at?.toISOString() ?? '',
      ticketsSynced: run.tickets_synced || 0,
    })),
  }
}

