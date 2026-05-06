/**
 * GET /api/plugins/[pluginId]/token?projectId=...&externalAccountId=...
 *
 * Returns the active access token for the project's connection to this
 * plugin. OAuth tokens are auto-refreshed if they are within 60s of expiry;
 * the refreshed token is persisted back to integration_connections.
 *
 * Skill scripts call this via `hissuno plugin token <pluginId>` — but the
 * sandbox harness already injects `<PLUGIN>_ACCESS_TOKEN` for required
 * plugins, so this route is mainly for ad-hoc / multi-connection use.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireProjectId } from '@/lib/auth/project-context'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess } from '@/lib/auth/authorization'
import { isDatabaseConfigured } from '@/lib/db/config'
import { resolveConnectionToken } from '@/lib/integrations/credential-resolver'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string }> },
) {
  const { pluginId } = await context.params

  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
    }

    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const externalAccountId = request.nextUrl.searchParams.get('externalAccountId') ?? undefined
    const connectionId = request.nextUrl.searchParams.get('connectionId') ?? undefined

    const resolved = await resolveConnectionToken(projectId, pluginId, {
      externalAccountId,
      connectionId,
    })

    return NextResponse.json({
      pluginId: resolved.pluginId,
      connectionId: resolved.connectionId,
      externalAccountId: resolved.externalAccountId,
      accountLabel: resolved.accountLabel,
      accessToken: resolved.accessToken,
    })
  } catch (err) {
    return errorResponse(err)
  }
}

function errorResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err)
  const status = (err as { status?: number })?.status ?? 400
  return NextResponse.json({ error: message }, { status })
}
