/**
 * Slack plugin — connect-only.
 *
 * Auth: custom (Slack's oauth.v2.access returns bot token + workspace info —
 *   doesn't fit the generic oauth2 flow).
 *
 * Webhooks: resolveConnection verifies the signature and maps the payload to
 * a connection id; the webhook route fires an event-triggered automation
 * (the `slack-events` skill) for the resolved project.
 */

import { NextResponse, type NextRequest } from 'next/server'
import {
  definePlugin,
  type CustomAuthCtx,
  type PluginRouteCtx,
} from '../plugin-kit'
import { verifySlackRequest } from '../slack/index'
import { findConnectionByExternalId } from '../shared/connections'

export const SLACK_OAUTH_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'channels:join',
  'channels:read',
  'chat:write',
  'groups:history',
  'groups:read',
  'reactions:write',
  'users:read',
  'users:read.email',
]

export const slackPlugin = definePlugin({
  id: 'slack',
  name: 'Slack',
  description: 'Capture Slack threads as sessions and respond as the bot.',
  category: 'interactive',
  icon: { src: '/logos/slack.svg' },
  multiInstance: true,

  auth: {
    type: 'custom',
    connect: async (req: NextRequest, ctx: CustomAuthCtx) => {
      const clientId = process.env.SLACK_CLIENT_ID
      if (!clientId) {
        return NextResponse.json({ error: 'SLACK_CLIENT_ID is not configured.' }, { status: 500 })
      }
      const body = await req.json().catch(() => ({})) as { code?: string; redirectUri?: string }
      if (!body.code || !body.redirectUri) {
        const base = new URL(req.url).origin
        const state = typeof body.redirectUri === 'string' ? body.redirectUri : `${base}/oauth/slack/return`
        const url = new URL('https://slack.com/oauth/v2/authorize')
        url.searchParams.set('client_id', clientId)
        url.searchParams.set('scope', SLACK_OAUTH_SCOPES.join(','))
        url.searchParams.set('redirect_uri', state)
        url.searchParams.set('state', ctx.projectId)
        return NextResponse.json({ authorizeUrl: url.toString() })
      }

      const clientSecret = process.env.SLACK_CLIENT_SECRET
      if (!clientSecret) {
        return NextResponse.json({ error: 'SLACK_CLIENT_SECRET is not configured.' }, { status: 500 })
      }
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: body.code,
        redirect_uri: body.redirectUri,
      })
      const res = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      const data = (await res.json()) as {
        ok: boolean
        error?: string
        access_token?: string
        bot_user_id?: string
        scope?: string
        team?: { id: string; name: string }
        authed_user?: { id: string }
        enterprise?: unknown
      }
      if (!data.ok || !data.access_token || !data.team) {
        return NextResponse.json(
          { error: data.error ?? 'Slack OAuth failed.' },
          { status: 400 }
        )
      }
      const result = await ctx.saveConnection({
        externalAccountId: data.team.id,
        accountLabel: data.team.name,
        credentials: {
          botToken: data.access_token,
          botUserId: data.bot_user_id ?? '',
          scope: data.scope ?? null,
        },
        settings: {
          workspaceId: data.team.id,
          workspaceName: data.team.name,
        },
      })
      return NextResponse.json({ connectionId: result.connectionId })
    },
  },

  resolveConnection: async ({ payload, rawBody, request }) => {
    const signingSecret = process.env.SLACK_SIGNING_SECRET
    if (!signingSecret) {
      console.warn('[slack.resolveConnection] SLACK_SIGNING_SECRET not set')
      return null
    }
    const timestamp = request.headers.get('x-slack-request-timestamp') ?? ''
    const signature = request.headers.get('x-slack-signature') ?? ''
    if (!verifySlackRequest(rawBody, timestamp, signature, signingSecret)) {
      console.warn('[slack.resolveConnection] signature mismatch')
      return null
    }

    if (!payload || typeof payload !== 'object') return null
    const body = payload as {
      type?: string
      challenge?: string
      team_id?: string
      event?: { team?: string; type?: string }
    }

    if (body.type === 'url_verification' && typeof body.challenge === 'string') {
      return NextResponse.json({ challenge: body.challenge })
    }

    const teamId = body.team_id ?? body.event?.team
    if (!teamId) return null
    const connection = await findConnectionByExternalId('slack', teamId)
    if (!connection) return null
    return connection.id
  },

  customHandlers: {
    verify_signing: async (_req: NextRequest, _ctx: PluginRouteCtx) => {
      return NextResponse.json({ signingConfigured: Boolean(process.env.SLACK_SIGNING_SECRET) })
    },
  },
})
