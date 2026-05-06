/**
 * Sync runner: orchestrates a single stream sync.
 *
 * Responsibilities:
 *   - Build a bound SyncCtx (credentials, ingestion, dedup, progress).
 *   - Record an integration_sync_runs row (in_progress -> success/error).
 *   - Update integration_streams.{last_sync_at,last_sync_status,next_sync_at,last_sync_error}.
 *   - Refresh OAuth tokens on the fly when the plugin's auth schema supports it.
 *   - Adapt progress events to an emit callback (SSE from manual triggers,
 *     console logs from cron).
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import {
  integrationConnections,
  integrationStreams,
  integrationSyncRuns,
} from '@/lib/db/schema/app'
import type {
  PluginDef,
  StreamDef,
  SyncCtx,
  SyncMode,
  TriggerSource,
  ProgressEvent,
  Settings,
  FilterConfig,
  Credentials,
  Logger,
  SyncFrequency,
} from '../plugin-kit'
import { parseStreamId } from '../plugin-kit'
import { calculateNextSyncTime } from './sync-utils'
import { buildIngest } from './ingest'
import { isSynced, getSyncedIds, recordSynced } from './synced-records'
import { refreshAccessToken } from './oauth'

export interface SyncRunnerOptions {
  plugin: PluginDef
  connectionId: string
  streamRowId: string
  triggeredBy: TriggerSource
  syncMode: SyncMode
  signal?: AbortSignal
  onProgress?: (event: ProgressEvent) => void
}

export interface SyncResult {
  success: boolean
  runId: string | null
  counts: Record<string, number>
  error?: string
}

export async function runStreamSync(opts: SyncRunnerOptions): Promise<SyncResult> {
  const { plugin, connectionId, streamRowId, triggeredBy, syncMode, onProgress } = opts
  const signal = opts.signal ?? new AbortController().signal

  // Load connection + stream row together.
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1)

  if (!connection) {
    return { success: false, runId: null, counts: {}, error: 'Connection not found' }
  }
  if (connection.plugin_id !== plugin.id) {
    return { success: false, runId: null, counts: {}, error: 'Connection/plugin mismatch' }
  }

  const [stream] = await db
    .select()
    .from(integrationStreams)
    .where(
      and(
        eq(integrationStreams.id, streamRowId),
        eq(integrationStreams.connection_id, connectionId)
      )
    )
    .limit(1)

  if (!stream) {
    return { success: false, runId: null, counts: {}, error: 'Stream not found' }
  }

  const { streamKey, instanceId } = parseStreamId(stream.stream_id)
  const streamDef = plugin.streams[streamKey]
  if (!streamDef) {
    return { success: false, runId: null, counts: {}, error: `Unknown stream: ${streamKey}` }
  }
  if (!streamDef.sync) {
    return {
      success: false,
      runId: null,
      counts: {},
      error: `Stream "${streamKey}" has no sync handler`,
    }
  }

  const logger = makeLogger(`[${plugin.id}:${streamKey}]`)
  const counts: Record<string, number> = { found: 0, synced: 0, skipped: 0, failed: 0 }

  // Create sync run row.
  const [run] = await db
    .insert(integrationSyncRuns)
    .values({
      connection_id: connectionId,
      plugin_id: plugin.id,
      stream_id: stream.stream_id,
      triggered_by: triggeredBy,
      status: 'in_progress',
    })
    .returning({ id: integrationSyncRuns.id })

  const runId = run.id

  // Mark stream as in_progress.
  await db
    .update(integrationStreams)
    .set({ last_sync_status: 'in_progress', updated_at: new Date() })
    .where(eq(integrationStreams.id, streamRowId))

  // Build SyncCtx.
  let credentials = (connection.credentials ?? {}) as Credentials

  // Auto-refresh OAuth2 tokens on the fly if the access token is near expiry.
  credentials = await maybeRefreshOAuth({
    plugin,
    credentials,
    connectionId,
    logger,
  })

  const ingest = buildIngest({
    projectId: connection.project_id,
    connectionId,
    streamId: stream.stream_id,
    logger,
  })

  const saveCredentials = async (next: Credentials) => {
    await db
      .update(integrationConnections)
      .set({ credentials: next, updated_at: new Date() })
      .where(eq(integrationConnections.id, connectionId))
    credentials = next
  }

  const bumpCount = (key: keyof typeof counts) => {
    counts[key] = (counts[key] ?? 0) + 1
  }

  const progress = (event: ProgressEvent) => {
    if (event.type === 'synced') bumpCount('synced')
    else if (event.type === 'skipped') bumpCount('skipped')
    else if (event.type === 'failed') bumpCount('failed')
    else if (event.type === 'found') bumpCount('found')
    try {
      onProgress?.(event)
    } catch (err) {
      logger.warn('onProgress threw', { error: err instanceof Error ? err.message : String(err) })
    }
  }

  const ctx: SyncCtx = {
    projectId: connection.project_id,
    connectionId,
    streamId: stream.stream_id,
    streamKey,
    instanceId,
    credentials,
    settings: (stream.settings ?? {}) as Settings,
    filters: (stream.filter_config ?? {}) as FilterConfig,
    syncMode,
    triggeredBy,
    signal,
    logger,
    lastSyncAt: stream.last_sync_at,
    ingest,
    isSynced: (externalId) => isSynced(connectionId, stream.stream_id, externalId),
    getSyncedIds: () => getSyncedIds(connectionId, stream.stream_id),
    recordSynced: (params) =>
      recordSynced({
        connectionId,
        streamId: stream.stream_id,
        ...params,
      }),
    progress,
    saveCredentials,
  }

  try {
    await (streamDef as StreamDef).sync!(ctx)

    // Success — compute next_sync_at per the stream's frequency.
    const nextSyncAt = calculateNextSyncTime(stream.frequency as SyncFrequency)

    await Promise.all([
      db
        .update(integrationSyncRuns)
        .set({
          status: 'success',
          counts,
          completed_at: new Date(),
        })
        .where(eq(integrationSyncRuns.id, runId)),
      db
        .update(integrationStreams)
        .set({
          last_sync_at: new Date(),
          last_sync_status: 'success',
          last_sync_error: null,
          last_sync_counts: counts,
          next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
          updated_at: new Date(),
        })
        .where(eq(integrationStreams.id, streamRowId)),
    ])

    return { success: true, runId, counts }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('sync failed', { error: message })

    const nextSyncAt = calculateNextSyncTime(stream.frequency as SyncFrequency)

    await Promise.all([
      db
        .update(integrationSyncRuns)
        .set({
          status: 'error',
          counts,
          error_message: message,
          completed_at: new Date(),
        })
        .where(eq(integrationSyncRuns.id, runId)),
      db
        .update(integrationStreams)
        .set({
          last_sync_at: new Date(),
          last_sync_status: 'error',
          last_sync_error: message,
          last_sync_counts: counts,
          next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,
          updated_at: new Date(),
        })
        .where(eq(integrationStreams.id, streamRowId)),
    ])

    return { success: false, runId, counts, error: message }
  }
}

/**
 * If credentials include an expiresAt in the past (or within 60s), refresh them.
 * Only runs for oauth2 plugins.
 */
