/**
 * Intercom integration service layer.
 * Handles database operations for Intercom connections and sync tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// NOTE: These tables are created by migrations but types are generated from the live schema.
// After running migrations, regenerate types with: supabase gen types typescript > src/types/supabase.ts
// Until then, we use type assertions for the new Intercom tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

/**
 * Sync frequency options
 */
export type IntercomSyncFrequency = 'manual' | '1h' | '6h' | '24h'

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
  syncFrequency: IntercomSyncFrequency
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
  syncFrequency: IntercomSyncFrequency | null
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
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<IntercomIntegrationStatus> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('intercom_connections')
    .select(`
      workspace_id,
      workspace_name,
      auth_method,
      sync_frequency,
      sync_enabled,
      filter_config,
      last_sync_at,
      last_sync_status,
      last_sync_conversations_count,
      next_sync_at
    `)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
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
    syncFrequency: data.sync_frequency as IntercomSyncFrequency,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at,
    lastSyncStatus: data.last_sync_status,
    lastSyncConversationsCount: data.last_sync_conversations_count || 0,
    nextSyncAt: data.next_sync_at,
    filterConfig: (data.filter_config as IntercomFilterConfig) || null,
  }
}

/**
 * Get the connection ID and token for a project
 */
export async function getIntercomCredentials(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{ connectionId: string; accessToken: string; workspaceId: string; lastSyncAt: string | null } | null> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('intercom_connections')
    .select('id, access_token, workspace_id, last_sync_at')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    connectionId: data.id,
    accessToken: data.access_token,
    workspaceId: data.workspace_id,
    lastSyncAt: data.last_sync_at,
  }
}

/**
 * Store Intercom credentials after validation
 */
export async function storeIntercomCredentials(
  supabase: SupabaseClient<Database> | AnySupabase,
  params: {
    projectId: string
    accessToken: string
    workspaceId: string
    workspaceName: string | null
    syncFrequency: IntercomSyncFrequency
    filterConfig?: IntercomFilterConfig
    authMethod?: IntercomAuthMethod
  }
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const client = supabase as AnySupabase
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  const { data, error } = await client
    .from('intercom_connections')
    .upsert(
      {
        project_id: params.projectId,
        access_token: params.accessToken,
        workspace_id: params.workspaceId,
        workspace_name: params.workspaceName,
        auth_method: params.authMethod || 'token',
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
    console.error('[intercom.storeIntercomCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Intercom credentials.' }
  }

  return { success: true, connectionId: data.id }
}

/**
 * Update Intercom sync settings
 */
export async function updateIntercomSettings(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string,
  settings: {
    syncFrequency?: IntercomSyncFrequency
    syncEnabled?: boolean
    filterConfig?: IntercomFilterConfig
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
    .from('intercom_connections')
    .update(updateData)
    .eq('project_id', projectId)

  if (error) {
    console.error('[intercom.updateIntercomSettings] Failed:', error)
    return { success: false, error: 'Failed to update Intercom settings.' }
  }

  return { success: true }
}

/**
 * Disconnect Intercom integration
 */
export async function disconnectIntercom(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase
  const { error } = await client
    .from('intercom_connections')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    console.error('[intercom.disconnectIntercom] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Intercom.' }
  }

  return { success: true }
}

/**
 * Clear all synced conversation records for a connection.
 * Used by "start from scratch" sync mode.
 */
export async function clearSyncedConversations(
  supabase: SupabaseClient<Database> | AnySupabase,
  connectionId: string
): Promise<void> {
  const client = supabase as AnySupabase
  const { error } = await client
    .from('intercom_synced_conversations')
    .delete()
    .eq('connection_id', connectionId)

  if (error) {
    console.error('[intercom.clearSyncedConversations] Failed:', error)
    throw new Error('Failed to clear synced conversations.')
  }
}

/**
 * Check if a conversation has already been synced
 */
export async function isConversationSynced(
  supabase: SupabaseClient<Database> | AnySupabase,
  connectionId: string,
  intercomConversationId: string
): Promise<boolean> {
  const client = supabase as AnySupabase
  const { data } = await client
    .from('intercom_synced_conversations')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('intercom_conversation_id', intercomConversationId)
    .single()

  return !!data
}

/**
 * Record a synced conversation
 */
export async function recordSyncedConversation(
  supabase: SupabaseClient<Database> | AnySupabase,
  params: {
    connectionId: string
    intercomConversationId: string
    sessionId: string
    conversationCreatedAt?: string
    conversationUpdatedAt?: string
    partsCount: number
  }
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase
  const { error } = await client.from('intercom_synced_conversations').insert({
    connection_id: params.connectionId,
    intercom_conversation_id: params.intercomConversationId,
    session_id: params.sessionId,
    conversation_created_at: params.conversationCreatedAt,
    conversation_updated_at: params.conversationUpdatedAt,
    parts_count: params.partsCount,
  })

  if (error) {
    console.error('[intercom.recordSyncedConversation] Failed:', error)
    return { success: false, error: 'Failed to record synced conversation.' }
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
    conversationsCount?: number
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
      .from('intercom_connections')
      .select('sync_frequency')
      .eq('project_id', projectId)
      .single()

    if (data) {
      updateData.next_sync_at = calculateNextSyncTime(data.sync_frequency as IntercomSyncFrequency)
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

  await client
    .from('intercom_connections')
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
    .from('intercom_sync_runs')
    .insert({
      connection_id: connectionId,
      triggered_by: triggeredBy,
      status: 'in_progress',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[intercom.createSyncRun] Failed:', error)
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
    conversationsFound: number
    conversationsSynced: number
    conversationsSkipped: number
    errorMessage?: string
  }
): Promise<void> {
  const client = supabase as AnySupabase
  await client
    .from('intercom_sync_runs')
    .update({
      status: result.status,
      conversations_found: result.conversationsFound,
      conversations_synced: result.conversationsSynced,
      conversations_skipped: result.conversationsSkipped,
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
    .from('intercom_connections')
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
): Promise<{ totalSynced: number; lastSyncRuns: Array<{ status: string; startedAt: string; conversationsSynced: number }> }> {
  const client = supabase as AnySupabase

  // Get connection
  const { data: connection } = await client
    .from('intercom_connections')
    .select('id')
    .eq('project_id', projectId)
    .single()

  if (!connection) {
    return { totalSynced: 0, lastSyncRuns: [] }
  }

  // Count total synced conversations
  const { count } = await client
    .from('intercom_synced_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connection.id)

  // Get last 5 sync runs
  const { data: runs } = await client
    .from('intercom_sync_runs')
    .select('status, started_at, conversations_synced')
    .eq('connection_id', connection.id)
    .order('started_at', { ascending: false })
    .limit(5)

  return {
    totalSynced: count || 0,
    lastSyncRuns: (runs || []).map((run) => ({
      status: run.status,
      startedAt: run.started_at,
      conversationsSynced: run.conversations_synced || 0,
    })),
  }
}

/**
 * Calculate next sync time based on frequency
 */
function calculateNextSyncTime(frequency: IntercomSyncFrequency): string | null {
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
