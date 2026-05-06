/**
 * Jira plugin — sync issues from a Jira Cloud project into Hissuno.
 *
 * Auth: OAuth 2.0 3LO with refresh.
 * Streams: issues (parameterized per project).
 * Custom handlers: projects, issueTypes.
 */

import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import {
  definePlugin,
  type SyncCtx,
  type PluginRouteCtx,
  type PluginListCtx,
} from '../plugin-kit'
import { getAccessibleResources } from '../jira/oauth'

const JIRA_API_BASE = 'https://api.atlassian.com/ex/jira'

const filterSchema = z.object({
  jql: z.string().optional(),
  issueTypeNames: z.array(z.string()).optional(),
  statusCategories: z.array(z.enum(['To Do', 'In Progress', 'Done'])).optional(),
})

const settingsSchema = z.object({
  cloudId: z.string().optional(),
  cloudUrl: z.string().optional(),
  projectKey: z.string().optional(),
  issueTypeName: z.string().optional(),
})

type JiraFilters = z.infer<typeof filterSchema>
type JiraSettings = z.infer<typeof settingsSchema>

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

  streams: {
    issues: {
      kind: 'issues',
      label: 'Issues',
      description: 'Issues from a Jira project.',
      filterSchema,
      settingsSchema,
      defaultFilters: {},
      instances: async (ctx) => listProjects(ctx),
      sync: runIssuesSync,
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

async function listProjects(ctx: PluginListCtx) {
  const creds = ctx.credentials as unknown as JiraCredentials
  const data = await jiraFetchJson<{ values?: Array<Record<string, unknown>> }>(
    creds,
    '/rest/api/3/project/search?maxResults=50'
  )
  return (data.values ?? []).map((p) => ({
    id: String(p.key),
    label: `${String(p.name)} (${String(p.key)})`,
    metadata: { name: p.name, key: p.key, id: p.id },
  }))
}

async function runIssuesSync(ctx: SyncCtx<JiraSettings, JiraFilters>) {
  const creds = ctx.credentials as unknown as JiraCredentials
  if (!creds.accessToken) throw new Error('Jira credentials missing access token.')
  if (!creds.cloudId) throw new Error('Jira credentials missing cloudId.')

  const projectKey = ctx.instanceId ?? ctx.settings.projectKey
  if (!projectKey) throw new Error('Jira sync requires a project key.')

  const jqlParts = [`project = ${projectKey}`]
  if (ctx.filters.jql) jqlParts.push(`(${ctx.filters.jql})`)
  if (ctx.filters.issueTypeNames?.length) {
    jqlParts.push(`issuetype in (${ctx.filters.issueTypeNames.map(quoteJql).join(',')})`)
  }
  if (ctx.syncMode === 'incremental' && ctx.lastSyncAt) {
    jqlParts.push(`updated >= "${toJiraDate(ctx.lastSyncAt)}"`)
  }
  const jql = jqlParts.join(' AND ') + ' ORDER BY updated DESC'

  const alreadySynced = await ctx.getSyncedIds()
  let startAt = 0
  const maxResults = 50
  let total = Infinity

  while (startAt < total && !ctx.signal.aborted) {
    const page = await jiraFetchJson<{
      issues: Array<{
        id: string
        key: string
        fields: Record<string, unknown>
      }>
      total: number
    }>(
      creds,
      `/rest/api/3/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,description,status,priority,issuetype,created,updated,reporter`
    )
    total = page.total
    for (const issue of page.issues) {
      if (ctx.signal.aborted) break
      if (alreadySynced.has(issue.id)) {
        ctx.progress({ type: 'skipped', externalId: issue.id, message: `Skipped ${issue.key}` })
        continue
      }
      try {
        const fields = issue.fields
        const summary = String(fields.summary ?? issue.key)
        const description = typeof fields.description === 'string' ? fields.description : ''
        const status = extractJiraStatus(fields.status)
        const priority = extractJiraPriority(fields.priority)
        const issueTypeName = (fields.issuetype as { name?: string })?.name ?? ''
        const { issueId } = await ctx.ingest.issue({
          externalId: issue.id,
          name: summary,
          description,
          type: mapJiraIssueType(issueTypeName),
          status,
          priority,
          customFields: {
            jira_key: issue.key,
            jira_project_key: projectKey,
            jira_cloud_id: creds.cloudId,
            jira_cloud_url: creds.cloudUrl,
            jira_issue_type: issueTypeName,
          },
        })
        ctx.progress({
          type: 'synced',
          externalId: issue.id,
          hissunoId: issueId,
          message: `Synced ${issue.key}`,
          current: startAt + 1,
          total,
        })
      } catch (err) {
        ctx.logger.error('issue ingest failed', {
          issueId: issue.id,
          error: err instanceof Error ? err.message : String(err),
        })
        ctx.progress({ type: 'failed', externalId: issue.id, message: String(err) })
      }
    }
    if (page.issues.length < maxResults) break
    startAt += maxResults
  }
}

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

function mapJiraIssueType(name: string): 'bug' | 'feature_request' | 'change_request' {
  const n = name.toLowerCase()
  if (n.includes('bug')) return 'bug'
  if (n.includes('story') || n.includes('feature')) return 'feature_request'
  return 'change_request'
}

function extractJiraStatus(raw: unknown): 'open' | 'ready' | 'in_progress' | 'resolved' | 'closed' {
  const obj = raw as { statusCategory?: { key?: string; name?: string } } | undefined
  const key = obj?.statusCategory?.key
  if (key === 'done') return 'resolved'
  if (key === 'indeterminate') return 'in_progress'
  return 'open'
}

function extractJiraPriority(raw: unknown): 'low' | 'medium' | 'high' | undefined {
  const name = (raw as { name?: string } | undefined)?.name?.toLowerCase() ?? ''
  if (name.includes('highest') || name.includes('high')) return 'high'
  if (name.includes('medium')) return 'medium'
  if (name.includes('low') || name.includes('lowest')) return 'low'
  return undefined
}

function toJiraDate(d: Date): string {
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
}

function quoteJql(v: string): string {
  return `"${v.replace(/"/g, '\\"')}"`
}
