/**
 * GitHub plugin — sync repository issues as feedback sessions and codebase
 * content as knowledge.
 *
 * Auth: GitHub App installation (JWT + installation tokens). Optional PAT fallback.
 * Streams: feedback (issues -> sessions), codebase (repo content -> knowledge).
 */

import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import {
  definePlugin,
  type SyncCtx,
  type PluginListCtx,
  type PluginRouteCtx,
  type CustomAuthCtx,
} from '../plugin-kit'
import { and, eq } from 'drizzle-orm'
import { generateInstallationToken } from '../github/jwt'
import {
  listInstallationRepos,
  listUserRepos,
  listRepoIssues,
  getIssueComments,
  type GitHubIssue,
} from '../github/app-client'
import { db } from '@/lib/db'
import { codebases, projects } from '@/lib/db/schema/app'
import { createGitHubCodebase } from '@/lib/codebase'

const feedbackFilterSchema = z.object({
  labels: z.string().optional(),
  state: z.enum(['open', 'closed', 'all']).optional(),
})

const feedbackSettingsSchema = z.object({
  labelTagMap: z.record(z.string()).optional(),
})

const codebaseFilterSchema = z.object({
  branch: z.string().optional(),
  includeGlobs: z.array(z.string()).optional(),
  excludeGlobs: z.array(z.string()).optional(),
})

const codebaseSettingsSchema = z.object({
  branch: z.string().optional(),
})

type FeedbackFilters = z.infer<typeof feedbackFilterSchema>
type FeedbackSettings = z.infer<typeof feedbackSettingsSchema>

interface GitHubCredentials {
  authMethod: 'app' | 'pat'
  installationId?: number
  accountLogin?: string
  accessToken?: string
}

