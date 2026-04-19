/**
 * CRUD layer over integration_connections + integration_streams.
 *
 * Used by:
 *   - Route handlers under /api/(project)/plugins/[pluginId]/*
 *   - The sync-runner
 *   - The cron dispatcher (listStreamsDue)
 *
 * Business rules live here so routes stay thin.
 */

import { db } from '@/lib/db'
import { eq, and, or, ne, lte, isNull, desc } from 'drizzle-orm'
import {
  integrationConnections,
  integrationStreams,
} from '@/lib/db/schema/app'
import type {
  Credentials,
  Settings,
  FilterConfig,
  StreamKind,
  SyncFrequency,
} from '../plugin-kit'
import { calculateNextSyncTime } from './sync-utils'

// ============================================================================
// Connection rows
// ============================================================================

export interface ConnectionRow {
  id: string
  projectId: string
  pluginId: string
  externalAccountId: string
  accountLabel: string
  credentials: Credentials
  settings: Settings
  createdAt: Date | null
  updatedAt: Date | null
}

function mapConnection(row: typeof integrationConnections.$inferSelect): ConnectionRow {
  return {
    id: row.id,
    projectId: row.project_id,
    pluginId: row.plugin_id,
    externalAccountId: row.external_account_id,
    accountLabel: row.account_label,
    credentials: (row.credentials ?? {}) as Credentials,
    settings: (row.settings ?? {}) as Settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getConnection(connectionId: string): Promise<ConnectionRow | null> {
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1)
  return rows[0] ? mapConnection(rows[0]) : null
}

export async function listConnections(params: {
  projectId: string
  pluginId?: string
}): Promise<ConnectionRow[]> {
  const where = params.pluginId
    ? and(
        eq(integrationConnections.project_id, params.projectId),
        eq(integrationConnections.plugin_id, params.pluginId)
      )
    : eq(integrationConnections.project_id, params.projectId)

  const rows = await db
    .select()
    .from(integrationConnections)
    .where(where)
    .orderBy(desc(integrationConnections.created_at))

  return rows.map(mapConnection)
}

/**
 * Resolve a connection by provider-stable identifier — used by webhook handlers
 * that receive an external account id (Slack team_id, GitHub installation_id, …)
 * and need to dispatch to the matching hissuno connection.
 *
 * Returns the first match across projects; if the same workspace is connected
 * to multiple projects this picks one deterministically by created_at.
 */
export async function findConnectionByExternalId(
  pluginId: string,
  externalAccountId: string
): Promise<ConnectionRow | null> {
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.plugin_id, pluginId),
        eq(integrationConnections.external_account_id, externalAccountId)
      )
    )
    .orderBy(desc(integrationConnections.created_at))
    .limit(1)
  return rows[0] ? mapConnection(rows[0]) : null
}

export interface CreateConnectionInput {
  projectId: string
  pluginId: string
  externalAccountId: string
  accountLabel: string
  credentials: Credentials
  settings?: Settings
}

export async function createConnection(
  input: CreateConnectionInput
): Promise<ConnectionRow> {
  const [row] = await db
    .insert(integrationConnections)
    .values({
      project_id: input.projectId,
      plugin_id: input.pluginId,
      external_account_id: input.externalAccountId,
      account_label: input.accountLabel,
      credentials: input.credentials,
      settings: input.settings ?? {},
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        integrationConnections.project_id,
        integrationConnections.plugin_id,
        integrationConnections.external_account_id,
      ],
      set: {
        account_label: input.accountLabel,
        credentials: input.credentials,
        settings: input.settings ?? {},
        updated_at: new Date(),
      },
    })
    .returning()

  return mapConnection(row)
}

export async function updateConnection(
  connectionId: string,
  input: {
    credentials?: Credentials
    settings?: Settings
    accountLabel?: string
  }
): Promise<void> {
  const set: Record<string, unknown> = { updated_at: new Date() }
  if (input.credentials !== undefined) set.credentials = input.credentials
  if (input.settings !== undefined) set.settings = input.settings
  if (input.accountLabel !== undefined) set.account_label = input.accountLabel
  await db
    .update(integrationConnections)
    .set(set)
    .where(eq(integrationConnections.id, connectionId))
}

