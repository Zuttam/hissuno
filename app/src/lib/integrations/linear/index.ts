import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { linearConnections } from '@/lib/db/schema/app'
import type {
  LinearAuthMethod,
  LinearConnectionRecord,
  LinearIntegrationStatus,
} from '@/types/linear'

/**
 * Check if a project has Linear integration connected
 */
export async function hasLinearConnection(
  projectId: string
): Promise<LinearIntegrationStatus> {
  const rows = await db
    .select({
      organization_id: linearConnections.organization_id,
      organization_name: linearConnections.organization_name,
      auth_method: linearConnections.auth_method,
      team_id: linearConnections.team_id,
      team_name: linearConnections.team_name,
      team_key: linearConnections.team_key,
      is_enabled: linearConnections.is_enabled,
      auto_sync_enabled: linearConnections.auto_sync_enabled,
    })
    .from(linearConnections)
    .where(eq(linearConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
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
      authMethod: null,
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
    authMethod: (data.auth_method as LinearAuthMethod) || 'oauth',
  }
}

/**
 * Get the full Linear connection record for a project
 */
export async function getLinearConnection(
  projectId: string
): Promise<LinearConnectionRecord | null> {
  const rows = await db
    .select()
    .from(linearConnections)
    .where(eq(linearConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return data as unknown as LinearConnectionRecord
}

/**
 * Get Linear connection by connection ID
 */
export async function getLinearConnectionById(
  connectionId: string
): Promise<LinearConnectionRecord | null> {
  const rows = await db
    .select()
    .from(linearConnections)
    .where(eq(linearConnections.id, connectionId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return data as unknown as LinearConnectionRecord
}

/**
 * Store Linear OAuth tokens after successful authorization
 */
export async function storeLinearConnection(
  params: {
    projectId: string
    accessToken: string
    refreshToken?: string | null
    tokenExpiresAt?: string | null
    organizationId: string
    organizationName: string
    installedByUserId: string | null
    installedByEmail: string | null
    authMethod?: LinearAuthMethod
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authMethod = params.authMethod ?? 'oauth'
    await db
      .insert(linearConnections)
      .values({
        project_id: params.projectId,
        auth_method: authMethod,
        access_token: params.accessToken,
        refresh_token: params.refreshToken ?? null,
        token_expires_at: params.tokenExpiresAt ? new Date(params.tokenExpiresAt) : null,
        organization_id: params.organizationId,
        organization_name: params.organizationName,
        installed_by_user_id: params.installedByUserId,
        installed_by_email: params.installedByEmail,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: linearConnections.project_id,
        set: {
          auth_method: authMethod,
          access_token: params.accessToken,
          refresh_token: params.refreshToken ?? null,
          token_expires_at: params.tokenExpiresAt ? new Date(params.tokenExpiresAt) : null,
          organization_id: params.organizationId,
          organization_name: params.organizationName,
          installed_by_user_id: params.installedByUserId,
          installed_by_email: params.installedByEmail,
          updated_at: new Date(),
        },
      })

    return { success: true }
  } catch (error) {
    console.error('[linear.storeLinearConnection] Failed to store connection:', error)
    return { success: false, error: 'Failed to store Linear connection.' }
  }
}

/**
 * Update Linear connection configuration (team + auto_sync)
 */
export async function configureLinearConnection(
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

  try {
    await db
      .update(linearConnections)
      .set(updateData)
      .where(eq(linearConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[linear.configureLinearConnection] Failed:', error)
    return { success: false, error: 'Failed to configure Linear integration.' }
  }
}

/**
 * Update stored tokens after a refresh
 */
export async function updateLinearTokens(
  connectionId: string,
  tokens: {
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string
  }
): Promise<void> {
  try {
    await db
      .update(linearConnections)
      .set({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: new Date(tokens.tokenExpiresAt),
      })
      .where(eq(linearConnections.id, connectionId))
  } catch (error) {
    console.error('[linear.updateLinearTokens] Failed:', error)
  }
}

/**
 * Disconnect Linear integration for a project
 */
export async function disconnectLinear(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(linearConnections)
      .where(eq(linearConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[linear.disconnectLinear] Failed:', error)
    return { success: false, error: 'Failed to disconnect Linear.' }
  }
}
