/**
 * Linear plugin — connect-only.
 *
 * Auth: OAuth 2.0 (read, write, issues:create, comments:create).
 * Sync logic lives in `src/lib/automations/skills/linear-issues/`.
 */

import { LinearClient } from '@linear/sdk'
import { NextResponse, type NextRequest } from 'next/server'
import { definePlugin, type PluginRouteCtx } from '../plugin-kit'

export const linearPlugin = definePlugin({
  id: 'linear',
  name: 'Linear',
  description: 'Pull issues from Linear teams into Hissuno.',
  category: 'issues',
  icon: { src: '/logos/linear.svg' },
  multiInstance: true,

  auth: {
    type: 'oauth2',
    scopes: ['read', 'write', 'issues:create', 'comments:create'],
    authorizeUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    clientIdEnv: 'LINEAR_CLIENT_ID',
    clientSecretEnv: 'LINEAR_CLIENT_SECRET',
    extraAuthParams: { prompt: 'consent' },
    onTokenExchanged: async (tokens) => {
      const client = new LinearClient({ accessToken: tokens.accessToken })
      const viewer = await client.viewer
      const org = await viewer.organization
      return {
        externalAccountId: org.id,
        accountLabel: org.name,
        credentials: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt?.toISOString(),
        },
        settings: {
          organizationId: org.id,
          organizationName: org.name,
          viewerEmail: viewer.email,
        },
      }
    },
  },

  customHandlers: {
    teams: async (_req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) {
        return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      }
      const client = new LinearClient({ accessToken: String(ctx.credentials.accessToken) })
      const teams = await client.teams()
      return NextResponse.json({
        teams: teams.nodes.map((t) => ({ id: t.id, name: t.name, key: t.key })),
      })
    },
  },
})
