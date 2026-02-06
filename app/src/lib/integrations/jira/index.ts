import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  JiraConnectionRecord,
  JiraIntegrationStatus,
  JiraIssueSyncStatus,
} from '@/types/jira'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

/**
 * Check if a project has Jira integration connected
 */
export async function hasJiraConnection(
  supabase: AnySupabase,
  projectId: string
): Promise<JiraIntegrationStatus> {
  const { data, error } = await supabase
    .from('jira_connections')
    .select('site_url, cloud_id, installed_by_email, jira_project_key, jira_project_id, issue_type_name, is_enabled')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return {
      connected: false,
      siteUrl: null,
      cloudId: null,
      installedByEmail: null,
      jiraProjectKey: null,
      jiraProjectId: null,
      issueTypeName: null,
      isEnabled: false,
      isConfigured: false,
    }
  }

  return {
    connected: true,
    siteUrl: data.site_url,
    cloudId: data.cloud_id,
    installedByEmail: data.installed_by_email,
    jiraProjectKey: data.jira_project_key,
    jiraProjectId: data.jira_project_id,
    issueTypeName: data.issue_type_name,
    isEnabled: data.is_enabled,
    isConfigured: Boolean(data.jira_project_key && data.issue_type_name),
  }
}

/**
 * Get the full Jira connection record for a project
 */
export async function getJiraConnection(
  supabase: AnySupabase,
  projectId: string
): Promise<JiraConnectionRecord | null> {
  const { data, error } = await supabase
    .from('jira_connections')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return null
  }

  return data as JiraConnectionRecord
}

/**
 * Get Jira connection by connection ID
 */
export async function getJiraConnectionById(
  supabase: AnySupabase,
  connectionId: string
): Promise<JiraConnectionRecord | null> {
  const { data, error } = await supabase
    .from('jira_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !data) {
    return null
  }

  return data as JiraConnectionRecord
}

/**
 * Store Jira OAuth tokens after successful authorization
 */
export async function storeJiraConnection(
  supabase: AnySupabase,
  params: {
    projectId: string
    cloudId: string
    siteUrl: string
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string
    installedByUserId: string | null
    installedByEmail: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('jira_connections').upsert(
    {
      project_id: params.projectId,
      cloud_id: params.cloudId,
      site_url: params.siteUrl,
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      token_expires_at: params.tokenExpiresAt,
      installed_by_user_id: params.installedByUserId,
      installed_by_email: params.installedByEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id' }
  )

  if (error) {
    console.error('[jira.storeJiraConnection] Failed to store connection:', error)
    return { success: false, error: 'Failed to store Jira connection.' }
  }

  return { success: true }
}

/**
 * Update Jira connection configuration (project + issue type)
 */
export async function configureJiraConnection(
  supabase: AnySupabase,
  projectId: string,
  config: {
    jiraProjectKey: string
    jiraProjectId: string
    issueTypeId: string
    issueTypeName: string
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('jira_connections')
    .update({
      jira_project_key: config.jiraProjectKey,
      jira_project_id: config.jiraProjectId,
      issue_type_id: config.issueTypeId,
      issue_type_name: config.issueTypeName,
    })
    .eq('project_id', projectId)

  if (error) {
    console.error('[jira.configureJiraConnection] Failed:', error)
    return { success: false, error: 'Failed to configure Jira integration.' }
  }

  return { success: true }
}

/**
 * Update stored tokens after a refresh
 */
export async function updateJiraTokens(
  supabase: AnySupabase,
  connectionId: string,
  tokens: {
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('jira_connections')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: tokens.tokenExpiresAt,
    })
    .eq('id', connectionId)

  if (error) {
    console.error('[jira.updateJiraTokens] Failed:', error)
  }
}

/**
 * Disconnect Jira integration for a project
 */
export async function disconnectJira(
  supabase: AnySupabase,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('jira_connections')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    console.error('[jira.disconnectJira] Failed:', error)
    return { success: false, error: 'Failed to disconnect Jira.' }
  }

  return { success: true }
}

/**
 * Get Jira sync status for a specific issue
 */
export async function getJiraIssueSyncStatus(
  supabase: AnySupabase,
  issueId: string
): Promise<JiraIssueSyncStatus> {
  const { data, error } = await supabase
    .from('jira_issue_syncs')
    .select('jira_issue_key, jira_issue_url, last_sync_status, last_sync_error, last_synced_at, last_jira_status, last_webhook_received_at, retry_count')
    .eq('issue_id', issueId)
    .single()

  if (error || !data) {
    return {
      synced: false,
      jiraIssueKey: null,
      jiraIssueUrl: null,
      lastSyncStatus: null,
      lastSyncError: null,
      lastSyncedAt: null,
      lastJiraStatus: null,
      lastWebhookReceivedAt: null,
      retryCount: 0,
    }
  }

  return {
    synced: Boolean(data.jira_issue_key),
    jiraIssueKey: data.jira_issue_key,
    jiraIssueUrl: data.jira_issue_url,
    lastSyncStatus: data.last_sync_status,
    lastSyncError: data.last_sync_error,
    lastSyncedAt: data.last_synced_at,
    lastJiraStatus: data.last_jira_status,
    lastWebhookReceivedAt: data.last_webhook_received_at,
    retryCount: data.retry_count,
  }
}

/**
 * Get all connections that have failed syncs due for retry
 */
export async function getFailedSyncsDueForRetry(
  supabase: AnySupabase
): Promise<Array<{
  syncId: string
  issueId: string
  connectionId: string
  lastSyncAction: string
  retryCount: number
}>> {
  const { data, error } = await supabase
    .from('jira_issue_syncs')
    .select('id, issue_id, connection_id, last_sync_action, retry_count')
    .eq('last_sync_status', 'failed')
    .lt('retry_count', 3)

  if (error) {
    console.error('[jira.getFailedSyncsDueForRetry] Failed:', error)
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