export async function deleteConnection(connectionId: string): Promise<void> {
  // Cascade handles streams, sync_runs, and synced_records via FK onDelete.
  await db
    .delete(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
}

// ============================================================================
// Stream rows
// ============================================================================

export interface StreamRow {
  id: string
  connectionId: string
  pluginId: string
  streamId: string
  streamKind: StreamKind
  enabled: boolean
  frequency: SyncFrequency
  filterConfig: FilterConfig
  settings: Settings
  lastSyncAt: Date | null
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null
  lastSyncError: string | null
  lastSyncCounts: Record<string, number> | null
  nextSyncAt: Date | null
  createdAt: Date | null
  updatedAt: Date | null
}

function mapStream(row: typeof integrationStreams.$inferSelect): StreamRow {
  return {
    id: row.id,
    connectionId: row.connection_id,
    pluginId: row.plugin_id,
    streamId: row.stream_id,
    streamKind: row.stream_kind as StreamKind,
    enabled: row.enabled,
    frequency: row.frequency as SyncFrequency,
    filterConfig: (row.filter_config ?? {}) as FilterConfig,
    settings: (row.settings ?? {}) as Settings,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status as StreamRow['lastSyncStatus'],
    lastSyncError: row.last_sync_error,
    lastSyncCounts: (row.last_sync_counts as Record<string, number> | null) ?? null,
    nextSyncAt: row.next_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listStreams(connectionId: string): Promise<StreamRow[]> {
  const rows = await db
    .select()
    .from(integrationStreams)
    .where(eq(integrationStreams.connection_id, connectionId))
    .orderBy(integrationStreams.stream_id)
  return rows.map(mapStream)
}

export async function getStream(
  connectionId: string,
  streamId: string
): Promise<StreamRow | null> {
  const rows = await db
    .select()
    .from(integrationStreams)
    .where(
      and(
        eq(integrationStreams.connection_id, connectionId),
        eq(integrationStreams.stream_id, streamId)
      )
    )
    .limit(1)
  return rows[0] ? mapStream(rows[0]) : null
}

export interface UpsertStreamInput {
  connectionId: string
  pluginId: string
  streamId: string
  streamKind: StreamKind
  enabled?: boolean
  frequency?: SyncFrequency
  filterConfig?: FilterConfig
  settings?: Settings
}

export async function upsertStream(input: UpsertStreamInput): Promise<StreamRow> {
  const frequency = input.frequency ?? 'manual'
  const nextSyncAt =
    input.enabled !== false && frequency !== 'manual' && frequency !== 'webhook'
      ? calculateNextSyncTime(frequency)
      : null

  const [row] = await db
    .insert(integrationStreams)
    .values({
      connection_id: input.connectionId,
      plugin_id: input.pluginId,
      stream_id: input.streamId,
      stream_kind: input.streamKind,
      enabled: input.enabled ?? true,
      frequency,
      filter_config: input.filterConfig ?? {},
      settings: input.settings ?? {},
      next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [integrationStreams.connection_id, integrationStreams.stream_id],
      set: {
        stream_kind: input.streamKind,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.frequency !== undefined ? { frequency } : {}),
        ...(input.filterConfig !== undefined ? { filter_config: input.filterConfig } : {}),
        ...(input.settings !== undefined ? { settings: input.settings } : {}),
        ...(nextSyncAt ? { next_sync_at: new Date(nextSyncAt) } : {}),
        updated_at: new Date(),
      },
    })
    .returning()

  return mapStream(row)
}

export async function deleteStream(connectionId: string, streamId: string): Promise<void> {
  await db
    .delete(integrationStreams)
    .where(
      and(
        eq(integrationStreams.connection_id, connectionId),
        eq(integrationStreams.stream_id, streamId)
      )
    )
}

// ============================================================================
// Cron dispatch
// ============================================================================

export interface DueStream {
  streamRowId: string
  connectionId: string
  pluginId: string
  streamId: string
  projectId: string
}

/**
 * Returns every stream that should be processed by the next cron tick.
 * Excludes manual + webhook streams and streams already in_progress.
 */
export async function listStreamsDue(): Promise<DueStream[]> {
  const now = new Date()

  const rows = await db
    .select({
      stream_row_id: integrationStreams.id,
      connection_id: integrationStreams.connection_id,
      plugin_id: integrationStreams.plugin_id,
      stream_id: integrationStreams.stream_id,
      project_id: integrationConnections.project_id,
    })
    .from(integrationStreams)
    .innerJoin(
      integrationConnections,
      eq(integrationConnections.id, integrationStreams.connection_id)
    )
    .where(
      and(
        eq(integrationStreams.enabled, true),
        ne(integrationStreams.frequency, 'manual'),
        ne(integrationStreams.frequency, 'webhook'),
        lte(integrationStreams.next_sync_at, now),
        or(
          isNull(integrationStreams.last_sync_status),
          ne(integrationStreams.last_sync_status, 'in_progress')
        )
      )
    )

  return rows.map((r) => ({
    streamRowId: r.stream_row_id,
    connectionId: r.connection_id,
    pluginId: r.plugin_id,
    streamId: r.stream_id,
    projectId: r.project_id,
  }))
}
