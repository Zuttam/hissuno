/**
 * GitHub → Hissuno feedback sync. Each issue becomes a session. Comments
 * are inlined as messages.
 *
 * Auth: prefers a PAT (GITHUB_ACCESS_TOKEN). For GitHub App connections the
 * credential resolver injects the access token field as accessToken when
 * the connection has authMethod === 'pat'; for App auth use the
 * `gh` CLI or extend this script with installation token issuance.
 */

import { writeFileSync } from 'node:fs'

const GITHUB_API = 'https://api.github.com'

interface CursorState {
  // keyed by repoFullName
  [repo: string]: { updatedSince?: string }
}

interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  comments: number
  html_url: string
  user: { login: string } | null
  created_at: string
  updated_at: string
  pull_request?: unknown
}

interface GitHubComment {
  id: number
  body: string | null
  user: { login: string } | null
  created_at: string
}

const accessToken = mustEnv('GITHUB_ACCESS_TOKEN')
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'
const runInput = parseRunInput()
const repoFullName = mustString(runInput.repoFullName, 'repoFullName')

main().catch((err) => {
  console.error('[github-feedback] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  const since = state[repoFullName]?.updatedSince ?? '1970-01-01T00:00:00Z'
  let maxUpdated = since
  let synced = 0
  let failed = 0

  const issues = await listIssues(repoFullName, since)
  for (const issue of issues) {
    try {
      await processIssue(issue, repoFullName)
      synced++
      if (issue.updated_at > maxUpdated) maxUpdated = issue.updated_at
    } catch (err) {
      failed++
      console.error(`[github-feedback] #${issue.number}:`, err instanceof Error ? err.message : String(err))
    }
  }

  const newState: CursorState = { ...state, [repoFullName]: { updatedSince: maxUpdated } }
  await saveState(newState)
  const summary = { repoFullName, synced, failed, cursor: maxUpdated }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[github-feedback]', JSON.stringify(summary))
}

async function listIssues(repo: string, since: string): Promise<GitHubIssue[]> {
  const out: GitHubIssue[] = []
  let page = 1
  while (true) {
    const url = `${GITHUB_API}/repos/${repo}/issues?state=all&since=${encodeURIComponent(since)}&per_page=100&page=${page}`
    const res = await fetch(url, { headers: githubHeaders() })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`GitHub list HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const items = (await res.json()) as GitHubIssue[]
    out.push(...items.filter((i) => !i.pull_request))
    if (items.length < 100) break
    page++
  }
  return out
}

async function processIssue(issue: GitHubIssue, repo: string): Promise<void> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (issue.body && issue.body.trim()) {
    messages.push({ role: 'user', content: issue.body.trim() })
  }
  if (issue.comments > 0) {
    const comments = await listComments(repo, issue.number)
    const author = issue.user?.login
    for (const c of comments) {
      if (!c.body) continue
      messages.push({
        role: c.user?.login === author ? 'user' : 'assistant',
        content: c.body,
      })
    }
  }

  const body = {
    name: `#${issue.number} ${issue.title}`,
    session_type: 'chat',
    status: 'closed',
    source: 'github',
    user_metadata: {
      github_issue_id: String(issue.id),
      github_issue_number: String(issue.number),
      github_repo: repo,
      github_issue_url: issue.html_url,
      github_username: issue.user?.login ?? 'unknown',
      name: issue.user?.login ?? 'unknown',
    },
    messages: messages.filter((m) => m.content.trim().length > 0),
    external_id: String(issue.id),
    external_source: 'github',
  }
  const res = await hissunoFetch('POST', `/api/sessions?projectId=${encodeURIComponent(projectId)}`, body)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/sessions HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
}

async function listComments(repo: string, issueNumber: number): Promise<GitHubComment[]> {
  const out: GitHubComment[] = []
  let page = 1
  while (true) {
    const url = `${GITHUB_API}/repos/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`
    const res = await fetch(url, { headers: githubHeaders() })
    if (!res.ok) break
    const items = (await res.json()) as GitHubComment[]
    out.push(...items)
    if (items.length < 100) break
    page++
  }
  return out
}

function githubHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function loadState(): Promise<CursorState> {
  const res = await fetch(
    `${baseUrl}/api/automations/state?projectId=${encodeURIComponent(projectId)}&skillId=${encodeURIComponent(skillId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  )
  if (!res.ok) throw new Error(`GET state HTTP ${res.status}`)
  const json = (await res.json()) as { state?: CursorState }
  return json.state ?? {}
}

async function saveState(state: CursorState): Promise<void> {
  const res = await hissunoFetch(
    'PUT',
    `/api/automations/state?projectId=${encodeURIComponent(projectId)}&skillId=${encodeURIComponent(skillId)}`,
    { state },
  )
  if (!res.ok) throw new Error(`PUT state HTTP ${res.status}`)
}

async function hissunoFetch(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function parseRunInput(): Record<string, unknown> {
  const raw = process.env.HISSUNO_RUN_INPUT
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function mustString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Required input ${label} is missing.`)
  return value
}

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
