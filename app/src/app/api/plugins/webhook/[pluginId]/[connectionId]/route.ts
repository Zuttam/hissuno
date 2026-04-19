/**
 * POST /api/plugins/webhook/[pluginId]/[connectionId]
 *
 * Connection-scoped webhook endpoint. The URL is registered with the provider
 * at connect time (Slack, Linear, per-connection GitHub repo hooks). The path
 * itself disambiguates which connection this payload targets — no
 * plugin.resolveConnection needed.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPlugin } from '@/lib/integrations/registry'
import { getConnection } from '@/lib/integrations/shared/connections'
import { buildIngest } from '@/lib/integrations/shared/ingest'
import { isSynced, recordSynced } from '@/lib/integrations/shared/synced-records'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { integrationConnections, integrationStreams } from '@/lib/db/schema/app'
import type { WebhookCtx } from '@/lib/integrations/plugin-kit'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string; connectionId: string }> }
) {
  const { pluginId, connectionId } = await context.params

  const plugin = getPlugin(pluginId)
  if (!plugin) {
    return NextResponse.json({ error: `Unknown integration: ${pluginId}` }, { status: 404 })
  }

  const connection = await getConnection(connectionId)
  if (!connection || connection.pluginId !== pluginId) {
    return NextResponse.json({ error: 'Connection not found.' }, { status: 404 })
  }

  const streams = await db
    .select()
    .from(integrationStreams)
    .where(eq(integrationStreams.connection_id, connection.id))

  for (const row of streams) {
    if (!row.enabled) continue
    const streamKey = row.stream_id.split(':')[0]
    const streamDef = plugin.streams[streamKey]
    if (!streamDef?.webhook) continue

    const logger = {
      info: (m: string, d?: Record<string, unknown>) => console.log(`[webhook:${pluginId}:${streamKey}]`, m, d ?? ''),
      warn: (m: string, d?: Record<string, unknown>) => console.warn(`[webhook:${pluginId}:${streamKey}]`, m, d ?? ''),
      error: (m: string, d?: Record<string, unknown>) => console.error(`[webhook:${pluginId}:${streamKey}]`, m, d ?? ''),
      debug: (m: string, d?: Record<string, unknown>) => {
        if (process.env.DEBUG_INTEGRATIONS) console.log(`[webhook:${pluginId}:${streamKey}]`, '[debug]', m, d ?? '')
      },
    }

    const ingest = buildIngest({
      projectId: connection.projectId,
      connectionId: connection.id,
      streamId: row.stream_id,
      logger,
    })

    const ctx: WebhookCtx = {
      projectId: connection.projectId,
      connectionId: connection.id,
      streamId: row.stream_id,
      streamKey,
      credentials: connection.credentials,
      settings: (row.settings ?? {}) as Record<string, unknown>,
      request,
      logger,
      ingest,
      isSynced: (externalId) => isSynced(connection.id, row.stream_id, externalId),
      recordSynced: (params) =>
        recordSynced({
          connectionId: connection.id,
          streamId: row.stream_id,
          ...params,
        }),
      saveCredentials: async (next) => {
        await db
          .update(integrationConnections)
          .set({ credentials: next, updated_at: new Date() })
          .where(eq(integrationConnections.id, connection.id))
      },
    }

    try {
      const res = await streamDef.webhook(ctx)
      if (res instanceof Response) return res
    } catch (err) {
      logger.error('webhook handler threw', {
        error: err instanceof Error ? err.message : String(err),
      })
      return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
