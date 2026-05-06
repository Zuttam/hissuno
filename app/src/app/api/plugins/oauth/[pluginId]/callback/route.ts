/**
 * GET /api/plugins/oauth/[pluginId]/callback?code=xxx&state=yyy
 *
 * Unified OAuth2 callback for all oauth2 plugins.
 *   - Verifies the signed state (HMAC over { projectId, userId, pluginId, ... }).
 *   - Exchanges the authorization code for tokens via the plugin's tokenUrl.
 *   - Calls plugin.auth.onTokenExchanged to extract external account id + label.
 *   - Creates (or updates) the integration_connections row.
 *   - Redirects back to the integrations page with success/error flags.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getPlugin } from '@/lib/integrations/registry'
import {
  exchangeAuthorizationCode,
  verifyState,
} from '@/lib/integrations/shared/oauth'
import {
  createConnection,
  updateConnection,
} from '@/lib/integrations/shared/connections'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string }> }
) {
  const { pluginId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const plugin = getPlugin(pluginId)
  if (!plugin || plugin.auth.type !== 'oauth2') {
    return NextResponse.json({ error: 'Unknown or non-OAuth integration.' }, { status: 404 })
  }

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  // Pre-validate the state to recover the projectId even when the provider
  // returned an error (so we can redirect back to the right integrations page).
  let statePayload: ReturnType<typeof verifyState> | null = null
  if (state) {
    try {
      statePayload = verifyState(state)
    } catch (err) {
      console.error(`[oauth.${pluginId}.callback] invalid state`, err)
      return redirectBack({ request, projectId: null, error: 'invalid_state' })
    }
  }

  if (statePayload && statePayload.pluginId !== pluginId) {
    return redirectBack({ request, projectId: statePayload.projectId, error: 'plugin_mismatch' })
  }

  if (error) {
    return redirectBack({
      request,
      projectId: statePayload?.projectId ?? null,
      error,
    })
  }

  if (!code || !statePayload) {
    return redirectBack({
      request,
      projectId: statePayload?.projectId ?? null,
      error: 'missing_code',
    })
  }

  try {
    const redirectUri = resolveOAuthRedirect(request, plugin.id)
    const tokens = await exchangeAuthorizationCode({
      auth: plugin.auth,
      code,
      redirectUri,
      logger: makeLogger(plugin.id),
    })

    const testResult = await plugin.auth.onTokenExchanged(tokens, {
      projectId: statePayload.projectId,
      plugin,
      fetch,
      logger: makeLogger(plugin.id),
    })

    if (statePayload.connectionId) {
      // Reconnect flow — update the existing connection.
      await updateConnection(statePayload.connectionId, {
        credentials: testResult.credentials,
        settings: testResult.settings,
        accountLabel: testResult.accountLabel,
      })
      return redirectBack({
        request,
        projectId: statePayload.projectId,
        connectionId: statePayload.connectionId,
        pluginId: plugin.id,
        ok: true,
      })
    }

    const row = await createConnection({
      projectId: statePayload.projectId,
      pluginId: plugin.id,
      externalAccountId: testResult.externalAccountId,
      accountLabel: testResult.accountLabel,
      credentials: testResult.credentials,
      settings: testResult.settings,
    })

    return redirectBack({
      request,
      projectId: statePayload.projectId,
      connectionId: row.id,
      pluginId: plugin.id,
      ok: true,
    })
  } catch (err) {
    console.error(`[oauth.${pluginId}.callback] exchange failed`, err)
    return redirectBack({
      request,
      projectId: statePayload.projectId,
      pluginId: plugin.id,
      error: err instanceof Error ? err.message : 'exchange_failed',
    })
  }
}

function redirectBack(params: {
  request: NextRequest
  projectId: string | null
  connectionId?: string
  pluginId?: string
  ok?: boolean
  error?: string
}): NextResponse {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    `${params.request.nextUrl.protocol}//${params.request.nextUrl.host}`
  const path = params.projectId
    ? `/projects/${params.projectId}/integrations`
    : '/integrations'
  const url = new URL(path, base)
  if (params.pluginId) url.searchParams.set('plugin', params.pluginId)
  if (params.connectionId) url.searchParams.set('connection', params.connectionId)
  if (params.ok) url.searchParams.set('connected', '1')
  if (params.error) url.searchParams.set('error', params.error)
  return NextResponse.redirect(url)
}

function resolveOAuthRedirect(request: NextRequest, pluginId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  return `${base.replace(/\/$/, '')}/api/plugins/oauth/${pluginId}/callback`
}

function makeLogger(pluginId: string) {
  const prefix = `[oauth.${pluginId}.callback]`
  return {
    info: (m: string, d?: Record<string, unknown>) => console.log(prefix, m, d ?? ''),
    warn: (m: string, d?: Record<string, unknown>) => console.warn(prefix, m, d ?? ''),
    error: (m: string, d?: Record<string, unknown>) => console.error(prefix, m, d ?? ''),
    debug: (m: string, d?: Record<string, unknown>) => {
      if (process.env.DEBUG_INTEGRATIONS) console.log(prefix, '[debug]', m, d ?? '')
    },
  }
}
