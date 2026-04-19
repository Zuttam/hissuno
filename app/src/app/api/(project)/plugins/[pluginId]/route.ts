/**
 * GET /api/plugins/[pluginId]?projectId=xxx
 * List all connections for this plugin in the given project.
 * Multi-instance: a project may have many connections per plugin.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  handleRouteError,
  resolvePluginRouteFromQuery,
} from '@/lib/integrations/shared/route-helpers'
import { listConnections, listStreams } from '@/lib/integrations/shared/connections'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string }> }
) {
  const { pluginId } = await context.params
  try {
    const resolved = await resolvePluginRouteFromQuery(request, pluginId)
    if (resolved instanceof NextResponse) return resolved

    const { plugin, projectId } = resolved

    const connections = await listConnections({ projectId, pluginId })

    // Attach streams per connection so the UI can render stream state without an N+1.
    const withStreams = await Promise.all(
      connections.map(async (c) => {
        const streams = await listStreams(c.id)
        return {
          id: c.id,
          pluginId: c.pluginId,
          accountLabel: c.accountLabel,
          externalAccountId: c.externalAccountId,
          createdAt: c.createdAt?.toISOString() ?? null,
          updatedAt: c.updatedAt?.toISOString() ?? null,
          settings: c.settings,
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
        }
      })
    )

    return NextResponse.json({
      plugin: {
        id: plugin.id,
        name: plugin.name,
        multiInstance: plugin.multiInstance ?? true,
      },
      connections: withStreams,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to list connections.')
  }
}
