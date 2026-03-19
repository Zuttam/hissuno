/**
 * PostHog Queries (Drizzle)
 *
 * Database operations for PostHog sync tracking.
 */

import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  posthogSyncRuns,
} from '@/lib/db/schema/app'

// ============================================================================
// Sync Run Queries
// ============================================================================

/**
 * Create a new sync run record
 */
export async function insertSyncRun(data: {
  projectId: string
  connectionId: string
}) {
  const [result] = await db
    .insert(posthogSyncRuns)
    .values({
      project_id: data.projectId,
      connection_id: data.connectionId,
      status: 'running',
    })
    .returning({ id: posthogSyncRuns.id })

  return result ?? null
}

/**
 * Update a sync run with results
 */
export async function updateSyncRun(
  runId: string,
  data: {
    status: 'completed' | 'failed'
    contactsMatched?: number
    sessionsCreated?: number
    contactsCreated?: number
    errorMessage?: string
  }
) {
  await db
    .update(posthogSyncRuns)
    .set({
      status: data.status,
      contacts_matched: data.contactsMatched,
      sessions_created: data.sessionsCreated,
      contacts_created: data.contactsCreated,
      error_message: data.errorMessage,
      completed_at: new Date(),
    })
    .where(eq(posthogSyncRuns.id, runId))
}

/**
 * Get recent sync runs for a connection
 */
export async function getRecentSyncRuns(connectionId: string, limit = 5) {
  return db
    .select({
      id: posthogSyncRuns.id,
      status: posthogSyncRuns.status,
      contacts_matched: posthogSyncRuns.contacts_matched,
      sessions_created: posthogSyncRuns.sessions_created,
      contacts_created: posthogSyncRuns.contacts_created,
      error_message: posthogSyncRuns.error_message,
      started_at: posthogSyncRuns.started_at,
      completed_at: posthogSyncRuns.completed_at,
    })
    .from(posthogSyncRuns)
    .where(eq(posthogSyncRuns.connection_id, connectionId))
    .orderBy(desc(posthogSyncRuns.started_at))
    .limit(limit)
}