async function maybeRefreshOAuth(params: {
  plugin: PluginDef
  credentials: Credentials
  connectionId: string
  logger: Logger
}): Promise<Credentials> {
  const { plugin, credentials, connectionId, logger } = params
  if (plugin.auth.type !== 'oauth2') return credentials

  const expiresAt = credentials.expiresAt
  const refreshToken = credentials.refreshToken

  if (!refreshToken || typeof refreshToken !== 'string') return credentials
  if (!expiresAt) return credentials

  const expiresAtMs = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : NaN
  if (isNaN(expiresAtMs) || expiresAtMs - Date.now() > 60 * 1000) return credentials

  logger.info('refreshing OAuth access token')

  try {
    let next: Credentials
    if (plugin.auth.refresh) {
      // Plugin-provided refresh returns the full next Credentials object.
      next = await plugin.auth.refresh(credentials, {
        projectId: '', // not used in refresh
        plugin,
        fetch,
        logger,
      })
    } else {
      // Generic path: exchange refresh_token, merge tokens into credentials.
      const tokens = await refreshAccessToken({
        auth: plugin.auth,
        refreshToken,
        logger,
      })
      next = {
        ...credentials,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? refreshToken,
        expiresAt: tokens.expiresAt?.toISOString() ?? credentials.expiresAt,
      }
    }

    await db
      .update(integrationConnections)
      .set({ credentials: next, updated_at: new Date() })
      .where(eq(integrationConnections.id, connectionId))
    return next
  } catch (err) {
    logger.warn('OAuth refresh failed — continuing with existing credentials', {
      error: err instanceof Error ? err.message : String(err),
    })
    return credentials
  }
}

function makeLogger(prefix: string): Logger {
  return {
    info: (message, data) => console.log(`${prefix} ${message}`, data ?? ''),
    warn: (message, data) => console.warn(`${prefix} ${message}`, data ?? ''),
    error: (message, data) => console.error(`${prefix} ${message}`, data ?? ''),
    debug: (message, data) => {
      if (process.env.DEBUG_INTEGRATIONS) console.log(`${prefix} [debug] ${message}`, data ?? '')
    },
  }
}
