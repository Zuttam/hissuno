/**
 * Gong → Hissuno calls sync.
 */

import { writeFileSync } from 'node:fs'

interface Creds {
  accessKey: string
  accessKeySecret: string
  baseUrl: string
}

interface CursorState {
  startedAfter?: string
}

interface GongCall {
  id: string
  title?: string
  started: string
  duration?: number
  primaryUserId?: string
  parties?: Array<{ id?: string; name?: string; emailAddress?: string; speakerId?: string }>
}

interface GongCallList {
  calls?: GongCall[]
  records?: { cursor?: string }
}

interface GongTranscriptCallEntry {
  speakerId?: string
  topic?: string | null
  sentences?: Array<{ text: string; start?: number }>
}

interface GongTranscriptCall {
  callId: string
  transcript?: GongTranscriptCallEntry[]
}

interface GongTranscriptResponse {
  callTranscripts?: GongTranscriptCall[]
}

const credsRaw = mustEnv('GONG_CREDENTIALS')
const creds = parseCreds(credsRaw)
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'
const gongAuth =
  'Basic ' + Buffer.from(`${creds.accessKey}:${creds.accessKeySecret}`).toString('base64')
const gongBase = creds.baseUrl.replace(/\/$/, '')

main().catch((err) => {
  console.error('[gong-calls] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  const since = state.startedAfter ?? '1970-01-01T00:00:00Z'
  let maxStarted = since
  let synced = 0
  let failed = 0

  let cursor: string | undefined
  while (true) {
    const url = new URL(`${gongBase}/v2/calls`)
    url.searchParams.set('fromDateTime', since)
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString(), { headers: { Authorization: gongAuth, Accept: 'application/json' } })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Gong HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const page = (await res.json()) as GongCallList
    const calls = page.calls ?? []
    for (const call of calls) {
      try {
        await processCall(call)
        synced++
        if (call.started > maxStarted) maxStarted = call.started
      } catch (err) {
        failed++
        console.error(`[gong-calls] ${call.id}:`, err instanceof Error ? err.message : String(err))
      }
    }
    if (!page.records?.cursor) break
    cursor = page.records.cursor
  }

  await saveState({ startedAfter: maxStarted })
  const summary = { synced, failed, cursor: maxStarted }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[gong-calls]', JSON.stringify(summary))
}

async function processCall(call: GongCall): Promise<void> {
  const transcriptRes = await fetch(`${gongBase}/v2/calls/transcript`, {
    method: 'POST',
    headers: { Authorization: gongAuth, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ filter: { callIds: [call.id] } }),
  })
  let transcript: GongTranscriptResponse | null = null
  if (transcriptRes.ok) {
    transcript = (await transcriptRes.json()) as GongTranscriptResponse
  }

  const speakerNames = new Map<string, string>()
  for (const party of call.parties ?? []) {
    if (party.speakerId && party.name) speakerNames.set(party.speakerId, party.name)
  }

  const entries = transcript?.callTranscripts?.[0]?.transcript ?? []
  const messages = entries.flatMap((entry) =>
    (entry.sentences ?? []).map((sentence) => ({
      role: 'user' as const,
      content: `${entry.speakerId ? (speakerNames.get(entry.speakerId) ?? 'Speaker') : 'Speaker'}: ${sentence.text}`,
    })),
  )

  const primaryEmail = call.parties?.find((p) => p.emailAddress)?.emailAddress

  const body = {
    name: call.title ?? `Gong call ${call.id}`,
    session_type: 'meeting',
    status: 'closed',
    source: 'gong',
    contact_email: primaryEmail,
    user_metadata: {
      gong_call_id: call.id,
      duration_seconds: call.duration,
    },
    messages,
    external_id: call.id,
    external_source: 'gong',
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
  if (!parsed.accessKey || !parsed.accessKeySecret || !parsed.baseUrl) {
    throw new Error('GONG_CREDENTIALS missing accessKey/accessKeySecret/baseUrl.')
  }
  return parsed as Creds
}

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
