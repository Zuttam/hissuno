/**
 * Linear → Hissuno issues sync.
 *
 * Runs inside the skill-runner sandbox. Reads tokens from env, queries the
 * Linear GraphQL API, posts new/updated issues to the hissuno API, and
 * advances the cursor stored in automation_skill_state.
 *
 * Idempotency: external_records (keyed on (project, source='linear', external_id))
 * is upserted by the POST /api/issues route. Re-running the same window only
 * inserts new rows; existing mappings are updated in place. The cursor avoids
 * re-fetching unchanged data, but isn't load-bearing for correctness.
 */

import { writeFileSync } from 'node:fs'

const LINEAR_API = 'https://api.linear.app/graphql'

type CursorState = Record<string, { updatedAtSince: string }>

interface LinearState {
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' | string
}

interface LinearIssue {
  id: string
  identifier: string
  title: string
  description: string | null
  url: string
  priority: number | null
  updatedAt: string
  state: LinearState | null
}

interface LinearIssuesPage {
  nodes: LinearIssue[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

const accessToken = mustEnv('LINEAR_ACCESS_TOKEN')
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || process.env.HISSUNO_API_BASE_URL || 'http://localhost:3000'

const runInput = parseRunInput()
const teamId = mustString(runInput.teamId, 'HISSUNO_RUN_INPUT.teamId')

main().catch((err) => {
  console.error('[linear-issues] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadCursorState()
  const cursorIso = state[teamId]?.updatedAtSince ?? '1970-01-01T00:00:00.000Z'

  let synced = 0
  let failed = 0
  let maxUpdatedAt = cursorIso
  let pageCursor: string | null = null
  let hasNext = true

  while (hasNext) {
    const page = await fetchIssuesPage(teamId, cursorIso, pageCursor)
    for (const issue of page.nodes) {
      try {
        await postIssue(issue)
        synced++
      } catch (err) {
        failed++
        console.error(`[linear-issues] failed to post ${issue.identifier}:`, err instanceof Error ? err.message : String(err))
      }
      if (issue.updatedAt > maxUpdatedAt) maxUpdatedAt = issue.updatedAt
    }
    hasNext = page.pageInfo.hasNextPage
    pageCursor = page.pageInfo.endCursor
  }

  state[teamId] = { updatedAtSince: maxUpdatedAt }
  await saveCursorState(state)

  const summary = { synced, failed, cursor: maxUpdatedAt }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[linear-issues]', JSON.stringify(summary))
}

async function fetchIssuesPage(team: string, updatedAtSince: string, after: string | null): Promise<LinearIssuesPage> {
  const query = `
    query Issues($teamId: ID!, $since: DateTime!, $after: String) {
      issues(
        first: 50
        after: $after
        filter: { team: { id: { eq: $teamId } }, updatedAt: { gte: $since } }
      ) {
        nodes {
          id
          identifier
          title
          description
          url
          priority
          updatedAt
          state { type }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: accessToken,
    },
    body: JSON.stringify({ query, variables: { teamId: team, since: updatedAtSince, after } }),
  })
  if (!res.ok) {
    throw new Error(`Linear API HTTP ${res.status}: ${await res.text()}`)
  }
  const json = (await res.json()) as { data?: { issues?: LinearIssuesPage }; errors?: unknown[] }
  if (json.errors) {
    throw new Error(`Linear GraphQL errors: ${JSON.stringify(json.errors)}`)
  }
  if (!json.data?.issues) {
    throw new Error('Linear response missing data.issues')
  }
  return json.data.issues
}

async function postIssue(issue: LinearIssue): Promise<void> {
  const body = {
    type: 'change_request',
    name: issue.title,
    description: issue.description ?? '',
    priority: mapPriority(issue.priority),
    custom_fields: {
      linear_identifier: issue.identifier,
      linear_url: issue.url,
      linear_team_id: teamId,
      linear_state_type: issue.state?.type ?? null,
    },
    external_id: issue.id,
    external_source: 'linear',
  }
  const res = await hissunoFetch('POST', `/api/issues?projectId=${encodeURIComponent(projectId)}`, body)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/issues HTTP ${res.status}: ${text}`)
  }
}

function mapPriority(priority: number | null): 'low' | 'medium' | 'high' | undefined {
  if (priority == null) return undefined
  if (priority >= 1 && priority <= 2) return 'high'
  if (priority === 3) return 'medium'
  if (priority >= 4) return 'low'
  return undefined
}

async function loadCursorState(): Promise<CursorState> {
  const url = `${baseUrl}/api/automations/state?projectId=${encodeURIComponent(projectId)}&skillId=${encodeURIComponent(skillId)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) {
    throw new Error(`GET /api/automations/state HTTP ${res.status}`)
  }
  const json = (await res.json()) as { state?: CursorState }
  return json.state ?? {}
}

async function saveCursorState(state: CursorState): Promise<void> {
  const res = await hissunoFetch(
    'PUT',
    `/api/automations/state?projectId=${encodeURIComponent(projectId)}&skillId=${encodeURIComponent(skillId)}`,
    { state },
  )
  if (!res.ok) {
    throw new Error(`PUT /api/automations/state HTTP ${res.status}`)
  }
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

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}

function mustString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Required input ${label} is missing or not a string.`)
  }
  return value
}
