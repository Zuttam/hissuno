/**
 * GitHub plugin — connect-only.
 *
 * Auth: GitHub App installation (JWT + installation tokens). Optional PAT fallback.
 * Sync logic lives in `src/lib/automations/skills/github-feedback/` and
 * `src/lib/automations/skills/github-codebase/`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import {
  definePlugin,
  type PluginRouteCtx,
  type CustomAuthCtx,
} from '../plugin-kit'
import { generateInstallationToken } from '../github/jwt'
import { listInstallationRepos, listUserRepos } from '../github/app-client'

interface GitHubCredentials {
  authMethod: 'app' | 'pat'
  installationId?: number
  accountLogin?: string
  accessToken?: string
}

export const githubPlugin = definePlugin({
  id: 'github',
  name: 'GitHub',
  description: 'Sync GitHub issues as feedback and codebase as knowledge.',
  category: 'issues',
  icon: { src: '/logos/github.svg', invertInDark: true },
  multiInstance: true,

  auth: {
    type: 'custom',
    connect: async (req: NextRequest, ctx: CustomAuthCtx) => {
      const body = await req.json().catch(() => ({})) as {
        mode?: 'app' | 'pat'
        installationId?: number
        accountLogin?: string
        pat?: string
      }

      if (body.mode === 'pat') {
        if (!body.pat) {
          return NextResponse.json({ error: 'Personal access token required.' }, { status: 400 })
        }
        const repos = await listUserRepos(body.pat).catch(() => null)
        if (!repos) {
          return NextResponse.json({ error: 'Invalid or expired PAT.' }, { status: 400 })
        }
        const accountLogin = repos[0]?.owner?.login ?? 'github-pat'
        const result = await ctx.saveConnection({
          externalAccountId: `pat:${accountLogin}`,
          accountLabel: `${accountLogin} (PAT)`,
          credentials: {
            authMethod: 'pat',
            accessToken: body.pat,
            accountLogin,
          } satisfies GitHubCredentials,
        })
        return NextResponse.json({ connectionId: result.connectionId })
      }

      // Default path: GitHub App install flow.
      if (!body.installationId || !body.accountLogin) {
        const appSlug = process.env.GITHUB_APP_SLUG ?? process.env.GITHUB_APP_NAME
        return NextResponse.json({
          authorizeUrl: appSlug
            ? `https://github.com/apps/${appSlug}/installations/new?state=${ctx.projectId}`
            : undefined,
          error: appSlug ? undefined : 'GitHub App slug not configured.',
        })
      }
      const result = await ctx.saveConnection({
        externalAccountId: String(body.installationId),
        accountLabel: `${body.accountLogin} (App)`,
        credentials: {
          authMethod: 'app',
          installationId: body.installationId,
          accountLogin: body.accountLogin,
        } satisfies GitHubCredentials,
        settings: { accountLogin: body.accountLogin, installationId: body.installationId },
      })
      return NextResponse.json({ connectionId: result.connectionId })
    },
  },

  customHandlers: {
    repos: async (_req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      const creds = ctx.credentials as unknown as GitHubCredentials
      const token = await resolveToken(creds)
      const repos = creds.authMethod === 'pat' ? await listUserRepos(token) : await listInstallationRepos(token)
      return NextResponse.json({ repos })
    },
    branches: async (req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      const url = new URL(req.url)
      const owner = url.searchParams.get('owner')
      const repo = url.searchParams.get('repo')
      if (!owner || !repo) {
        return NextResponse.json({ error: 'owner and repo are required.' }, { status: 400 })
      }
      const token = await resolveToken(ctx.credentials as unknown as GitHubCredentials)
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return NextResponse.json({ error: text || `GitHub API error ${res.status}` }, { status: res.status })
      }
      const branches = (await res.json()) as unknown[]
      return NextResponse.json({ branches })
    },
  },
})

async function resolveToken(creds: GitHubCredentials): Promise<string> {
  if (creds.authMethod === 'pat') {
    if (!creds.accessToken) throw new Error('GitHub PAT missing.')
    return creds.accessToken
  }
  if (!creds.installationId) throw new Error('GitHub installation id missing.')
  return generateInstallationToken(creds.installationId)
}
