/**
 * Zendesk integration service layer.
 * Handles database operations for Zendesk connections and sync tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

/**
 * Sync frequency options
 */
export type ZendeskSyncFrequency = 'manual' | '1h' | '6h' | '24h'

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
  syncFrequency: ZendeskSyncFrequency
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
  syncFrequency: ZendeskSyncFrequency | null
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
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<ZendeskIntegrationStatus> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('zendesk_connections')
    .select(`
      subdomain,
      account_name,
      sync_frequency,
      sync_enabled,
      filter_config,
      last_sync_at,
      last_sync_status,
      last_sync_tickets_count,
      next_sync_at
    `)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
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
    syncFrequency: data.sync_frequency as ZendeskSyncFrequency,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at,
    lastSyncStatus: data.last_sync_status,
    lastSyncTicketsCount: data.last_sync_tickets_count || 0,
    nextSyncAt: data.next_sync_at,
    filterConfig: (data.filter_config as ZendeskFilterConfig) || null,
  }
}

/**
 * Get the connection ID and credentials for a project
 */
export async function getZendeskCredentials(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{
  connectionId: string
  subdomain: string
  adminEmail: string
  apiToken: string
  lastSyncAt: string | null
} | null> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('zendesk_connections')
    .select('id, subdomain, admin_email, api_token, last_sync_at')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    connectionId: data.id,
    subdomain: data.subdomain,
    adminEmail: data.admin_email,
    apiToken: data.api_token,
    lastSyncAt: data.last_sync_at,
  }
}

/**
 * Store Zendesk credentials after validation
 */
