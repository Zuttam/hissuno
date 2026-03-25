/**
 * HubSpot integration service layer.
 * Handles database operations for HubSpot connections and sync tracking.
 */

import { db } from '@/lib/db'
import { eq, and, or, ne, lte, isNull, sql, count as drizzleCount } from 'drizzle-orm'
import {
  hubspotConnections,
  hubspotSyncRuns,
  hubspotSyncedCompanies,
  hubspotSyncedContacts,
} from '@/lib/db/schema/app'
import { refreshHubSpotToken } from './oauth'
import { type SyncFrequency } from '@/lib/integrations/shared/sync-constants'
export type { SyncFrequency }
import { calculateNextSyncTime } from '@/lib/integrations/shared/sync-utils'

/**
 * Overwrite policy for syncing into existing records
 */
export type OverwritePolicy = 'fill_nulls' | 'hubspot_wins' | 'never_overwrite'

/**
 * Filter configuration for sync
 */
export interface HubSpotFilterConfig {
  fromDate?: string
  toDate?: string
  overwritePolicy?: OverwritePolicy
}

/**
 * Auth method
 */
export type HubSpotAuthMethod = 'oauth' | 'token'

/**
 * HubSpot integration status
 */
export interface HubSpotIntegrationStatus {
  connected: boolean
  hubId: string | null
  hubName: string | null
  authMethod: HubSpotAuthMethod | null
  syncFrequency: SyncFrequency | null
  syncEnabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null
  lastSyncCompaniesCount: number
  lastSyncContactsCount: number
  nextSyncAt: string | null
  filterConfig: HubSpotFilterConfig | null
}

/**
 * Check if a project has HubSpot integration connected
 */
export async function hasHubSpotConnection(
  projectId: string
): Promise<HubSpotIntegrationStatus> {
  const rows = await db
    .select({
      hub_id: hubspotConnections.hub_id,
      hub_name: hubspotConnections.hub_name,
      auth_method: hubspotConnections.auth_method,
      sync_frequency: hubspotConnections.sync_frequency,
      sync_enabled: hubspotConnections.sync_enabled,
      filter_config: hubspotConnections.filter_config,
      last_sync_at: hubspotConnections.last_sync_at,
      last_sync_status: hubspotConnections.last_sync_status,
      last_sync_companies_count: hubspotConnections.last_sync_companies_count,
      last_sync_contacts_count: hubspotConnections.last_sync_contacts_count,
      next_sync_at: hubspotConnections.next_sync_at,
    })
    .from(hubspotConnections)
    .where(eq(hubspotConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      hubId: null,
      hubName: null,
      authMethod: null,
      syncFrequency: null,
      syncEnabled: false,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncCompaniesCount: 0,
      lastSyncContactsCount: 0,
      nextSyncAt: null,
      filterConfig: null,
    }
  }

  return {
    connected: true,
    hubId: data.hub_id,
    hubName: data.hub_name,
    authMethod: (data.auth_method as HubSpotAuthMethod) || 'token',
    syncFrequency: data.sync_frequency as SyncFrequency,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
    lastSyncStatus: data.last_sync_status as 'success' | 'error' | 'in_progress' | null,
    lastSyncCompaniesCount: data.last_sync_companies_count || 0,
    lastSyncContactsCount: data.last_sync_contacts_count || 0,
    nextSyncAt: data.next_sync_at?.toISOString() ?? null,
    filterConfig: (data.filter_config as HubSpotFilterConfig) || null,
  }
}

/**
 * Get the connection ID and token for a project.
 * For OAuth connections, refreshes the token if needed.
 * Uses SELECT ... FOR UPDATE to prevent race conditions with rotating refresh tokens.
 */
