/**
 * GET  /api/plugins/[pluginId]/[connectionId]/streams      — list streams + catalog
 * POST /api/plugins/[pluginId]/[connectionId]/streams      — upsert a stream
 *   body: { streamKey, instanceId?, enabled?, frequency?, filterConfig?, settings? }
 * DELETE /api/plugins/[pluginId]/[connectionId]/streams    — remove a stream
 *   body: { streamId }
 *
 * For parameterized plugins, `streamKey` is the key under `plugin.streams[...]` and
 * `instanceId` is the selected instance (e.g., a repo name). Together they build
 * the composite `stream_id` used for persistence and dedup.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  handleRouteError,
  resolvePluginConnectionRoute,
} from '@/lib/integrations/shared/route-helpers'
import {
  deleteStream,
  listStreams,
  upsertStream,
} from '@/lib/integrations/shared/connections'
import { buildStreamId, type StreamKind, type SyncFrequency } from '@/lib/integrations/plugin-kit'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string; connectionId: string }> }
) {
  const params = await context.params
  try {
    const resolved = await resolvePluginConnectionRoute(request, params)
    if (resolved instanceof NextResponse) return resolved
    const { plugin, connection } = resolved

    const streams = await listStreams(connection.id)

    return NextResponse.json({
      catalog: Object.entries(plugin.streams).map(([streamKey, def]) => ({
        streamKey,
        kind: def.kind,
        label: def.label,
        description: def.description ?? null,
        parameterized: !!def.instances,
        frequencies: def.frequencies ?? ['manual', '1h', '6h', '24h'],
      })),
      streams: streams.map((s) => ({
        id: s.id,
        streamId: s.streamId,
        streamKind: s.streamKind,
        enabled: s.enabled,
        frequency: s.frequency,
        lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
        lastSyncStatus: s.lastSyncStatus,
        lastSyncError: s.lastSyncError,
        lastSyncCounts: s.lastSyncCounts,
        nextSyncAt: s.nextSyncAt?.toISOString() ?? null,
        filterConfig: s.filterConfig,
        settings: s.settings,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to list streams.')
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string; connectionId: string }> }
) {
  const params = await context.params
  try {
    const resolved = await resolvePluginConnectionRoute(request, params)
    if (resolved instanceof NextResponse) return resolved
    const { plugin, connection } = resolved

    const body = (await request.json().catch(() => ({}))) as {
      streamKey?: string
      instanceId?: string | null
      enabled?: boolean
      frequency?: SyncFrequency
      filterConfig?: Record<string, unknown>
      settings?: Record<string, unknown>
    }

    if (!body.streamKey) {
      return NextResponse.json({ error: 'streamKey is required.' }, { status: 400 })
    }
    const streamDef = plugin.streams[body.streamKey]
    if (!streamDef) {
      return NextResponse.json(
        { error: `Unknown stream "${body.streamKey}" on plugin ${plugin.id}.` },
        { status: 400 }
      )
    }

    const streamId = buildStreamId(body.streamKey, body.instanceId ?? null)

    const row = await upsertStream({
      connectionId: connection.id,
      pluginId: plugin.id,
      streamId,
      streamKind: streamDef.kind as StreamKind,
      enabled: body.enabled,
      frequency: body.frequency,
      filterConfig: body.filterConfig,
      settings: body.settings,
    })

    return NextResponse.json({
      id: row.id,
      streamId: row.streamId,
      streamKind: row.streamKind,
      enabled: row.enabled,
      frequency: row.frequency,
      filterConfig: row.filterConfig,
      settings: row.settings,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to upsert stream.')
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string; connectionId: string }> }
) {
  const params = await context.params
  try {
    const resolved = await resolvePluginConnectionRoute(request, params)
    if (resolved instanceof NextResponse) return resolved
    const { connection } = resolved

    const body = (await request.json().catch(() => ({}))) as { streamId?: string }
    if (!body.streamId) {
      return NextResponse.json({ error: 'streamId is required.' }, { status: 400 })
    }

    await deleteStream(connection.id, body.streamId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to delete stream.')
  }
}
