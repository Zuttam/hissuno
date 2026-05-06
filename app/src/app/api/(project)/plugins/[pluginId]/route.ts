/**
 * GET /api/plugins/[pluginId]?projectId=xxx
 * List all connections for this plugin in the given project.
 * Multi-instance: a project may have many connections per plugin.
 *
 * Streams are gone — sync is owned by automation skills now. The integrations
 * UI fetches the per-plugin skill list separately via /api/automations.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  handleRouteError,
  resolvePluginRouteFromQuery,
} from '@/lib/integrations/shared/route-helpers'
import { listConnections } from '@/lib/integrations/shared/connections'

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

    return NextResponse.json({
      plugin: {
        id: plugin.id,
        name: plugin.name,
        multiInstance: plugin.multiInstance ?? true,
      },
      connections: connections.map((c) => ({
        id: c.id,
        pluginId: c.pluginId,
        accountLabel: c.accountLabel,
        externalAccountId: c.externalAccountId,
        createdAt: c.createdAt?.toISOString() ?? null,
        updatedAt: c.updatedAt?.toISOString() ?? null,
        settings: c.settings,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to list connections.')
  }
}