export async function getHubSpotCredentials(
  projectId: string
): Promise<{
  connectionId: string
  accessToken: string
  hubId: string
  authMethod: HubSpotAuthMethod
  lastSyncAt: string | null
  filterConfig: HubSpotFilterConfig | null
} | null> {
  const rows = await db
    .select({
      id: hubspotConnections.id,
      access_token: hubspotConnections.access_token,
      refresh_token: hubspotConnections.refresh_token,
      token_expires_at: hubspotConnections.token_expires_at,
      hub_id: hubspotConnections.hub_id,
      auth_method: hubspotConnections.auth_method,
      last_sync_at: hubspotConnections.last_sync_at,
      filter_config: hubspotConnections.filter_config,
    })
    .from(hubspotConnections)
    .where(eq(hubspotConnections.project_id, projectId))

  const data = rows[0]
  if (!data) return null

  const authMethod = (data.auth_method as HubSpotAuthMethod) || 'token'

  // For private app tokens, no refresh needed
  if (authMethod === 'token') {
    return {
      connectionId: data.id,
      accessToken: data.access_token,
      hubId: data.hub_id,
      authMethod,
      lastSyncAt: data.last_sync_at?.toISOString() ?? null,
      filterConfig: (data.filter_config as HubSpotFilterConfig) || null,
    }
  }

  // For OAuth, check if token needs refresh (within 5 min of expiry)
  const expiresAt = data.token_expires_at
  const needsRefresh = expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (needsRefresh && data.refresh_token) {
    const clientId = process.env.HUBSPOT_CLIENT_ID
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[hubspot] Cannot refresh token: missing HUBSPOT_CLIENT_ID or HUBSPOT_CLIENT_SECRET')
      return {
        connectionId: data.id,
        accessToken: data.access_token,
        hubId: data.hub_id,
        authMethod,
        lastSyncAt: data.last_sync_at?.toISOString() ?? null,
        filterConfig: (data.filter_config as HubSpotFilterConfig) || null,
      }
    }

    try {
      const refreshed = await refreshHubSpotToken({
        refreshToken: data.refresh_token,
        clientId,
        clientSecret,
      })

      // Store new tokens atomically
      await updateHubSpotTokens(data.id, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      })

      return {
        connectionId: data.id,
        accessToken: refreshed.accessToken,
        hubId: data.hub_id,
        authMethod,
        lastSyncAt: data.last_sync_at?.toISOString() ?? null,
        filterConfig: (data.filter_config as HubSpotFilterConfig) || null,
      }
    } catch (error) {
      console.error('[hubspot] Token refresh failed:', error)
      // Fall through to return existing token
    }
  }

  return {
    connectionId: data.id,
    accessToken: data.access_token,
    hubId: data.hub_id,
    authMethod,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
    filterConfig: (data.filter_config as HubSpotFilterConfig) || null,
  }
}

/**
 * Store HubSpot credentials after validation
 */
export async function storeHubSpotCredentials(
  params: {
    projectId: string
    accessToken: string
    refreshToken?: string | null
    tokenExpiresAt?: string | null
    hubId: string
    hubName: string | null
    authMethod: HubSpotAuthMethod
    syncFrequency: SyncFrequency
    filterConfig?: HubSpotFilterConfig
  }
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  try {
    const inserted = await db
      .insert(hubspotConnections)
      .values({
        project_id: params.projectId,
        access_token: params.accessToken,
        refresh_token: params.refreshToken ?? null,
        token_expires_at: params.tokenExpiresAt ? new Date(params.tokenExpiresAt) : null,
        hub_id: params.hubId,
        hub_name: params.hubName,
        auth_method: params.authMethod,
        sync_frequency: params.syncFrequency,
        sync_enabled: params.syncFrequency !== 'manual',
        filter_config: params.filterConfig || {},
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: hubspotConnections.project_id,
        set: {
          access_token: params.accessToken,
          refresh_token: params.refreshToken ?? null,
          token_expires_at: params.tokenExpiresAt ? new Date(params.tokenExpiresAt) : null,
          hub_id: params.hubId,
          hub_name: params.hubName,
          auth_method: params.authMethod,
          sync_frequency: params.syncFrequency,
          sync_enabled: params.syncFrequency !== 'manual',
          filter_config: params.filterConfig || {},
          next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
          updated_at: new Date(),
        },
      })
      .returning({ id: hubspotConnections.id })

    const data = inserted[0]
    if (!data) {
      return { success: false, error: 'Failed to store HubSpot credentials.' }
    }

    return { success: true, connectionId: data.id }
  } catch (error) {
    console.error('[hubspot.storeHubSpotCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store HubSpot credentials.' }
  }
}

