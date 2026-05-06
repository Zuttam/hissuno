/**
 * GET    /api/plugins/[pluginId]/[connectionId]     — fetch one connection + streams
 * PATCH  /api/plugins/[pluginId]/[connectionId]     — update account label / settings
 * DELETE /api/plugins/[pluginId]/[connectionId]     — disconnect (cascade)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  handleRouteError,
  resolvePluginConnectionRoute,
} from '@/lib/integrations/shared/route-helpers'
import {
  deleteConnection,
  listStreams,
  updateConnection,
} from '@/lib/integrations/shared/connections'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string; connectionId: string }> }
) {
  const params = await context.params
  try {
    const resolved = await resolvePluginConnectionRoute(request, params)
    if (resolved instanceof NextResponse) return resolved
    const { connection } = resolved

    const streams = await listStreams(connection.id)

    return NextResponse.json({
      id: connection.id,
      pluginId: connection.pluginId,
      accountLabel: connection.accountLabel,
      externalAccountId: connection.externalAccountId,
      settings: connection.settings,
      createdAt: connection.createdAt?.toISOString() ?? null,
      updatedAt: connection.updatedAt?.toISOString() ?? null,
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
    return handleRouteError(error, 'Failed to fetch connection.')
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string; connectionId: string }> }
) {
  const params = await context.params
  try {
    const resolved = await resolvePluginConnectionRoute(request, params)
    if (resolved instanceof NextResponse) return resolved
    const { connection } = resolved

    const body = (await request.json().catch(() => ({}))) as {
      accountLabel?: string
      settings?: Record<string, unknown>
    }

    await updateConnection(connection.id, {
      accountLabel: body.accountLabel,
      settings: body.settings,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to update connection.')
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

    await deleteConnection(connection.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to disconnect integration.')
  }
}
