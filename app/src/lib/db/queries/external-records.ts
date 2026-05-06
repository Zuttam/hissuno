/**
 * External Records Queries (Drizzle)
 *
 * Plugin-agnostic external→hissuno mapping. Used by skill scripts to:
 *   - Look up "have I synced this external_id before?" before fetching/inserting
 *   - Persist the mapping after creating a hissuno-side resource
 */

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { externalRecords } from '@/lib/db/schema/app'

export type ExternalResourceType =
  | 'session'
  | 'contact'
  | 'company'
  | 'issue'
  | 'knowledge'

export type ExternalRecordRow = typeof externalRecords.$inferSelect

export interface ExternalRecordKey {
  projectId: string
  source: string
  externalId: string
  resourceType: ExternalResourceType
}

export async function findExternalRecord(
  key: ExternalRecordKey,
): Promise<ExternalRecordRow | null> {
  const row = await db.query.externalRecords.findFirst({
    where: and(
      eq(externalRecords.project_id, key.projectId),
      eq(externalRecords.source, key.source),
      eq(externalRecords.external_id, key.externalId),
      eq(externalRecords.resource_type, key.resourceType),
    ),
  })
  return row ?? null
}

export async function findExternalRecords(
  projectId: string,
  source: string,
  resourceType: ExternalResourceType,
  externalIds: string[],
): Promise<ExternalRecordRow[]> {
  if (externalIds.length === 0) return []
  return db
    .select()
    .from(externalRecords)
    .where(
      and(
        eq(externalRecords.project_id, projectId),
        eq(externalRecords.source, source),
        eq(externalRecords.resource_type, resourceType),
        inArray(externalRecords.external_id, externalIds),
      ),
    )
}

export interface UpsertExternalRecordInput extends ExternalRecordKey {
  resourceId: string
}

export async function upsertExternalRecord(
  input: UpsertExternalRecordInput,
): Promise<ExternalRecordRow> {
  const [row] = await db
    .insert(externalRecords)
    .values({
      project_id: input.projectId,
      source: input.source,
      external_id: input.externalId,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
    })
    .onConflictDoUpdate({
      target: [
        externalRecords.project_id,
        externalRecords.source,
        externalRecords.external_id,
        externalRecords.resource_type,
      ],
      set: {
        resource_id: input.resourceId,
        last_synced_at: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('Failed to upsert external_records')
  return row
}

export async function deleteExternalRecord(key: ExternalRecordKey): Promise<void> {
  await db
    .delete(externalRecords)
    .where(
      and(
        eq(externalRecords.project_id, key.projectId),
        eq(externalRecords.source, key.source),
        eq(externalRecords.external_id, key.externalId),
        eq(externalRecords.resource_type, key.resourceType),
      ),
    )
}
