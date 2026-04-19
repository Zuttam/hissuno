/**
 * Catch-all for plugin-specific custom endpoints, scoped to a connection.
 *
 * Covers things like:
 *   /api/integrations/github/{cid}/repos
 *   /api/integrations/notion/{cid}/pages
 *   /api/integrations/slack/{cid}/channels/join
 *   /api/integrations/jira/{cid}/projects
 *
 * Dispatches to plugin.customHandlers[<first-segment-of-handler>] where
 * available. The handler receives the full request + a PluginRouteCtx with the
 * resolved connection context.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { resolvePluginConnectionRoute } from '@/lib/integrations/shared/route-helpers'
import type { PluginRouteCtx } from '@/lib/integrations/plugin-kit'

export const runtime = 'nodejs'

async function dispatch(
  request: NextRequest,
  context: {
    params: Promise<{ pluginId: string; connectionId: string; handler: string[] }>
  }
) {
  const params = await context.params
  const resolved = await resolvePluginConnectionRoute(request, {
    pluginId: params.pluginId,
    connectionId: params.connectionId,
  })
  if (resolved instanceof NextResponse) return resolved
  const { plugin, connection } = resolved

  const handlerName = params.handler[0]
  const handler = plugin.customHandlers?.[handlerName]
  if (!handler) {
    return NextResponse.json(
      {
        error: `No handler "${handlerName}" defined on plugin ${plugin.id}.`,
      },
      { status: 404 }
    )
  }

  const ctx: PluginRouteCtx = {
    projectId: connection.projectId,
    plugin,
    connectionId: connection.id,
    credentials: connection.credentials,
    settings: connection.settings,
    logger: {
      info: (m, d) => console.log(`[${plugin.id}.${handlerName}]`, m, d ?? ''),
      warn: (m, d) => console.warn(`[${plugin.id}.${handlerName}]`, m, d ?? ''),
      error: (m, d) => console.error(`[${plugin.id}.${handlerName}]`, m, d ?? ''),
      debug: (m, d) => {
        if (process.env.DEBUG_INTEGRATIONS) console.log(`[${plugin.id}.${handlerName}]`, '[debug]', m, d ?? '')
      },
    },
  }

  return await handler(request, ctx)
}

export const GET = dispatch
export const POST = dispatch
export const PATCH = dispatch
export const PUT = dispatch
export const DELETE = dispatch
