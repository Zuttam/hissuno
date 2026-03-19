/**
 * PostHog integration service layer.
 * Handles database operations for PostHog connections and sync tracking.
 */

import { db } from '@/lib/db'
import { eq, ne, lte, and, or, isNull } from 'drizzle-orm'
import { posthogConnections, posthogSyncRuns } from '@/lib/db/schema/app'
import { getRecentSyncRuns } from '@/lib/db/queries/posthog'

/**
 * Sync frequency options
 */
export type PosthogSyncFrequency = 'manual' | '1h' | '6h' | '24h'

/**
 * Filter configuration for sync behavior
 */
export interface PosthogFilterConfig {
  sync_new_contacts?: boolean  // default: false
  max_new_contacts?: number    // cap, default: 1000
  fromDate?: string            // ISO date string, e.g. "2025-01-01"
  toDate?: string              // ISO date string, e.g. "2025-12-31"
}

/**
 * Event configuration for feature mapping and signal detection
 */
export interface PosthogEventConfig {
  feature_mapping?: Record<string, string[]> // { "Export": ["export_csv", "export_pdf"], ... }
  signal_events?: string[] // ["$exception", "$rageclick", ...]
  person_properties?: string[] // ["plan", "email", ...]
}

/**
 * PostHog integration status
 */
export interface PosthogIntegrationStatus {
  connected: boolean
  host: string | null
  posthogProjectId: string | null
  eventConfig: PosthogEventConfig | null
  syncFrequency: PosthogSyncFrequency | null
  syncEnabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  nextSyncAt: string | null
  filterConfig: PosthogFilterConfig | null
}

/**
 * Check if a project has PostHog integration connected
 */
export async function hasPosthogConnection(
  projectId: string
): Promise<PosthogIntegrationStatus> {
  const rows = await db
    .select({
      host: posthogConnections.host,
      posthog_project_id: posthogConnections.posthog_project_id,
      event_config: posthogConnections.event_config,
      sync_frequency: posthogConnections.sync_frequency,
      sync_enabled: posthogConnections.sync_enabled,
      filter_config: posthogConnections.filter_config,
      last_sync_at: posthogConnections.last_sync_at,
      last_sync_status: posthogConnections.last_sync_status,
      last_sync_error: posthogConnections.last_sync_error,
      next_sync_at: posthogConnections.next_sync_at,
    })
    .from(posthogConnections)
    .where(eq(posthogConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      host: null,
      posthogProjectId: null,
      eventConfig: null,
      syncFrequency: null,
      syncEnabled: false,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      nextSyncAt: null,
      filterConfig: null,
    }
  }

  return {
    connected: true,
    host: data.host,
    posthogProjectId: data.posthog_project_id,
    eventConfig: (data.event_config as PosthogEventConfig) || null,
    syncFrequency: data.sync_frequency as PosthogSyncFrequency,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
    lastSyncStatus: data.last_sync_status,
    lastSyncError: data.last_sync_error,
    nextSyncAt: data.next_sync_at?.toISOString() ?? null,
    filterConfig: (data.filter_config as Record<string, unknown>) || null,
  }
}

/**
 * Get the connection ID and credentials for a project
 */
export async function getPosthogCredentials(
  projectId: string
): Promise<{
  connectionId: string
  apiKey: string
  host: string
  posthogProjectId: string
  eventConfig: PosthogEventConfig | null
  filterConfig: PosthogFilterConfig | null
  lastSyncAt: string | null
} | null> {
  const rows = await db
    .select({
      id: posthogConnections.id,
      api_key: posthogConnections.api_key,
      host: posthogConnections.host,
      posthog_project_id: posthogConnections.posthog_project_id,
      event_config: posthogConnections.event_config,
      filter_config: posthogConnections.filter_config,
      last_sync_at: posthogConnections.last_sync_at,
    })
    .from(posthogConnections)
    .where(eq(posthogConnections.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    connectionId: data.id,
    apiKey: data.api_key,
    host: data.host,
    posthogProjectId: data.posthog_project_id,
    eventConfig: (data.event_config as PosthogEventConfig) || null,
    filterConfig: (data.filter_config as PosthogFilterConfig) || null,
    lastSyncAt: data.last_sync_at?.toISOString() ?? null,
  }
}

/**
 * Store PostHog credentials after validation
 */
export async function storePosthogCredentials(params: {
  projectId: string
  apiKey: string
  host: string
  posthogProjectId: string
  eventConfig?: PosthogEventConfig
  filterConfig?: PosthogFilterConfig
  syncFrequency: PosthogSyncFrequency
}): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const nextSyncAt = calculateNextSyncTime(params.syncFrequency)

  try {
    const inserted = await db
      .insert(posthogConnections)
      .values({
        project_id: params.projectId,
        api_key: params.apiKey,
        host: params.host,
        posthog_project_id: params.posthogProjectId,
        event_config: params.eventConfig || {},
        filter_config: params.filterConfig || {},
        sync_frequency: params.syncFrequency,
        sync_enabled: params.syncFrequency !== 'manual',
        next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: posthogConnections.project_id,
        set: {
          api_key: params.apiKey,
          host: params.host,
          posthog_project_id: params.posthogProjectId,
          event_config: params.eventConfig || {},
          filter_config: params.filterConfig || {},
          sync_frequency: params.syncFrequency,
          sync_enabled: params.syncFrequency !== 'manual',
          next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
          updated_at: new Date(),
        },
      })
      .returning({ id: posthogConnections.id })

    const data = inserted[0]
    if (!data) {
      return { success: false, error: 'Failed to store PostHog credentials.' }
    }

    return { success: true, connectionId: data.id }
  } catch (error) {
    console.error('[posthog.storePosthogCredentials] Failed to store:', error)
    return { success: false, error: 'Failed to store PostHog credentials.' }
  }
}

