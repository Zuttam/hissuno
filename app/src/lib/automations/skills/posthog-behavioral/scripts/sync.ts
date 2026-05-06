/**
 * PostHog → Hissuno persons → contacts. Minimal v1.
 */

import { writeFileSync } from 'node:fs'

interface Creds {
  apiKey: string
  host: string
  posthogProjectId: string
}

interface CursorState {
  nextUrl?: string | null
}

interface PosthogPerson {
  id: string
  distinct_ids: string[]
  properties: Record<string, unknown>
  created_at: string
}

interface PosthogPersonsResponse {
  results: PosthogPerson[]
  next: string | null
}

const credsRaw = mustEnv('POSTHOG_CREDENTIALS')
const creds = parseCreds(credsRaw)
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'
const posthogBase = creds.host.replace(/\/$/, '')

main().catch((err) => {
  console.error('[posthog-behavioral] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  let url: string | null = state.nextUrl ?? `${posthogBase}/api/projects/${creds.posthogProjectId}/persons/?limit=100`
  let synced = 0
  let failed = 0

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.apiKey}`, Accept: 'application/json' } })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`PostHog HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const page = (await res.json()) as PosthogPersonsResponse
    const items = page.results
      .map(toContactItem)
      .filter((c): c is ContactItem => c !== null)
    if (items.length > 0) {
      try {
        await postBatch(items)
        synced += items.length
      } catch (err) {
        failed += items.length
        console.error('[posthog-behavioral] batch failed:', err instanceof Error ? err.message : String(err))
      }
    }
    url = page.next ?? null
    if (!url) break
  }

  // Cursor cleared once we reach the end so the next run restarts from scratch.
  // (Switch to created-after filtering once the PostHog endpoint supports it.)
  await saveState({ nextUrl: null })
  const summary = { synced, failed }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[posthog-behavioral]', JSON.stringify(summary))
}

interface ContactItem {
  name: string
  email: string
  custom_fields?: Record<string, unknown>
  external_id: string
  external_source: 'posthog'
}

function toContactItem(p: PosthogPerson): ContactItem | null {
  const props = p.properties || {}
  const email = typeof props.email === 'string' ? props.email.trim() : ''
  if (!email) return null
  const name =
    (typeof props.name === 'string' && props.name.trim()) ||
    [props.first_name, props.last_name].filter((v) => typeof v === 'string').join(' ').trim() ||
    email
  return {
    name,
    email,
    custom_fields: { posthog_distinct_ids: p.distinct_ids, posthog_created_at: p.created_at },
    external_id: p.id,
    external_source: 'posthog',
  }
}

async function postBatch(items: ContactItem[]): Promise<void> {
  const res = await hissunoFetch(
    'POST',
    `/api/contacts?projectId=${encodeURIComponent(projectId)}`,
    { items },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/contacts HTTP ${res.status}: ${text.slice(0, 200)}`)
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

function parseCreds(raw: string): Creds {
  const parsed = JSON.parse(raw) as Partial<Creds>
  if (!parsed.apiKey || !parsed.host || !parsed.posthogProjectId) {
    throw new Error('POSTHOG_CREDENTIALS missing apiKey/host/posthogProjectId.')
  }
  return parsed as Creds
}

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
