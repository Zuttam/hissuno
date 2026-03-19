import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { jiraConnections } from '@/lib/db/schema/app'
import type {
  JiraConnectionRecord,
  JiraIntegrationStatus,
} from '@/types/jira'

/**
 * Check if a project has Jira integration connected
 */
export async function hasJiraConnection(
  projectId: string
): Promise<JiraIntegrationStatus> {
  const rows = await db
    .select({
      site_url: jiraConnections.site_url,
      cloud_id: jiraConnections.cloud_id,
      installed_by_email: jiraConnections.installed_by_email,
      jira_project_key: jiraConnections.jira_project_key,
      jira_project_id: jiraConnections.jira_project_id,
      issue_type_name: jiraConnections.issue_type_name,
      is_enabled: jiraConnections.is_enabled,
      auto_sync_enabled: jiraConnections.auto_sync_enabled,
    })
    .from(jiraConnections)
    .where(eq(jiraConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
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
      autoSyncEnabled: true,
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
    autoSyncEnabled: data.auto_sync_enabled !== false,
  }
}

/**
 * Get the full Jira connection record for a project
 */
export async function getJiraConnection(
  projectId: string
): Promise<JiraConnectionRecord | null> {
  const rows = await db
    .select()
    .from(jiraConnections)
    .where(eq(jiraConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return data as unknown as JiraConnectionRecord
}

/**
 * Get Jira connection by connection ID
 */
export async function getJiraConnectionById(
  connectionId: string
): Promise<JiraConnectionRecord | null> {
  const rows = await db
    .select()
    .from(jiraConnections)
    .where(eq(jiraConnections.id, connectionId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return data as unknown as JiraConnectionRecord
}

/**
 * Store Jira OAuth tokens after successful authorization
 */
export async function storeJiraConnection(
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
  try {
    await db
      .insert(jiraConnections)
      .values({
        project_id: params.projectId,
        cloud_id: params.cloudId,
        site_url: params.siteUrl,
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
        token_expires_at: new Date(params.tokenExpiresAt),
        installed_by_user_id: params.installedByUserId,
        installed_by_email: params.installedByEmail,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: jiraConnections.project_id,
        set: {
          cloud_id: params.cloudId,
          site_url: params.siteUrl,
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
          token_expires_at: new Date(params.tokenExpiresAt),
          installed_by_user_id: params.installedByUserId,
          installed_by_email: params.installedByEmail,
          updated_at: new Date(),
        },
      })

    return { success: true }
  } catch (error) {
    console.error('[jira.storeJiraConnection] Failed to store connection:', error)
    return { success: false, error: 'Failed to store Jira connection.' }
  }
}

/**
 * Update Jira connection configuration (project + issue type)
 */
export async function configureJiraConnection(
  projectId: string,
  config: {
    jiraProjectKey: string
    jiraProjectId: string
    issueTypeId: string
    issueTypeName: string
    autoSyncEnabled?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, unknown> = {
    jira_project_key: config.jiraProjectKey,
    jira_project_id: config.jiraProjectId,
    issue_type_id: config.issueTypeId,
    issue_type_name: config.issueTypeName,
  }
  if (config.autoSyncEnabled !== undefined) {
    updateData.auto_sync_enabled = config.autoSyncEnabled
  }

  try {
    await db
      .update(jiraConnections)
      .set(updateData)
      .where(eq(jiraConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[jira.configureJiraConnection] Failed:', error)
    return { success: false, error: 'Failed to configure Jira integration.' }
  }
}

/**
 * Update stored tokens after a refresh
 */
export async function updateJiraTokens(
  connectionId: string,
  tokens: {
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string
  }
): Promise<void> {
  try {
    await db
      .update(jiraConnections)
      .set({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: new Date(tokens.tokenExpiresAt),
      })
      .where(eq(jiraConnections.id, connectionId))
  } catch (error) {
    console.error('[jira.updateJiraTokens] Failed:', error)
  }
}

/**
 * Disconnect Jira integration for a project
 */
export async function disconnectJira(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(jiraConnections)
      .where(eq(jiraConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[jira.disconnectJira] Failed:', error)
    return { success: false, error: 'Failed to disconnect Jira.' }
  }
}