export async function storeZendeskCredentials(
  supabase: SupabaseClient<Database> | AnySupabase,
  params: {
    projectId: string
    subdomain: string
    adminEmail: string
    apiToken: string
    accountName: string | null
    syncFrequency: ZendeskSyncFrequency
    filterConfig?: ZendeskFilterConfig
  }
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const client = supabase as AnySupabase
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  const { data, error } = await client
    .from('zendesk_connections')
    .upsert(
      {
        project_id: params.projectId,
        subdomain: params.subdomain,
        admin_email: params.adminEmail,
        api_token: params.apiToken,
        account_name: params.accountName,
        sync_frequency: params.syncFrequency,
        sync_enabled: params.syncFrequency !== 'manual',
        filter_config: params.filterConfig || {},
        next_sync_at: nextSyncAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('[zendesk.storeZendeskCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Zendesk credentials.' }
  }

  return { success: true, connectionId: data.id }
}

/**
 * Update Zendesk sync settings
 */
export async function updateZendeskSettings(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string,
  settings: {
    syncFrequency?: ZendeskSyncFrequency
    syncEnabled?: boolean
    filterConfig?: ZendeskFilterConfig
  }
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (settings.syncFrequency !== undefined) {
    updateData.sync_frequency = settings.syncFrequency
    updateData.next_sync_at = calculateNextSyncTime(settings.syncFrequency)
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

  const { error } = await client
    .from('zendesk_connections')
    .update(updateData)
    .eq('project_id', projectId)

  if (error) {
    console.error('[zendesk.updateZendeskSettings] Failed:', error)
    return { success: false, error: 'Failed to update Zendesk settings.' }
  }

  return { success: true }
}

/**
 * Disconnect Zendesk integration
 */
export async function disconnectZendesk(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase
  const { error } = await client
    .from('zendesk_connections')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    console.error('[zendesk.disconnectZendesk] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Zendesk.' }
  }

  return { success: true }
}

/**
 * Clear all synced ticket records for a connection.
 * Used by "start from scratch" sync mode.
 */
export async function clearSyncedTickets(
  supabase: SupabaseClient<Database> | AnySupabase,
  connectionId: string
): Promise<void> {
  const client = supabase as AnySupabase
  const { error } = await client
    .from('zendesk_synced_tickets')
    .delete()
    .eq('connection_id', connectionId)

  if (error) {
    console.error('[zendesk.clearSyncedTickets] Failed:', error)
    throw new Error('Failed to clear synced tickets.')
  }
}

/**
 * Check if a ticket has already been synced
 */
export async function isTicketSynced(
  supabase: SupabaseClient<Database> | AnySupabase,
  connectionId: string,
  zendeskTicketId: number
): Promise<boolean> {
  const client = supabase as AnySupabase
  const { data } = await client
    .from('zendesk_synced_tickets')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('zendesk_ticket_id', zendeskTicketId)
    .single()

  return !!data
}

/**
 * Record a synced ticket
 */
export async function recordSyncedTicket(
  supabase: SupabaseClient<Database> | AnySupabase,
  params: {
    connectionId: string
    zendeskTicketId: number
    sessionId: string
    ticketCreatedAt?: string
    ticketUpdatedAt?: string
    commentsCount: number
  }
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase
  const { error } = await client.from('zendesk_synced_tickets').insert({
    connection_id: params.connectionId,
    zendesk_ticket_id: params.zendeskTicketId,
    session_id: params.sessionId,
    ticket_created_at: params.ticketCreatedAt,
    ticket_updated_at: params.ticketUpdatedAt,
    comments_count: params.commentsCount,
  })

  if (error) {
    console.error('[zendesk.recordSyncedTicket] Failed:', error)
    return { success: false, error: 'Failed to record synced ticket.' }
  }

  return { success: true }
}

/**
 * Update sync state after a sync operation
 */
export async function updateSyncState(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string,
  state: {
    status: 'success' | 'error' | 'in_progress'
    ticketsCount?: number
    error?: string
  }
): Promise<void> {
  const client = supabase as AnySupabase

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    last_sync_status: state.status,
    updated_at: new Date().toISOString(),
  }

  if (state.status === 'success' || state.status === 'error') {
    updateData.last_sync_at = new Date().toISOString()

    const { data } = await client
      .from('zendesk_connections')
      .select('sync_frequency')
      .eq('project_id', projectId)
      .single()

    if (data) {
      updateData.next_sync_at = calculateNextSyncTime(data.sync_frequency as ZendeskSyncFrequency)
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

  await client
    .from('zendesk_connections')
    .update(updateData)
    .eq('project_id', projectId)
}

/**
 * Create a sync run record
 */
export async function createSyncRun(
  supabase: SupabaseClient<Database> | AnySupabase,
  connectionId: string,
  triggeredBy: 'manual' | 'cron'
): Promise<{ runId: string } | null> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('zendesk_sync_runs')
    .insert({
      connection_id: connectionId,
      triggered_by: triggeredBy,
      status: 'in_progress',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[zendesk.createSyncRun] Failed:', error)
    return null
  }

  return { runId: data.id }
}

/**
 * Complete a sync run
 */
export async function completeSyncRun(
  supabase: SupabaseClient<Database> | AnySupabase,
  runId: string,
  result: {
    status: 'success' | 'error'
    ticketsFound: number
    ticketsSynced: number
    ticketsSkipped: number
    errorMessage?: string
  }
): Promise<void> {
  const client = supabase as AnySupabase
  await client
    .from('zendesk_sync_runs')
    .update({
      status: result.status,
      tickets_found: result.ticketsFound,
      tickets_synced: result.ticketsSynced,
      tickets_skipped: result.ticketsSkipped,
      error_message: result.errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
}

/**
 * Get connections that are due for sync
 */
export async function getConnectionsDueForSync(
  supabase: SupabaseClient<Database> | AnySupabase
): Promise<Array<{ id: string; projectId: string }>> {
  const client = supabase as AnySupabase
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('zendesk_connections')
    .select('id, project_id')
    .eq('sync_enabled', true)
    .neq('sync_frequency', 'manual')
    .lte('next_sync_at', now)
    .neq('last_sync_status', 'in_progress')

  if (error || !data) {
    return []
  }

  return data.map((row) => ({
    id: row.id,
    projectId: row.project_id,
  }))
}

/**
 * Get sync statistics for a connection
 */
export async function getSyncStats(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{ totalSynced: number; lastSyncRuns: Array<{ status: string; startedAt: string; ticketsSynced: number }> }> {
  const client = supabase as AnySupabase

  const { data: connection } = await client
    .from('zendesk_connections')
    .select('id')
    .eq('project_id', projectId)
    .single()

  if (!connection) {
    return { totalSynced: 0, lastSyncRuns: [] }
  }

  const { count } = await client
    .from('zendesk_synced_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connection.id)

  const { data: runs } = await client
    .from('zendesk_sync_runs')
    .select('status, started_at, tickets_synced')
    .eq('connection_id', connection.id)
    .order('started_at', { ascending: false })
    .limit(5)

  return {
    totalSynced: count || 0,
    lastSyncRuns: (runs || []).map((run) => ({
      status: run.status,
      startedAt: run.started_at,
      ticketsSynced: run.tickets_synced || 0,
    })),
  }
}

/**
 * Calculate next sync time based on frequency
 */
function calculateNextSyncTime(frequency: ZendeskSyncFrequency): string | null {
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
