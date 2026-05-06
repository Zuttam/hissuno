/**
 * CRUD over integration_connections.
 *
 * Used by route handlers under /api/(project)/plugins/[pluginId]/* and the
 * webhook receiver. Sync logic lives in automation skills, not here.
 */

import { db } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { integrationConnections } from '@/lib/db/schema/app'
import type { Credentials, Settings } from '../plugin-kit'

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
  await db
    .delete(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
}

// Stream/sync helpers were removed when sync moved into automation skills.
// Skills under `src/lib/automations/skills/<plugin>-<stream>/` own all sync
// logic now and read credentials via `resolveConnectionToken`.
