/**
 * POST /api/plugins/webhook/[pluginId]
 *
 * Unified webhook endpoint for plugins whose URL is static (e.g., GitHub, Jira).
 * Plugins with a connection-scoped webhook URL use
 * /api/plugins/webhook/[pluginId]/[connectionId] instead (see sibling route).
 *
 * The plugin declares `resolveConnection(payload)` so we can dispatch to the right
 * connection (and its streams' webhook handlers).
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPlugin } from '@/lib/integrations/registry'
import { getConnection } from '@/lib/integrations/shared/connections'
import type { WebhookCtx } from '@/lib/integrations/plugin-kit'
import { buildIngest } from '@/lib/integrations/shared/ingest'
import { isSynced, recordSynced } from '@/lib/integrations/shared/synced-records'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { integrationConnections, integrationStreams } from '@/lib/db/schema/app'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string }> }
) {
  const { pluginId } = await context.params

  const plugin = getPlugin(pluginId)
  if (!plugin) {
    return NextResponse.json({ error: `Unknown integration: ${pluginId}` }, { status: 404 })
  }
  if (!plugin.resolveConnection) {
    return NextResponse.json(
      {
        error: `Plugin ${pluginId} does not support webhook dispatch without a connectionId in the path.`,
      },
      { status: 404 }
    )
  }

  // Clone the payload; resolveConnection needs the parsed JSON, streams want the
  // request. We read once, then wrap a fresh Request for the stream handlers.
  const rawBody = await request.text()
  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    payload = null
  }

  // The plugin's resolveConnection is responsible for signature/auth
  // verification before a DB lookup happens — the route only trusts what it
  // returns. If the plugin returns a Response (e.g. a provider setup
  // challenge), send it as-is without touching the database.
  const resolved = await plugin.resolveConnection({ payload, rawBody, request })
  if (resolved instanceof Response) return resolved
  if (!resolved) {
    return NextResponse.json(
      { error: 'No connection matches this webhook.' },
      { status: 404 }
    )
  }
  const connectionId = resolved

  const connection = await getConnection(connectionId)
  if (!connection || connection.pluginId !== pluginId) {
    return NextResponse.json({ error: 'Connection resolution mismatch.' }, { status: 404 })
  }

  const clonedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: rawBody,
  }) as unknown as NextRequest

  // Dispatch to every webhook handler on enabled streams. In practice most
  // plugins have one webhook-bearing stream, but this is flexible.
  const [streams] = await Promise.all([
    db
      .select()
      .from(integrationStreams)
      .where(eq(integrationStreams.connection_id, connection.id)),
  ])

  const responses: Response[] = []
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
      request: clonedRequest,
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
      if (res instanceof Response) responses.push(res)
    } catch (err) {
      logger.error('webhook handler threw', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Convention: if any stream returned a Response, return the first. Otherwise 200 OK.
  return responses[0] ?? NextResponse.json({ success: true })
}
