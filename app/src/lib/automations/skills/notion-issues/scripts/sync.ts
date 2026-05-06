/**
 * Notion → Hissuno issues sync. Parameterized per database.
 */

import { writeFileSync } from 'node:fs'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

interface CursorState {
  // keyed by database id
  [databaseId: string]: { lastEditedSince?: string }
}

interface NotionPage {
  id: string
  url: string
  last_edited_time: string
  properties: Record<string, unknown>
}

interface NotionQueryResponse {
  results: NotionPage[]
  has_more: boolean
  next_cursor: string | null
}

const accessToken = mustEnv('NOTION_ACCESS_TOKEN')
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'
const runInput = parseRunInput()
const databaseId = mustString(runInput.databaseId, 'databaseId')

main().catch((err) => {
  console.error('[notion-issues] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  const since = state[databaseId]?.lastEditedSince ?? '1970-01-01T00:00:00.000Z'
  let maxEdited = since
  let synced = 0
  let failed = 0

  let startCursor: string | undefined
  while (true) {
    const page = await query(since, startCursor)
    for (const row of page.results) {
      try {
        await postIssue(row)
        synced++
        if (row.last_edited_time > maxEdited) maxEdited = row.last_edited_time
      } catch (err) {
        failed++
        console.error(`[notion-issues] ${row.id}:`, err instanceof Error ? err.message : String(err))
      }
    }
    if (!page.has_more || !page.next_cursor) break
    startCursor = page.next_cursor
  }

  const newState: CursorState = { ...state, [databaseId]: { lastEditedSince: maxEdited } }
  await saveState(newState)
  const summary = { databaseId, synced, failed, cursor: maxEdited }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[notion-issues]', JSON.stringify(summary))
}

async function query(sinceIso: string, startCursor?: string): Promise<NotionQueryResponse> {
  const body = {
    filter: {
      property: 'last_edited_time',
      date: { on_or_after: sinceIso },
    },
    sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }],
    page_size: 100,
    ...(startCursor ? { start_cursor: startCursor } : {}),
  }
  const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion query HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as NotionQueryResponse
}

async function postIssue(page: NotionPage): Promise<void> {
  const title = extractTitle(page.properties) || 'Untitled Notion row'
  const body = {
    type: 'change_request' as const,
    name: title,
    description: title,
    custom_fields: {
      notion_page_id: page.id,
      notion_url: page.url,
      notion_database_id: databaseId,
    },
    external_id: page.id,
    external_source: 'notion',
  }
  const res = await hissunoFetch('POST', `/api/issues?projectId=${encodeURIComponent(projectId)}`, body)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/issues HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
}

function extractTitle(props: Record<string, unknown>): string {
  for (const prop of Object.values(props)) {
    const p = prop as { type?: string; title?: Array<{ plain_text?: string }> }
    if (p?.type === 'title' && Array.isArray(p.title)) {
      return p.title.map((t) => t.plain_text ?? '').join('').trim()
    }
  }
  return ''
}

function notionHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
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