/**
 * Update PostHog settings
 */
export async function updatePosthogSettings(
  projectId: string,
  settings: {
    syncFrequency?: PosthogSyncFrequency
    syncEnabled?: boolean
    eventConfig?: PosthogEventConfig
    filterConfig?: Record<string, unknown>
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

  if (settings.eventConfig !== undefined) {
    updateData.event_config = settings.eventConfig
  }

  if (settings.filterConfig !== undefined) {
    updateData.filter_config = settings.filterConfig
  }

  try {
    await db
      .update(posthogConnections)
      .set(updateData)
      .where(eq(posthogConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[posthog.updatePosthogSettings] Failed:', error)
    return { success: false, error: 'Failed to update PostHog settings.' }
  }
}

/**
 * Disconnect PostHog integration
 */
export async function disconnectPosthog(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete sync runs
    const connRows = await db
      .select({ id: posthogConnections.id })
      .from(posthogConnections)
      .where(eq(posthogConnections.project_id, projectId))

    const connection = connRows[0]
    if (connection) {
      await db
        .delete(posthogSyncRuns)
        .where(eq(posthogSyncRuns.connection_id, connection.id))
    }

    // Delete the connection
    await db
      .delete(posthogConnections)
      .where(eq(posthogConnections.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[posthog.disconnectPosthog] Failed to delete:', error)
    return { success: false, error: 'Failed to disconnect PostHog.' }
  }
}

/**
 * Update sync state after a sync operation
 */
export async function updateSyncState(
  projectId: string,
  state: {
    status: 'success' | 'error' | 'in_progress'
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
      .select({ sync_frequency: posthogConnections.sync_frequency })
      .from(posthogConnections)
      .where(eq(posthogConnections.project_id, projectId))

    const conn = connRows[0]
    if (conn) {
      const nextSync = calculateNextSyncTime(conn.sync_frequency as PosthogSyncFrequency)
      updateData.next_sync_at = nextSync ? new Date(nextSync) : null
    }
  }

  if (state.error) {
    updateData.last_sync_error = state.error
  } else if (state.status === 'success') {
    updateData.last_sync_error = null
  }

  await db
    .update(posthogConnections)
    .set(updateData)
    .where(eq(posthogConnections.project_id, projectId))
}

/**
 * Get sync statistics for a project
 */
export async function getSyncStats(
  projectId: string
): Promise<{
  lastSyncRuns: Array<{
    status: string
    startedAt: string
    contactsMatched: number
    sessionsCreated: number
    contactsCreated: number
  }>
}> {
  const connRows = await db
    .select({ id: posthogConnections.id })
    .from(posthogConnections)
    .where(eq(posthogConnections.project_id, projectId))

  const connection = connRows[0]

  if (!connection) {
    return { lastSyncRuns: [] }
  }

  const runs = await getRecentSyncRuns(connection.id)

  return {
    lastSyncRuns: runs.map((run) => ({
      status: run.status,
      startedAt: run.started_at?.toISOString() ?? '',
      contactsMatched: run.contacts_matched || 0,
      sessionsCreated: run.sessions_created || 0,
      contactsCreated: run.contacts_created || 0,
    })),
  }
}

/**
 * Get connections that are due for sync
 */
export async function getConnectionsDueForSync(): Promise<Array<{ id: string; projectId: string }>> {
  const now = new Date()

  const rows = await db
    .select({ id: posthogConnections.id, project_id: posthogConnections.project_id })
    .from(posthogConnections)
    .where(
      and(
        eq(posthogConnections.sync_enabled, true),
        ne(posthogConnections.sync_frequency, 'manual'),
        lte(posthogConnections.next_sync_at, now),
        or(isNull(posthogConnections.last_sync_status), ne(posthogConnections.last_sync_status, 'in_progress'))
      )
    )

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
  }))
}

/**
 * Calculate next sync time based on frequency
 */
function calculateNextSyncTime(frequency: PosthogSyncFrequency): string | null {
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