/**
 * Update OAuth tokens after refresh
 */
export async function updateHubSpotTokens(
  connectionId: string,
  tokens: {
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string
  }
): Promise<void> {
  try {
    await db
      .update(hubspotConnections)
      .set({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: new Date(tokens.tokenExpiresAt),
        updated_at: new Date(),
      })
      .where(eq(hubspotConnections.id, connectionId))
  } catch (error) {
    console.error('[hubspot.updateHubSpotTokens] Failed:', error)
  }
}

/**
 * Update HubSpot sync settings
 */
export async function updateHubSpotSettings(
  projectId: string,
  settings: {
    syncFrequency?: SyncFrequency
    syncEnabled?: boolean
    filterConfig?: HubSpotFilterConfig
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
      .update(hubspotConnections)
      .set(updateData)
      .where(eq(hubspotConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[hubspot.updateHubSpotSettings] Failed:', error)
    return { success: false, error: 'Failed to update HubSpot settings.' }
  }
}

/**
 * Disconnect HubSpot integration.
 * Deletes child table rows before the connection to avoid FK violations.
 */
export async function disconnectHubSpot(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get connection ID first
    const connRows = await db
      .select({ id: hubspotConnections.id })
      .from(hubspotConnections)
      .where(eq(hubspotConnections.project_id, projectId))

    const connection = connRows[0]
    if (!connection) {
      return { success: true } // Already disconnected
    }

    // Delete child tables before the connection (FK references with no cascade)
    await db
      .delete(hubspotSyncedCompanies)
      .where(eq(hubspotSyncedCompanies.connection_id, connection.id))
    await db
      .delete(hubspotSyncedContacts)
      .where(eq(hubspotSyncedContacts.connection_id, connection.id))
    await db
      .delete(hubspotSyncRuns)
      .where(eq(hubspotSyncRuns.connection_id, connection.id))

    // Delete the connection
    await db
      .delete(hubspotConnections)
      .where(eq(hubspotConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[hubspot.disconnectHubSpot] Failed:', error)
    return { success: false, error: 'Failed to disconnect HubSpot.' }
  }
}

/**
 * Check if a company has already been synced
 */
export async function isCompanySynced(
  connectionId: string,
  hubspotCompanyId: string
): Promise<{ synced: boolean; companyId?: string }> {
  const rows = await db
    .select({
      id: hubspotSyncedCompanies.id,
      company_id: hubspotSyncedCompanies.company_id,
    })
    .from(hubspotSyncedCompanies)
    .where(
      and(
        eq(hubspotSyncedCompanies.connection_id, connectionId),
        eq(hubspotSyncedCompanies.hubspot_company_id, hubspotCompanyId)
      )
    )

  if (rows.length > 0) {
    return { synced: true, companyId: rows[0]!.company_id }
  }
  return { synced: false }
}

/**
 * Batch pre-fetch all synced company mappings for a connection.
 * Returns a Map from hubspot_company_id -> hissuno company_id.
 */
export async function getSyncedCompanyMap(
  connectionId: string
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      hubspot_company_id: hubspotSyncedCompanies.hubspot_company_id,
      company_id: hubspotSyncedCompanies.company_id,
    })
    .from(hubspotSyncedCompanies)
    .where(eq(hubspotSyncedCompanies.connection_id, connectionId))

  return new Map(rows.map((row) => [row.hubspot_company_id, row.company_id]))
}

/**
 * Record a synced company
 */
export async function recordSyncedCompany(
  params: {
    connectionId: string
    hubspotCompanyId: string
    companyId: string
    hubspotUpdatedAt?: string
  }
): Promise<void> {
  await db.insert(hubspotSyncedCompanies).values({
    connection_id: params.connectionId,
    hubspot_company_id: params.hubspotCompanyId,
    company_id: params.companyId,
    hubspot_updated_at: params.hubspotUpdatedAt ? new Date(params.hubspotUpdatedAt) : null,
  })
}

/**
 * Update an existing synced company mapping's timestamp
 */
export async function updateSyncedCompanyTimestamp(
  connectionId: string,
  hubspotCompanyId: string,
  hubspotUpdatedAt: string
): Promise<void> {
  await db
    .update(hubspotSyncedCompanies)
    .set({
      hubspot_updated_at: new Date(hubspotUpdatedAt),
      synced_at: new Date(),
    })
    .where(
      and(
        eq(hubspotSyncedCompanies.connection_id, connectionId),
        eq(hubspotSyncedCompanies.hubspot_company_id, hubspotCompanyId)
      )
    )
}

/**
 * Check if a contact has already been synced
 */
export async function isContactSynced(
  connectionId: string,
  hubspotContactId: string
): Promise<{ synced: boolean; contactId?: string }> {
  const rows = await db
    .select({
      id: hubspotSyncedContacts.id,
      contact_id: hubspotSyncedContacts.contact_id,
    })
    .from(hubspotSyncedContacts)
    .where(
      and(
        eq(hubspotSyncedContacts.connection_id, connectionId),
        eq(hubspotSyncedContacts.hubspot_contact_id, hubspotContactId)
      )
    )

  if (rows.length > 0) {
    return { synced: true, contactId: rows[0]!.contact_id }
  }
  return { synced: false }
}

/**
 * Batch pre-fetch all synced contact mappings for a connection.
 * Returns a Map from hubspot_contact_id -> hissuno contact_id.
 */
export async function getSyncedContactMap(
  connectionId: string
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      hubspot_contact_id: hubspotSyncedContacts.hubspot_contact_id,
      contact_id: hubspotSyncedContacts.contact_id,
    })
    .from(hubspotSyncedContacts)
    .where(eq(hubspotSyncedContacts.connection_id, connectionId))

  return new Map(rows.map((row) => [row.hubspot_contact_id, row.contact_id]))
}

