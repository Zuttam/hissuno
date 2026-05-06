/**
 * Intercom → Hissuno conversations sync.
 *
 * Fetches conversations updated since the last cursor and posts them as
 * sessions. Incremental: state.updatedSince advances each run; postss to
 * /api/sessions with external_id so the resource POST registers the
 * external_records mapping.
 */

import { writeFileSync } from 'node:fs'

const INTERCOM_API = 'https://api.intercom.io'

interface CursorState {
  updatedSince?: number
}

interface IntercomAuthor {
  type: string
  id?: string
  email?: string
  name?: string
}

interface IntercomConversationPart {
  body?: string | null
  part_type: string
  author: IntercomAuthor
  created_at: number
}

interface IntercomConversation {
  id: string
  created_at: number
  updated_at: number
  source?: { body?: string | null; author: IntercomAuthor }
  conversation_parts?: { conversation_parts: IntercomConversationPart[] }
  contacts?: { contacts: Array<{ id: string; email?: string; name?: string }> }
}

interface IntercomSearchResponse {
  conversations: Array<{ id: string; updated_at: number }>
  pages?: { next?: { starting_after?: string } }
}

const accessToken = mustEnv('INTERCOM_ACCESS_TOKEN')
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'

main().catch((err) => {
  console.error('[intercom-conversations] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  const updatedSince = state.updatedSince ?? 0
  let maxUpdatedAt = updatedSince
  let synced = 0
  let failed = 0

  let startingAfter: string | undefined
  let hasMore = true

  while (hasMore) {
    const page = await searchConversations(updatedSince, startingAfter)
    for (const item of page.conversations) {
      try {
        const full = await fetchConversation(item.id)
        await postSession(full)
        synced++
        if (full.updated_at > maxUpdatedAt) maxUpdatedAt = full.updated_at
      } catch (err) {
        failed++
        console.error(`[intercom-conversations] ${item.id}:`, err instanceof Error ? err.message : String(err))
      }
    }
    startingAfter = page.pages?.next?.starting_after
    hasMore = Boolean(startingAfter)
  }

  await saveState({ updatedSince: maxUpdatedAt })

  const summary = { synced, failed, cursor: maxUpdatedAt }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[intercom-conversations]', JSON.stringify(summary))
}

async function searchConversations(updatedSince: number, startingAfter?: string): Promise<IntercomSearchResponse> {
  const body = {
    query: { field: 'updated_at', operator: '>', value: updatedSince },
    pagination: {
      per_page: 50,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    },
  }
  const res = await fetch(`${INTERCOM_API}/conversations/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Intercom search HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as IntercomSearchResponse
}

async function fetchConversation(id: string): Promise<IntercomConversation> {
  const res = await fetch(`${INTERCOM_API}/conversations/${id}?display_as=plaintext`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Intercom fetch HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as IntercomConversation
}

function mapAuthor(type: string): 'user' | 'ai' | 'human_agent' {
  if (type === 'user') return 'user'
  if (type === 'bot') return 'ai'
  return 'human_agent'
}

async function postSession(conversation: IntercomConversation): Promise<void> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  const opener = conversation.source?.body
  if (opener) {
    messages.push({
      role: mapAuthor(conversation.source?.author?.type ?? 'user') === 'user' ? 'user' : 'assistant',
      content: opener,
    })
  }
  for (const part of conversation.conversation_parts?.conversation_parts ?? []) {
    if (!part.body || part.part_type === 'assignment' || part.part_type === 'close') continue
    messages.push({
      role: mapAuthor(part.author.type) === 'user' ? 'user' : 'assistant',
      content: part.body,
    })
  }

  const contact = conversation.contacts?.contacts?.[0]
  const body = {
    name: `Intercom #${conversation.id}`,
    session_type: 'chat',
    status: 'closed',
    source: 'intercom',
    contact_email: contact?.email,
    user_metadata: {
      intercom_conversation_id: conversation.id,
      ...(contact?.id ? { userId: contact.id } : {}),
      ...(contact?.email ? { email: contact.email } : {}),
      ...(contact?.name ? { name: contact.name } : {}),
    },
    messages: messages.filter((m) => m.content.trim().length > 0),
    external_id: conversation.id,
    external_source: 'intercom',
  }

  const res = await hissunoFetch('POST', `/api/sessions?projectId=${encodeURIComponent(projectId)}`, body)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/sessions HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
}

async function loadState(): Promise<CursorState> {
  const url = `${baseUrl}/api/automations/state?projectId=${encodeURIComponent(projectId)}&skillId=${encodeURIComponent(skillId)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) throw new Error(`GET /api/automations/state HTTP ${res.status}`)
  const json = (await res.json()) as { state?: CursorState }
  return json.state ?? {}
}

async function saveState(state: CursorState): Promise<void> {
  const res = await hissunoFetch(
    'PUT',
    `/api/automations/state?projectId=${encodeURIComponent(projectId)}&skillId=${encodeURIComponent(skillId)}`,
    { state },
  )
  if (!res.ok) throw new Error(`PUT /api/automations/state HTTP ${res.status}`)
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

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
