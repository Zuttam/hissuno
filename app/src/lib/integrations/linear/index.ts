import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  LinearConnectionRecord,
  LinearIntegrationStatus,
  LinearIssueSyncStatus,
} from '@/types/linear'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

/**
 * Check if a project has Linear integration connected
 */
export async function hasLinearConnection(
  supabase: AnySupabase,
  projectId: string
): Promise<LinearIntegrationStatus> {
  const { data, error } = await supabase
    .from('linear_connections')
    .select('organization_id, organization_name, team_id, team_name, team_key, is_enabled, auto_sync_enabled')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return {
      connected: false,
      organizationId: null,
      organizationName: null,
      teamId: null,
      teamName: null,
      teamKey: null,
      isEnabled: false,
      isConfigured: false,
      autoSyncEnabled: false,
    }
  }

  return {
    connected: true,
    organizationId: data.organization_id,
    organizationName: data.organization_name,
    teamId: data.team_id,
    teamName: data.team_name,
    teamKey: data.team_key,
    isEnabled: data.is_enabled,
    isConfigured: Boolean(data.team_id),
    autoSyncEnabled: data.auto_sync_enabled,
  }
}

/**
 * Get the full Linear connection record for a project
 */
export async function getLinearConnection(
  supabase: AnySupabase,
  projectId: string
): Promise<LinearConnectionRecord | null> {
  const { data, error } = await supabase
    .from('linear_connections')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return null
  }

  return data as LinearConnectionRecord
}

/**
 * Get Linear connection by connection ID
 */
export async function getLinearConnectionById(
  supabase: AnySupabase,
  connectionId: string
): Promise<LinearConnectionRecord | null> {
  const { data, error } = await supabase
    .from('linear_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !data) {
    return null
  }

  return data as LinearConnectionRecord
}

/**
 * Store Linear OAuth tokens after successful authorization
 */
export async function storeLinearConnection(
  supabase: AnySupabase,
  params: {
    projectId: string
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string
    organizationId: string
    organizationName: string
    installedByUserId: string | null
    installedByEmail: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('linear_connections').upsert(
    {
      project_id: params.projectId,
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      token_expires_at: params.tokenExpiresAt,
      organization_id: params.organizationId,
      organization_name: params.organizationName,
      installed_by_user_id: params.installedByUserId,
      installed_by_email: params.installedByEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id' }
  )

  if (error) {
    console.error('[linear.storeLinearConnection] Failed to store connection:', error)
    return { success: false, error: 'Failed to store Linear connection.' }
  }

  return { success: true }
}

/**
 * Update Linear connection configuration (team + auto_sync)
 */
export async function configureLinearConnection(
  supabase: AnySupabase,
  projectId: string,
  config: {
    teamId: string
    teamName: string
    teamKey: string
    autoSyncEnabled?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, unknown> = {
    team_id: config.teamId,
    team_name: config.teamName,
    team_key: config.teamKey,
  }
  if (config.autoSyncEnabled !== undefined) {
    updateData.auto_sync_enabled = config.autoSyncEnabled
  }

  const { error } = await supabase
    .from('linear_connections')
    .update(updateData)
    .eq('project_id', projectId)

  if (error) {
    console.error('[linear.configureLinearConnection] Failed:', error)
    return { success: false, error: 'Failed to configure Linear integration.' }
  }

  return { success: true }
}

/**
 * Update stored tokens after a refresh
 */
export async function updateLinearTokens(
  supabase: AnySupabase,
  connectionId: string,
  tokens: {
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('linear_connections')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: tokens.tokenExpiresAt,
    })
    .eq('id', connectionId)

  if (error) {
    console.error('[linear.updateLinearTokens] Failed:', error)
  }
}

/**
 * Disconnect Linear integration for a project
 */
export async function disconnectLinear(
  supabase: AnySupabase,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('linear_connections')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    console.error('[linear.disconnectLinear] Failed:', error)
    return { success: false, error: 'Failed to disconnect Linear.' }
  }

  return { success: true }
}

/**
 * Get Linear sync status for a specific issue
 */
export async function getLinearIssueSyncStatus(
  supabase: AnySupabase,
  issueId: string
): Promise<LinearIssueSyncStatus> {
  const { data, error } = await supabase
    .from('linear_issue_syncs')
    .select('linear_issue_identifier, linear_issue_url, last_sync_status, last_sync_error, last_synced_at, last_linear_state, last_linear_state_type, last_webhook_received_at, retry_count')
    .eq('issue_id', issueId)
    .single()

  if (error || !data) {
    return {
      synced: false,
      linearIssueIdentifier: null,
      linearIssueUrl: null,
      lastSyncStatus: null,
      lastSyncError: null,
      lastSyncedAt: null,
      lastLinearState: null,
      lastLinearStateType: null,
      lastWebhookReceivedAt: null,
      retryCount: 0,
    }
  }

  return {
    synced: Boolean(data.linear_issue_identifier),
    linearIssueIdentifier: data.linear_issue_identifier,
    linearIssueUrl: data.linear_issue_url,
    lastSyncStatus: data.last_sync_status,
    lastSyncError: data.last_sync_error,
    lastSyncedAt: data.last_synced_at,
    lastLinearState: data.last_linear_state,
    lastLinearStateType: data.last_linear_state_type,
    lastWebhookReceivedAt: data.last_webhook_received_at,
    retryCount: data.retry_count,
  }
}

/**
 * Get all connections that have failed syncs due for retry
 */
export async function getFailedLinearSyncsDueForRetry(
  supabase: AnySupabase
): Promise<Array<{
  syncId: string
  issueId: string
  connectionId: string
  lastSyncAction: string
  retryCount: number
}>> {
  const { data, error } = await supabase
    .from('linear_issue_syncs')
    .select('id, issue_id, connection_id, last_sync_action, retry_count')
    .eq('last_sync_status', 'failed')
    .lt('retry_count', 3)

  if (error) {
    console.error('[linear.getFailedLinearSyncsDueForRetry] Failed:', error)
    return []
  }

  return (data ?? []).map((row) => ({
    syncId: row.id,
    issueId: row.issue_id,
    connectionId: row.connection_id,
    lastSyncAction: row.last_sync_action ?? 'create',
    retryCount: row.retry_count,
  }))
}
