/**
 * Jira plugin — connect-only.
 *
 * Auth: OAuth 2.0 3LO with refresh.
 * Sync logic lives in `src/lib/automations/skills/jira-issues/`.
 * Custom handlers: projects, issueTypes (used by the connect dialog).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { definePlugin, type PluginRouteCtx } from '../plugin-kit'
import { getAccessibleResources } from '../jira/oauth'

const JIRA_API_BASE = 'https://api.atlassian.com/ex/jira'

interface JiraCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  cloudId?: string
  cloudUrl?: string
  siteName?: string
}

export const jiraPlugin = definePlugin({
  id: 'jira',
  name: 'Jira',
  description: 'Pull issues from Jira Cloud projects into Hissuno.',
  category: 'issues',
  icon: { src: '/logos/jira.svg' },
  multiInstance: true,

  auth: {
    type: 'oauth2',
    scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user', 'offline_access'],
    authorizeUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientIdEnv: 'JIRA_CLIENT_ID',
    clientSecretEnv: 'JIRA_CLIENT_SECRET',
    extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
    onTokenExchanged: async (tokens) => {
      const resources = await getAccessibleResources(tokens.accessToken)
      const primary = resources[0]
      if (!primary) throw new Error('No accessible Jira sites found for this account.')
      return {
        externalAccountId: primary.id,
        accountLabel: primary.name,
        credentials: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt?.toISOString(),
          cloudId: primary.id,
          cloudUrl: primary.url,
          siteName: primary.name,
        } satisfies JiraCredentials,
        settings: {
          cloudId: primary.id,
          cloudUrl: primary.url,
        },
      }
    },
  },

  customHandlers: {
    projects: async (_req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      const creds = ctx.credentials as unknown as JiraCredentials
      const projects = await jiraFetchJson<{ values?: Array<Record<string, unknown>> }>(
        creds,
        '/rest/api/3/project/search?maxResults=50'
      )
      return NextResponse.json({
        projects: (projects.values ?? []).map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          projectTypeKey: p.projectTypeKey,
        })),
      })
    },
    issueTypes: async (req: NextRequest, ctx: PluginRouteCtx) => {
      if (!ctx.credentials) return NextResponse.json({ error: 'Connection required.' }, { status: 404 })
      const url = new URL(req.url)
      const projectKey = url.searchParams.get('projectKey')
      if (!projectKey) return NextResponse.json({ error: 'projectKey required.' }, { status: 400 })
      const creds = ctx.credentials as unknown as JiraCredentials
      const types = await jiraFetchJson<{ issueTypes?: Array<Record<string, unknown>>; values?: Array<Record<string, unknown>> }>(
        creds,
        `/rest/api/3/issue/createmeta/${projectKey}/issuetypes`
      )
      return NextResponse.json({
        issueTypes: (types.issueTypes ?? types.values ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description ?? '',
          subtask: Boolean(t.subtask),
          iconUrl: t.iconUrl ?? '',
        })),
      })
    },
  },
})

async function jiraFetchJson<T>(creds: JiraCredentials, path: string, init: RequestInit = {}): Promise<T> {
  const url = `${JIRA_API_BASE}/${creds.cloudId}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Jira API error (${res.status}): ${text.slice(0, 200)}`)
  }
  return (await res.json()) as T
}
