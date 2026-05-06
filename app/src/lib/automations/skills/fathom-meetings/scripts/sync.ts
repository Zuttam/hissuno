/**
 * Fathom → Hissuno meetings sync.
 */

import { writeFileSync } from 'node:fs'

const FATHOM_API = 'https://api.fathom.ai'

interface CursorState {
  createdAfter?: string
}

interface FathomMeeting {
  id: string
  title?: string
  scheduled_start_time?: string
  scheduled_end_time?: string
  created_at: string
  recording_url?: string
  transcript?: { speakers?: Array<{ name?: string; email?: string }>; entries?: FathomEntry[] }
}

interface FathomEntry {
  speaker: { name?: string; email?: string }
  text: string
  start_time?: number
}

interface FathomListResponse {
  meetings: FathomMeeting[]
  pagination?: { next_cursor?: string | null }
}

const apiKey = mustEnv('FATHOM_API_KEY')
const hissunoApiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'

main().catch((err) => {
  console.error('[fathom-meetings] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  const since = state.createdAfter ?? '1970-01-01T00:00:00Z'
  let maxCreated = since
  let synced = 0
  let failed = 0

  let cursor: string | undefined
  while (true) {
    const url = new URL(`${FATHOM_API}/v1/meetings`)
    url.searchParams.set('created_after', since)
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString(), { headers: { 'X-Api-Key': apiKey, Accept: 'application/json' } })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Fathom HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const page = (await res.json()) as FathomListResponse
    for (const meeting of page.meetings) {
      try {
        await postMeeting(meeting)
        synced++
        if (meeting.created_at > maxCreated) maxCreated = meeting.created_at
      } catch (err) {
        failed++
        console.error(`[fathom-meetings] ${meeting.id}:`, err instanceof Error ? err.message : String(err))
      }
    }
    if (!page.pagination?.next_cursor) break
    cursor = page.pagination.next_cursor
  }

  await saveState({ createdAfter: maxCreated })
  const summary = { synced, failed, cursor: maxCreated }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[fathom-meetings]', JSON.stringify(summary))
}

async function postMeeting(meeting: FathomMeeting): Promise<void> {
  const messages = (meeting.transcript?.entries ?? []).map((e) => ({
    role: 'user' as const,
    content: `${e.speaker.name ?? 'Speaker'}: ${e.text}`,
  }))

  const firstSpeakerEmail = meeting.transcript?.speakers?.find((s) => s.email)?.email

  const body = {
    name: meeting.title ?? `Fathom meeting ${meeting.id}`,
    session_type: 'meeting',
    status: 'closed',
    source: 'fathom',
    contact_email: firstSpeakerEmail,
    user_metadata: {
      fathom_meeting_id: meeting.id,
      ...(meeting.recording_url ? { recording_url: meeting.recording_url } : {}),
    },
    messages,
    external_id: meeting.id,
    external_source: 'fathom',
  }

  const res = await hissunoFetch('POST', `/api/sessions?projectId=${encodeURIComponent(projectId)}`, body)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/sessions HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
}

async function loadState(): Promise<CursorState> {
  const res = await fetch(
    `${baseUrl}/api/automations/state?projectId=${encodeURIComponent(projectId)}&skillId=${encodeURIComponent(skillId)}`,
    { headers: { Authorization: `Bearer ${hissunoApiKey}` } },
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
      Authorization: `Bearer ${hissunoApiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
