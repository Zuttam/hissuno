/**
 * POST /api/plugins/[pluginId]/connect
 *
 * Create a new connection for this plugin.
 * Dispatches based on plugin.auth.type:
 *   - api_key:    runs plugin.auth.test() with submitted fields, saves on success.
 *   - oauth2:     returns an authorize URL for the client to redirect to.
 *   - github_app: returns the app install URL.
 *   - custom:     delegates to plugin.auth.connect() end-to-end.
 *
 * Multi-instance behavior: always tries to create a NEW connection. If the
 * unique (project_id, plugin_id, external_account_id) already exists, the
 * underlying createConnection() performs an upsert — the reconnect path.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess } from '@/lib/auth/authorization'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getPlugin } from '@/lib/integrations/registry'
import { handleRouteError } from '@/lib/integrations/shared/route-helpers'
import { createConnection } from '@/lib/integrations/shared/connections'
import {
  buildAuthorizeUrl,
  signState,
  type OAuthStatePayload,
} from '@/lib/integrations/shared/oauth'
import type { Credentials, Settings } from '@/lib/integrations/plugin-kit'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string }> }
) {
  const { pluginId } = await context.params

  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
    }

    const plugin = getPlugin(pluginId)
    if (!plugin) {
      return NextResponse.json({ error: `Unknown integration: ${pluginId}` }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      projectId?: string
      credentials?: Credentials
      settings?: Settings
      connectionId?: string
    }

    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, body.projectId)

    // Custom auth: plugin owns the entire request/response cycle.
    if (plugin.auth.type === 'custom') {
      return await plugin.auth.connect(request, {
        projectId: body.projectId,
        plugin,
        fetch,
        logger: routeLogger(plugin.id),
        saveConnection: async (input) => {
          const row = await createConnection({
            projectId: body.projectId!,
            pluginId: plugin.id,
            externalAccountId: input.externalAccountId,
            accountLabel: input.accountLabel,
            credentials: input.credentials,
            settings: input.settings,
          })
          return { connectionId: row.id }
        },
        updateConnection: async () => {
          // Not used by connect (only by callback/reconnect paths).
        },
      })
    }

    // API key auth: validate credentials via plugin.auth.test().
    if (plugin.auth.type === 'api_key') {
      const credentials = body.credentials ?? {}
      const testResult = await plugin.auth.test(credentials, {
        projectId: body.projectId,
        plugin,
        fetch,
        logger: routeLogger(plugin.id),
      })

      const row = await createConnection({
        projectId: body.projectId,
        pluginId: plugin.id,
        externalAccountId: testResult.externalAccountId,
        accountLabel: testResult.accountLabel,
        credentials: testResult.credentials,
        settings: testResult.settings ?? body.settings,
      })

      return NextResponse.json({
        success: true,
        connectionId: row.id,
        accountLabel: row.accountLabel,
      })
    }

    // OAuth2: return the authorize URL. The browser redirects the user to the
    // provider; the provider redirects back to /api/plugins/oauth/{plugin}/callback.
    if (plugin.auth.type === 'oauth2') {
      const redirectUri = resolveOAuthRedirect(request, plugin.id)
      const state: OAuthStatePayload = {
        projectId: body.projectId,
        userId: identity.type === 'user' ? identity.userId : '',
        pluginId: plugin.id,
        connectionId: body.connectionId,
        issuedAt: Date.now(),
      }
      const authorizeUrl = buildAuthorizeUrl({
        auth: plugin.auth,
        redirectUri,
        state: signState(state),
      })
      return NextResponse.json({ authorizeUrl })
    }

    // GitHub App: return the app install URL. Client handles the redirect.
    if (plugin.auth.type === 'github_app') {
      return NextResponse.json(
        { error: 'github_app flow not implemented in this route yet; use custom auth.' },
        { status: 501 }
      )
    }

    return NextResponse.json({ error: 'Unsupported auth type.' }, { status: 500 })
  } catch (error) {
    return handleRouteError(error, `Failed to connect ${pluginId}.`)
  }
}

function routeLogger(pluginId: string) {
  const prefix = `[integrations.${pluginId}.connect]`
  return {
    info: (m: string, d?: Record<string, unknown>) => console.log(prefix, m, d ?? ''),
    warn: (m: string, d?: Record<string, unknown>) => console.warn(prefix, m, d ?? ''),
    error: (m: string, d?: Record<string, unknown>) => console.error(prefix, m, d ?? ''),
    debug: (m: string, d?: Record<string, unknown>) => {
      if (process.env.DEBUG_INTEGRATIONS) console.log(prefix, '[debug]', m, d ?? '')
    },
  }
}

function resolveOAuthRedirect(request: NextRequest, pluginId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  return `${base.replace(/\/$/, '')}/api/plugins/oauth/${pluginId}/callback`
}
