/**
 * GET /api/plugins/[pluginId]/connection?projectId=...&externalAccountId=...
 *
 * Returns the full connection record (credentials, settings, account label,
 * external account id) for ad-hoc use by skill scripts that need more than a
 * single access token (e.g. Slack workspace metadata, Notion integration
 * settings). Treats the credentials map as opaque — caller picks what it
 * needs.
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
      credentials: resolved.credentials,
      settings: resolved.settings,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = (err as { status?: number })?.status ?? 400
    return NextResponse.json({ error: message }, { status })
  }
}