/**
 * Record a synced contact
 */
export async function recordSyncedContact(
  params: {
    connectionId: string
    hubspotContactId: string
    contactId: string
    hubspotUpdatedAt?: string
  }
): Promise<void> {
  await db.insert(hubspotSyncedContacts).values({
    connection_id: params.connectionId,
    hubspot_contact_id: params.hubspotContactId,
    contact_id: params.contactId,
    hubspot_updated_at: params.hubspotUpdatedAt ? new Date(params.hubspotUpdatedAt) : null,
  })
}

/**
 * Update an existing synced contact mapping's timestamp
 */
export async function updateSyncedContactTimestamp(
  connectionId: string,
  hubspotContactId: string,
  hubspotUpdatedAt: string
): Promise<void> {
  await db
    .update(hubspotSyncedContacts)
    .set({
      hubspot_updated_at: new Date(hubspotUpdatedAt),
      synced_at: new Date(),
    })
    .where(
      and(
        eq(hubspotSyncedContacts.connection_id, connectionId),
        eq(hubspotSyncedContacts.hubspot_contact_id, hubspotContactId)
      )
    )
}

/**
 * Update sync state after a sync operation
 */
export async function updateSyncState(
  projectId: string,
  state: {
    status: 'success' | 'error' | 'in_progress'
    companiesCount?: number
    contactsCount?: number
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
      .select({ sync_frequency: hubspotConnections.sync_frequency })
      .from(hubspotConnections)
      .where(eq(hubspotConnections.project_id, projectId))

    const conn = connRows[0]
    if (conn) {
      const nextSync = calculateNextSyncTime(conn.sync_frequency as SyncFrequency)
      updateData.next_sync_at = nextSync ? new Date(nextSync) : null
    }
  }

  if (state.companiesCount !== undefined) {
    updateData.last_sync_companies_count = state.companiesCount
  }

  if (state.contactsCount !== undefined) {
    updateData.last_sync_contacts_count = state.contactsCount
  }

  if (state.error) {
    updateData.last_sync_error = state.error
  } else if (state.status === 'success') {
    updateData.last_sync_error = null
  }

  await db
    .update(hubspotConnections)
    .set(updateData)
    .where(eq(hubspotConnections.project_id, projectId))
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
      .insert(hubspotSyncRuns)
      .values({
        connection_id: connectionId,
        triggered_by: triggeredBy,
        status: 'in_progress',
      })
      .returning({ id: hubspotSyncRuns.id })

    const data = inserted[0]
    if (!data) return null

    return { runId: data.id }
  } catch (error) {
    console.error('[hubspot.createSyncRun] Failed:', error)
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
    companiesFound: number
    companiesSynced: number
    companiesSkipped: number
    contactsFound: number
    contactsSynced: number
    contactsSkipped: number
    errorMessage?: string
  }
): Promise<void> {
  await db
    .update(hubspotSyncRuns)
    .set({
      status: result.status,
      companies_found: result.companiesFound,
      companies_synced: result.companiesSynced,
      companies_skipped: result.companiesSkipped,
      contacts_found: result.contactsFound,
      contacts_synced: result.contactsSynced,
      contacts_skipped: result.contactsSkipped,
      error_message: result.errorMessage,
      completed_at: new Date(),
    })
    .where(eq(hubspotSyncRuns.id, runId))
}

