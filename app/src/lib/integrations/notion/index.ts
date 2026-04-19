/**
 * Project-scoped Notion helpers backed by integration_connections.
 * Used by the knowledge-service to resolve the workspace access token.
 */

import { listConnections, type ConnectionRow } from '../shared/connections'

export type NotionIntegrationStatus = {
  connected: boolean
  workspaceId: string | null
  workspaceName: string | null
  authMethod: 'oauth' | 'token' | null
}

type NotionCredentials = {
  accessToken?: string
  botId?: string
  authMethod?: 'oauth' | 'token'
}

type NotionSettings = {
  workspaceId?: string
  workspaceName?: string
}

async function loadNotionConnection(projectId: string): Promise<ConnectionRow | null> {
  const [conn] = await listConnections({ projectId, pluginId: 'notion' })
  return conn ?? null
}

export async function hasNotionConnection(projectId: string): Promise<NotionIntegrationStatus> {
  const conn = await loadNotionConnection(projectId)
  if (!conn) {
    return { connected: false, workspaceId: null, workspaceName: null, authMethod: null }
  }
  const creds = conn.credentials as NotionCredentials
  const settings = conn.settings as NotionSettings
  return {
    connected: true,
    workspaceId: settings.workspaceId ?? conn.externalAccountId,
    workspaceName: settings.workspaceName ?? conn.accountLabel,
    authMethod: creds.authMethod ?? 'oauth',
  }
}

export async function getNotionCredentials(
  projectId: string
): Promise<{ connectionId: string; accessToken: string; workspaceId: string } | null> {
  const conn = await loadNotionConnection(projectId)
  if (!conn) return null
  const creds = conn.credentials as NotionCredentials
  if (!creds.accessToken) return null
  const settings = conn.settings as NotionSettings
  return {
    connectionId: conn.id,
    accessToken: creds.accessToken,
    workspaceId: settings.workspaceId ?? conn.externalAccountId,
  }
}