const VALID_SESSION_TAGS = new Set([
  'general_feedback', 'wins', 'losses', 'bug', 'feature_request', 'change_request',
])

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

  streams: {
    feedback: {
      kind: 'sessions',
      label: 'Issue feedback',
      description: 'Repository issues as feedback sessions.',
      filterSchema: feedbackFilterSchema,
      settingsSchema: feedbackSettingsSchema,
      instances: async (ctx) => listRepos(ctx),
      sync: runFeedbackSync,
    },
    codebase: {
      kind: 'knowledge',
      label: 'Codebase',
      description: 'Repository contents analyzed as knowledge.',
      filterSchema: codebaseFilterSchema,
      settingsSchema: codebaseSettingsSchema,
      instances: async (ctx) => listRepos(ctx),
      sync: runCodebaseSync,
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

async function listRepos(ctx: PluginListCtx) {
  const creds = ctx.credentials as unknown as GitHubCredentials
  const token = await resolveToken(creds)
  const repos = creds.authMethod === 'pat' ? await listUserRepos(token) : await listInstallationRepos(token)
  return repos.map((r) => ({
    id: r.full_name,
    label: r.full_name,
    metadata: { id: r.id, defaultBranch: r.default_branch, private: r.private, url: r.html_url },
  }))
}

async function resolveToken(creds: GitHubCredentials): Promise<string> {
  if (creds.authMethod === 'pat') {
    if (!creds.accessToken) throw new Error('GitHub PAT missing.')
    return creds.accessToken
  }
  if (!creds.installationId) throw new Error('GitHub installation id missing.')
  return generateInstallationToken(creds.installationId)
}

async function runFeedbackSync(ctx: SyncCtx<FeedbackSettings, FeedbackFilters>) {
  const repoFullName = ctx.instanceId
  if (!repoFullName) throw new Error('GitHub feedback sync requires a repo instance.')
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) throw new Error(`Invalid GitHub repo: ${repoFullName}`)

  const creds = ctx.credentials as unknown as GitHubCredentials
  const token = await resolveToken(creds)
  const labelTagMap = (ctx.settings.labelTagMap ?? {}) as Record<string, string>

  const since = ctx.syncMode === 'incremental' && ctx.lastSyncAt ? ctx.lastSyncAt.toISOString() : undefined

  const issues = await listRepoIssues(token, owner, repo, {
    labels: ctx.filters.labels,
    state: ctx.filters.state,
    since,
  })

  const alreadySynced = await ctx.getSyncedIds()

  for (let i = 0; i < issues.length; i++) {
    if (ctx.signal.aborted) break
    const issue = issues[i]
    if (alreadySynced.has(String(issue.id))) {
      ctx.progress({ type: 'skipped', externalId: String(issue.id), message: `Skipped #${issue.number}` })
      continue
    }

    try {
      const comments = issue.comments > 0 ? await getIssueComments(token, owner, repo, issue.number) : []
      const messages: Array<{ senderType: string; content: string; createdAt?: Date }> = []
      if (issue.body) {
        messages.push({ senderType: 'user', content: issue.body, createdAt: new Date(issue.created_at) })
      }
      const author = issue.user?.login
      for (const comment of comments) {
        if (!comment.body) continue
        messages.push({
          senderType: comment.user?.login === author ? 'user' : 'human_agent',
          content: comment.body,
          createdAt: new Date(comment.created_at),
        })
      }
      const tags = deriveTagsFromLabels(issue, labelTagMap)

      const { sessionId } = await ctx.ingest.session({
        externalId: String(issue.id),
        source: 'github',
        sessionType: 'chat',
        status: 'closed',
        name: `#${issue.number} ${issue.title}`,
        userMetadata: {
          github_issue_id: String(issue.id),
          github_issue_number: String(issue.number),
          github_repo: repoFullName,
          github_issue_url: issue.html_url,
          github_username: issue.user?.login ?? 'unknown',
          name: issue.user?.login ?? 'unknown',
          tags: tags.join(',') || undefined,
        },
        firstMessageAt: new Date(issue.created_at),
        lastActivityAt: new Date(issue.updated_at),
        createdAt: new Date(issue.created_at),
        messages,
      })

      ctx.progress({
        type: 'synced',
        externalId: String(issue.id),
        hissunoId: sessionId,
        message: `Synced #${issue.number}`,
        current: i + 1,
        total: issues.length,
      })
    } catch (err) {
      ctx.logger.error('issue ingest failed', {
        issueId: issue.id,
        error: err instanceof Error ? err.message : String(err),
      })
      ctx.progress({ type: 'failed', externalId: String(issue.id), message: String(err) })
    }
  }
}

async function runCodebaseSync(ctx: SyncCtx<z.infer<typeof codebaseSettingsSchema>, z.infer<typeof codebaseFilterSchema>>) {
  const repoFullName = ctx.instanceId
  if (!repoFullName) throw new Error('GitHub codebase sync requires a repo instance.')
  const creds = ctx.credentials as unknown as GitHubCredentials
  const token = await resolveToken(creds)

  const branch = ctx.settings.branch ?? ctx.filters.branch ?? 'main'
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) throw new Error(`Invalid GitHub repo: ${repoFullName}`)

  // Verify the repo (and branch, if specified) is reachable before creating
  // the codebase row.
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}${branch ? `/branches/${branch}` : ''}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub API error (${res.status}): ${text.slice(0, 200)}`)
  }

  const repositoryUrl = `https://github.com/${repoFullName}`

  try {
    const existing = await db
      .select({ id: codebases.id })
      .from(codebases)
      .where(
        and(
          eq(codebases.project_id, ctx.projectId),
          eq(codebases.repository_url, repositoryUrl),
          eq(codebases.repository_branch, branch),
        ),
      )
      .limit(1)

    let codebaseId: string
    if (existing[0]) {
      codebaseId = existing[0].id
    } else {
      const [project] = await db
        .select({ user_id: projects.user_id })
        .from(projects)
        .where(eq(projects.id, ctx.projectId))
        .limit(1)
      if (!project) throw new Error(`Project ${ctx.projectId} not found`)
      const { codebase } = await createGitHubCodebase({
        projectId: ctx.projectId,
        repositoryUrl,
        repositoryBranch: branch,
        userId: project.user_id,
        name: repoFullName,
      })
      codebaseId = codebase.id
    }

    await ctx.recordSynced({ externalId: repoFullName, hissunoId: codebaseId, kind: 'knowledge' })

    ctx.progress({ type: 'synced', externalId: repoFullName, hissunoId: codebaseId, message: `Registered ${repoFullName}` })
  } catch (err) {
    ctx.logger.error('codebase ingest failed', {
      repo: repoFullName,
      error: err instanceof Error ? err.message : String(err),
    })
    ctx.progress({ type: 'failed', externalId: repoFullName, message: String(err) })
  }
}

function deriveTagsFromLabels(issue: GitHubIssue, labelTagMap: Record<string, string>): string[] {
  const tags: string[] = []
  for (const label of issue.labels) {
    const mapped = labelTagMap[label.name]
    if (mapped && VALID_SESSION_TAGS.has(mapped) && !tags.includes(mapped)) tags.push(mapped)
  }
  return tags
}
