/**
 * Jira → Hissuno issues sync. Parameterized per project key.
 */

import { writeFileSync } from 'node:fs'

const JIRA_API_BASE = 'https://api.atlassian.com/ex/jira'

interface CursorState {
  // keyed by projectKey
  [projectKey: string]: { updatedSince?: string }
}

interface JiraCredentials {
  accessToken?: string
  cloudId?: string
}

interface JiraIssue {
  id: string
  key: string
  fields: Record<string, unknown>
}

interface JiraSearchPage {
  issues: JiraIssue[]
  total: number
}

const accessToken = mustEnv('JIRA_ACCESS_TOKEN')
const credentialsRaw = process.env.JIRA_CREDENTIALS
const credsFromEnv: JiraCredentials = credentialsRaw ? safeJson(credentialsRaw) : {}
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'
const runInput = parseRunInput()
const projectKey = mustString(runInput.projectKey, 'projectKey')
const cloudId = (runInput.cloudId as string | undefined) || credsFromEnv.cloudId
if (!cloudId) {
  console.error('[jira-issues] cloudId missing — pass as input.cloudId or ensure connection has it')
  process.exit(1)
}

main().catch((err) => {
  console.error('[jira-issues] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  const since = state[projectKey]?.updatedSince ?? '1970-01-01 00:00'
  let maxUpdated = since
  let synced = 0
  let failed = 0

  const jql =
    `project = "${projectKey}" AND updated >= "${since}" ORDER BY updated ASC`
  let startAt = 0
  const maxResults = 50

  while (true) {
    const page = await search(jql, startAt, maxResults)
    if (page.issues.length === 0) break
    for (const issue of page.issues) {
      try {
        await postIssue(issue)
        synced++
        const updated = issue.fields.updated as string | undefined
        if (updated && updated > maxUpdated) maxUpdated = formatJiraDate(updated)
      } catch (err) {
        failed++
        console.error(`[jira-issues] ${issue.key} failed:`, err instanceof Error ? err.message : String(err))
      }
    }
    if (page.issues.length < maxResults) break
    startAt += maxResults
  }

  const newState: CursorState = { ...state, [projectKey]: { updatedSince: maxUpdated } }
  await saveState(newState)
  const summary = { projectKey, synced, failed, cursor: maxUpdated }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[jira-issues]', JSON.stringify(summary))
}

async function search(jql: string, startAt: number, maxResults: number): Promise<JiraSearchPage> {
  const url = `${JIRA_API_BASE}/${cloudId}/rest/api/3/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,description,status,priority,issuetype,updated`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Jira search HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as JiraSearchPage
}

async function postIssue(issue: JiraIssue): Promise<void> {
  const fields = issue.fields
  const summary = String(fields.summary ?? issue.key)
  const description = typeof fields.description === 'string' ? fields.description : ''
  const status = mapStatus(fields.status)
  const priority = mapPriority(fields.priority)
  const issueType = mapIssueType((fields.issuetype as { name?: string })?.name)

  const body = {
    type: issueType,
    name: summary,
    description: description || summary,
    status,
    priority,
    custom_fields: {
      jira_key: issue.key,
      jira_project_key: projectKey,
      jira_issue_type: (fields.issuetype as { name?: string })?.name ?? null,
    },
    external_id: issue.id,
    external_source: 'jira',
  }
  const res = await hissunoFetch('POST', `/api/issues?projectId=${encodeURIComponent(projectId)}`, body)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/issues HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
}

function mapIssueType(name: string | undefined): 'bug' | 'feature_request' | 'change_request' {
  const n = (name ?? '').toLowerCase()
  if (n.includes('bug')) return 'bug'
  if (n.includes('story') || n.includes('feature')) return 'feature_request'
  return 'change_request'
}

function mapStatus(raw: unknown): 'open' | 'ready' | 'in_progress' | 'resolved' | 'closed' {
  const key = (raw as { statusCategory?: { key?: string } } | undefined)?.statusCategory?.key
  if (key === 'done') return 'resolved'
  if (key === 'indeterminate') return 'in_progress'
  return 'open'
}

function mapPriority(raw: unknown): 'low' | 'medium' | 'high' | undefined {
  const name = (raw as { name?: string } | undefined)?.name?.toLowerCase() ?? ''
  if (name.includes('highest') || name.includes('high')) return 'high'
  if (name.includes('medium')) return 'medium'
  if (name.includes('low') || name.includes('lowest')) return 'low'
  return undefined
}

function formatJiraDate(iso: string): string {
  // Jira's JQL accepts "yyyy-MM-dd HH:mm" without timezone.
  return iso.replace('T', ' ').replace(/\.\d+([+-]\d{4}|Z)$/, '')
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

function safeJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return {} as T
  }
}
