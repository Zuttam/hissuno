/**
 * Notion integration service layer.
 * Handles database operations for Notion connections.
 */

import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { notionConnections } from '@/lib/db/schema/app'

export interface NotionIntegrationStatus {
  connected: boolean
  workspaceId: string | null
  workspaceName: string | null
  authMethod: 'oauth' | 'token' | null
}

/**
 * Check if a project has Notion integration connected.
 */
export async function hasNotionConnection(
  projectId: string
): Promise<NotionIntegrationStatus> {
  const rows = await db
    .select({
      workspace_id: notionConnections.workspace_id,
      workspace_name: notionConnections.workspace_name,
      auth_method: notionConnections.auth_method,
    })
    .from(notionConnections)
    .where(eq(notionConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      workspaceId: null,
      workspaceName: null,
      authMethod: null,
    }
  }

  return {
    connected: true,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name,
    authMethod: data.auth_method as 'oauth' | 'token',
  }
}

/**
 * Get the access token for a project's Notion connection.
 */
export async function getNotionCredentials(
  projectId: string
): Promise<{ connectionId: string; accessToken: string; workspaceId: string } | null> {
  const rows = await db
    .select({
      id: notionConnections.id,
      access_token: notionConnections.access_token,
      workspace_id: notionConnections.workspace_id,
    })
    .from(notionConnections)
    .where(eq(notionConnections.project_id, projectId))

  const data = rows[0]
  if (!data) return null

  return {
    connectionId: data.id,
    accessToken: data.access_token,
    workspaceId: data.workspace_id,
  }
}

/**
 * Store Notion credentials after OAuth flow.
 * Uses upsert (onConflictDoUpdate on project_id).
 */
export async function storeNotionCredentials(params: {
  projectId: string
  accessToken: string
  workspaceId: string
  workspaceName: string | null
  workspaceIcon: string | null
  botId: string | null
  installedByUserId: string | null
}): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  try {
    const inserted = await db
      .insert(notionConnections)
      .values({
        project_id: params.projectId,
        access_token: params.accessToken,
        workspace_id: params.workspaceId,
        workspace_name: params.workspaceName,
        workspace_icon: params.workspaceIcon,
        bot_id: params.botId,
        auth_method: 'oauth',
        installed_by_user_id: params.installedByUserId,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: notionConnections.project_id,
        set: {
          access_token: params.accessToken,
          workspace_id: params.workspaceId,
          workspace_name: params.workspaceName,
          workspace_icon: params.workspaceIcon,
          bot_id: params.botId,
          auth_method: 'oauth',
          installed_by_user_id: params.installedByUserId,
          updated_at: new Date(),
        },
      })
      .returning({ id: notionConnections.id })

    const data = inserted[0]
    if (!data) {
      return { success: false, error: 'Failed to store Notion credentials.' }
    }

    return { success: true, connectionId: data.id }
  } catch (error) {
    console.error('[notion.storeNotionCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store Notion credentials.' }
  }
}

/**
 * Store a Notion Internal Integration Token for a project.
 * Uses upsert (onConflictDoUpdate on project_id).
 */
export async function storeNotionToken(params: {
  projectId: string
  accessToken: string
  workspaceName: string | null
  botId: string | null
  installedByUserId: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .insert(notionConnections)
      .values({
        project_id: params.projectId,
        access_token: params.accessToken,
        workspace_id: 'token',
        workspace_name: params.workspaceName,
        bot_id: params.botId,
        auth_method: 'token',
        installed_by_user_id: params.installedByUserId,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: notionConnections.project_id,
        set: {
          access_token: params.accessToken,
          workspace_id: 'token',
          workspace_name: params.workspaceName,
          bot_id: params.botId,
          auth_method: 'token',
          installed_by_user_id: params.installedByUserId,
          updated_at: new Date(),
        },
      })

    return { success: true }
  } catch (error) {
    console.error('[notion.storeNotionToken] Failed:', error)
    return { success: false, error: 'Failed to store Notion token.' }
  }
}

/**
 * Disconnect Notion integration.
 */
export async function disconnectNotion(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(notionConnections)
      .where(eq(notionConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[notion.disconnectNotion] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect Notion.' }
  }
}
