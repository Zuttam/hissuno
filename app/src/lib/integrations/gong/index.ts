/**
 * Gong integration service layer.
 * Handles database operations for Gong connections and sync tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// NOTE: These tables are created by migrations but types are generated from the live schema.
// After running migrations, regenerate types with: supabase gen types typescript > src/types/supabase.ts
// Until then, we use type assertions for the new Gong tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

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
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<GongIntegrationStatus> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('gong_connections')
    .select(`
      sync_frequency,
      sync_enabled,
      filter_config,
      last_sync_at,
      last_sync_status,
      last_sync_error,
      last_sync_calls_count,
      next_sync_at
    `)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
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
    lastSyncAt: data.last_sync_at,
    lastSyncStatus: data.last_sync_status,
    lastSyncError: data.last_sync_error,
    lastSyncCallsCount: data.last_sync_calls_count || 0,
    nextSyncAt: data.next_sync_at,
    filterConfig: (data.filter_config as GongFilterConfig) || null,
  }
}

/**
 * Get the connection ID and credentials for a project
 */
export async function getGongCredentials(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{ connectionId: string; accessKey: string; accessKeySecret: string; baseUrl: string } | null> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('gong_connections')
    .select('id, access_key, access_key_secret, base_url')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    connectionId: data.id,
    accessKey: data.access_key,
    accessKeySecret: data.access_key_secret,
    baseUrl: data.base_url,
  }
}

/**
 * Store Gong credentials after validation
 */
export async function storeGongCredentials(
  supabase: SupabaseClient<Database> | AnySupabase,
  params: {
    projectId: string
    accessKey: string
    accessKeySecret: string
    baseUrl: string
    syncFrequency: GongSyncFrequency
    filterConfig?: GongFilterConfig
  }
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const client = supabase as AnySupabase
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  const { data, error } = await client
    .from('gong_connections')
    .upsert(
      {
        project_id: params.projectId,
        access_key: params.accessKey,
        access_key_secret: params.accessKeySecret,
        base_url: params.baseUrl,
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
    console.error('[gong.storeGongCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Gong credentials.' }
  }

  return { success: true, connectionId: data.id }
}

/**
 * Update Gong sync settings
 */
export async function updateGongSettings(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string,
  settings: {
    syncFrequency?: GongSyncFrequency
    syncEnabled?: boolean
    filterConfig?: GongFilterConfig
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
    // Auto-enable/disable based on frequency
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
    .from('gong_connections')
    .update(updateData)
    .eq('project_id', projectId)

  if (error) {
    console.error('[gong.updateGongSettings] Failed:', error)
    return { success: false, error: 'Failed to update Gong settings.' }
  }

  return { success: true }
}

/**
 * Disconnect Gong integration
 */
export async function disconnectGong(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase
  const { error } = await client
    .from('gong_connections')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    console.error('[gong.disconnectGong] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Gong.' }
  }

  return { success: true }
}

/**
 * Check if a call has already been synced
 */
export async function isCallAlreadySynced(
  supabase: SupabaseClient<Database> | AnySupabase,
  connectionId: string,
  gongCallId: string
): Promise<boolean> {
  const client = supabase as AnySupabase
  const { data } = await client
    .from('gong_synced_calls')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('gong_call_id', gongCallId)
    .single()

  return !!data
}

/**
 * Record a synced call
 */
export async function recordSyncedCall(
  supabase: SupabaseClient<Database> | AnySupabase,
  params: {
    connectionId: string
    gongCallId: string
    sessionId: string
    callCreatedAt?: string
    callDurationSeconds?: number
    messagesCount: number
  }
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase
  const { error } = await client.from('gong_synced_calls').insert({
    connection_id: params.connectionId,
    gong_call_id: params.gongCallId,
    session_id: params.sessionId,
    call_created_at: params.callCreatedAt,
    call_duration_seconds: params.callDurationSeconds,
    messages_count: params.messagesCount,
  })

  if (error) {
    console.error('[gong.recordSyncedCall] Failed:', error)
    return { success: false, error: 'Failed to record synced call.' }
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
    callsCount?: number
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

    // Calculate next sync time based on frequency
    const { data } = await client
      .from('gong_connections')
      .select('sync_frequency')
      .eq('project_id', projectId)
      .single()

    if (data) {
      updateData.next_sync_at = calculateNextSyncTime(data.sync_frequency as GongSyncFrequency)
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

  await client
    .from('gong_connections')
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
    .from('gong_sync_runs')
    .insert({
      connection_id: connectionId,
      triggered_by: triggeredBy,
      status: 'in_progress',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[gong.createSyncRun] Failed:', error)
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
    callsFound: number
    callsSynced: number
    callsSkipped: number
    errorMessage?: string
  }
): Promise<void> {
  const client = supabase as AnySupabase
  await client
    .from('gong_sync_runs')
    .update({
      status: result.status,
      calls_found: result.callsFound,
      calls_synced: result.callsSynced,
      calls_skipped: result.callsSkipped,
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
    .from('gong_connections')
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
): Promise<{ totalSynced: number; lastSyncRuns: Array<{ status: string; startedAt: string; callsSynced: number }> }> {
  const client = supabase as AnySupabase

  // Get connection
  const { data: connection } = await client
    .from('gong_connections')
    .select('id')
    .eq('project_id', projectId)
    .single()

  if (!connection) {
    return { totalSynced: 0, lastSyncRuns: [] }
  }

  // Count total synced calls
  const { count } = await client
    .from('gong_synced_calls')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connection.id)

  // Get last 5 sync runs
  const { data: runs } = await client
    .from('gong_sync_runs')
    .select('status, started_at, calls_synced')
    .eq('connection_id', connection.id)
    .order('started_at', { ascending: false })
    .limit(5)

  return {
    totalSynced: count || 0,
    lastSyncRuns: (runs || []).map((run) => ({
      status: run.status,
      startedAt: run.started_at,
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
