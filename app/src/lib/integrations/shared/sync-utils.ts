/**
 * Shared sync utilities used across integrations.
 * Eliminates duplication of calculateNextSyncTime, getConnectionsDueForSync, and updateSyncState.
 */

import { db } from '@/lib/db'
import { eq, and, or, ne, lte, isNull } from 'drizzle-orm'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'

/**
 * Standard sync frequency type shared across all integrations.
 */
export type SyncFrequency = 'manual' | '1h' | '6h' | '24h'

/**
 * Calculate next sync time based on frequency.
 * Returns ISO string or null for manual.
 */
export function calculateNextSyncTime(frequency: SyncFrequency): string | null {
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

/**
 * Column references needed for getConnectionsDueForSync.
 */
interface SyncConnectionColumns {
  id: PgColumn
  project_id: PgColumn
  sync_enabled: PgColumn
  sync_frequency: PgColumn
  next_sync_at: PgColumn
  last_sync_status: PgColumn
}

/**
 * Generic getConnectionsDueForSync that works with any integration connection table.
 * Correctly handles NULL last_sync_status (never-synced connections).
 */
export async function getConnectionsDueForSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: PgTable<any>,
  columns: SyncConnectionColumns
): Promise<Array<{ id: string; projectId: string }>> {
  const now = new Date()

  const rows = await db
    .select({ id: columns.id, project_id: columns.project_id })
    .from(table)
    .where(
      and(
        eq(columns.sync_enabled, true),
        ne(columns.sync_frequency, 'manual'),
        lte(columns.next_sync_at, now),
        or(isNull(columns.last_sync_status), ne(columns.last_sync_status, 'in_progress'))
      )
    )

  return rows.map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
  }))
}