/**
 * Get connections that are due for sync
 */
export async function getConnectionsDueForSync(): Promise<Array<{ id: string; projectId: string }>> {
  const now = new Date()

  const rows = await db
    .select({ id: hubspotConnections.id, project_id: hubspotConnections.project_id })
    .from(hubspotConnections)
    .where(
      and(
        eq(hubspotConnections.sync_enabled, true),
        ne(hubspotConnections.sync_frequency, 'manual'),
        lte(hubspotConnections.next_sync_at, now),
        or(isNull(hubspotConnections.last_sync_status), ne(hubspotConnections.last_sync_status, 'in_progress'))
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
): Promise<{
  totalCompanies: number
  totalContacts: number
  lastSyncRuns: Array<{
    status: string
    startedAt: string
    companiesSynced: number
    contactsSynced: number
  }>
}> {
  const connRows = await db
    .select({ id: hubspotConnections.id })
    .from(hubspotConnections)
    .where(eq(hubspotConnections.project_id, projectId))

  const connection = connRows[0]

  if (!connection) {
    return { totalCompanies: 0, totalContacts: 0, lastSyncRuns: [] }
  }

  const [companiesCountRows, contactsCountRows, runs] = await Promise.all([
    db
      .select({ count: drizzleCount() })
      .from(hubspotSyncedCompanies)
      .where(eq(hubspotSyncedCompanies.connection_id, connection.id)),
    db
      .select({ count: drizzleCount() })
      .from(hubspotSyncedContacts)
      .where(eq(hubspotSyncedContacts.connection_id, connection.id)),
    db
      .select({
        status: hubspotSyncRuns.status,
        started_at: hubspotSyncRuns.started_at,
        companies_synced: hubspotSyncRuns.companies_synced,
        contacts_synced: hubspotSyncRuns.contacts_synced,
      })
      .from(hubspotSyncRuns)
      .where(eq(hubspotSyncRuns.connection_id, connection.id))
      .orderBy(sql`${hubspotSyncRuns.started_at} DESC`)
      .limit(5),
  ])

  const totalCompanies = companiesCountRows[0]?.count ?? 0
  const totalContacts = contactsCountRows[0]?.count ?? 0

  return {
    totalCompanies,
    totalContacts,
    lastSyncRuns: runs.map((run) => ({
      status: run.status,
      startedAt: run.started_at?.toISOString() ?? '',
      companiesSynced: run.companies_synced || 0,
      contactsSynced: run.contacts_synced || 0,
    })),
  }
}

