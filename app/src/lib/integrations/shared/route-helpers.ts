/**
 * Shared helpers for integration route handlers.
 *
 * Routes are thin: they parse params, authorize, look up the plugin, and delegate.
 * This module centralizes the boilerplate (auth, lookup, error mapping).
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getPlugin } from '../registry'
import { getConnection } from './connections'
import type { PluginDef } from '../plugin-kit'
import type { ConnectionRow } from './connections'

// ============================================================================
// Error mapping
// ============================================================================

export function handleRouteError(
  error: unknown,
  defaultMessage: string
): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  console.error('[integrations]', defaultMessage, error)
  return NextResponse.json(
    { error: error instanceof Error ? error.message : defaultMessage },
    { status: 500 }
  )
}

export function requireDb(): NextResponse | null {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }
  return null
}

// ============================================================================
// Resolvers
// ============================================================================

export interface ResolvedPluginRoute {
  plugin: PluginDef
  projectId: string
}

/**
 * Resolve the plugin + assert the caller has access to the project query-param.
 * Returns either a {plugin, projectId} or a NextResponse to short-circuit.
 */
export async function resolvePluginRouteFromQuery(
  request: NextRequest,
  pluginId: string
): Promise<ResolvedPluginRoute | NextResponse> {
  const dbError = requireDb()
  if (dbError) return dbError

  const plugin = getPlugin(pluginId)
  if (!plugin) {
    return NextResponse.json({ error: `Unknown integration: ${pluginId}` }, { status: 404 })
  }

  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
  }

  const identity = await requireRequestIdentity()
  await assertProjectAccess(identity, projectId)

  return { plugin, projectId }
}

export interface ResolvedPluginConnectionRoute extends ResolvedPluginRoute {
  connection: ConnectionRow
}

/**
 * Resolve plugin + connection from URL params (no query string required).
 * Validates that the connection belongs to the plugin AND the project (via query).
 */
export async function resolvePluginConnectionRoute(
  _request: NextRequest,
  params: { pluginId: string; connectionId: string }
): Promise<ResolvedPluginConnectionRoute | NextResponse> {
  const dbError = requireDb()
  if (dbError) return dbError

  const plugin = getPlugin(params.pluginId)
  if (!plugin) {
    return NextResponse.json(
      { error: `Unknown integration: ${params.pluginId}` },
      { status: 404 }
    )
  }

  const connection = await getConnection(params.connectionId)
  if (!connection || connection.pluginId !== params.pluginId) {
    return NextResponse.json({ error: 'Connection not found.' }, { status: 404 })
  }

  const identity = await requireRequestIdentity()
  await assertProjectAccess(identity, connection.projectId)

  return { plugin, projectId: connection.projectId, connection }
}
