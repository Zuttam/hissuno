/**
 * Dedup layer over `integration_synced_records`.
 *
 * Plugins call `ctx.isSynced(externalId)` / `ctx.recordSynced(...)` during a sync
 * to avoid re-ingesting records they've already mapped to a Hissuno entity.
 *
 * One row per (connection_id, stream_id, external_id) — external_id is the
 * provider's primary key (e.g. "ticket:12345", "issue:AB-1", "page:<uuid>").
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { integrationSyncedRecords } from '@/lib/db/schema/app'
import type { StreamKind } from '../plugin-kit'

export async function isSynced(
  connectionId: string,
  streamId: string,
  externalId: string
): Promise<boolean> {
  const rows = await db
    .select({ external_id: integrationSyncedRecords.external_id })
    .from(integrationSyncedRecords)
    .where(
      and(
        eq(integrationSyncedRecords.connection_id, connectionId),
        eq(integrationSyncedRecords.stream_id, streamId),
        eq(integrationSyncedRecords.external_id, externalId)
      )
    )
    .limit(1)
  return rows.length > 0
}

export async function getSyncedIds(
  connectionId: string,
  streamId: string
): Promise<Set<string>> {
  const rows = await db
    .select({ external_id: integrationSyncedRecords.external_id })
    .from(integrationSyncedRecords)
    .where(
      and(
        eq(integrationSyncedRecords.connection_id, connectionId),
        eq(integrationSyncedRecords.stream_id, streamId)
      )
    )
  return new Set(rows.map((r) => r.external_id))
}

export async function recordSynced(params: {
  connectionId: string
  streamId: string
  externalId: string
  hissunoId: string
  kind: StreamKind
}): Promise<void> {
  await db
    .insert(integrationSyncedRecords)
    .values({
      connection_id: params.connectionId,
      stream_id: params.streamId,
      external_id: params.externalId,
      hissuno_id: params.hissunoId,
      hissuno_kind: params.kind,
      synced_at: new Date(),
    })
    .onConflictDoNothing()
}

export async function clearSyncedRecords(
  connectionId: string,
  streamId: string
): Promise<void> {
  await db
    .delete(integrationSyncedRecords)
    .where(
      and(
        eq(integrationSyncedRecords.connection_id, connectionId),
        eq(integrationSyncedRecords.stream_id, streamId)
      )
    )
}
