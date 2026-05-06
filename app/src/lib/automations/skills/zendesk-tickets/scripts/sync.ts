/**
 * Zendesk → Hissuno tickets sync. Solved + closed tickets become sessions.
 */

import { writeFileSync } from 'node:fs'

interface Creds {
  subdomain: string
  adminEmail: string
  apiToken: string
}

interface CursorState {
  updatedSince?: string
}

interface ZendeskTicket {
  id: number
  subject: string | null
  description: string | null
  created_at: string
  updated_at: string
  status: string
  requester_id?: number | null
}

interface ZendeskComment {
  id: number
  body: string
  author_id: number
  created_at: string
  public: boolean
}

interface ZendeskSearchResponse {
  results: ZendeskTicket[]
  next_page: string | null
}

interface ZendeskUserResponse {
  user: { id: number; email?: string; name?: string }
}

const credsRaw = mustEnv('ZENDESK_CREDENTIALS')
const creds = parseCreds(credsRaw)
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'
const zendeskBase = `https://${creds.subdomain}.zendesk.com/api/v2`
const zendeskAuth = 'Basic ' + Buffer.from(`${creds.adminEmail}/token:${creds.apiToken}`).toString('base64')

main().catch((err) => {
  console.error('[zendesk-tickets] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  const since = state.updatedSince ?? '1970-01-01T00:00:00Z'
  let maxUpdated = since
  let synced = 0
  let failed = 0

  const userCache = new Map<number, { email?: string; name?: string }>()
  let url: string | null = `${zendeskBase}/search.json?query=${encodeURIComponent(`type:ticket status:solved updated>${since.slice(0, 10)}`)}&sort_by=updated_at&sort_order=asc`

  while (url) {
    const res = await fetch(url, { headers: { Authorization: zendeskAuth, Accept: 'application/json' } })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Zendesk search HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const page = (await res.json()) as ZendeskSearchResponse
    for (const ticket of page.results) {
      try {
        await processTicket(ticket, userCache)
        synced++
        if (ticket.updated_at > maxUpdated) maxUpdated = ticket.updated_at
      } catch (err) {
        failed++
        console.error(`[zendesk-tickets] ticket ${ticket.id}:`, err instanceof Error ? err.message : String(err))
      }
    }
    url = page.next_page
  }

  await saveState({ updatedSince: maxUpdated })
  const summary = { synced, failed, cursor: maxUpdated }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[zendesk-tickets]', JSON.stringify(summary))
}

async function processTicket(
  ticket: ZendeskTicket,
  userCache: Map<number, { email?: string; name?: string }>,
): Promise<void> {
  const commentsRes = await fetch(`${zendeskBase}/tickets/${ticket.id}/comments.json`, {
    headers: { Authorization: zendeskAuth, Accept: 'application/json' },
  })
  if (!commentsRes.ok) {
    throw new Error(`Zendesk comments HTTP ${commentsRes.status}`)
  }
  const commentsJson = (await commentsRes.json()) as { comments: ZendeskComment[] }

  let requester: { email?: string; name?: string } | undefined
  if (ticket.requester_id) {
    requester = userCache.get(ticket.requester_id)
    if (!requester) {
      try {
        const userRes = await fetch(`${zendeskBase}/users/${ticket.requester_id}.json`, {
          headers: { Authorization: zendeskAuth, Accept: 'application/json' },
        })
        if (userRes.ok) {
          const json = (await userRes.json()) as ZendeskUserResponse
          requester = { email: json.user.email, name: json.user.name }
          userCache.set(ticket.requester_id, requester)
        }
      } catch {
        // best-effort
      }
    }
  }

  const messages = commentsJson.comments
    .filter((c) => c.public && c.body)
    .map((c) => ({
      role: c.author_id === ticket.requester_id ? ('user' as const) : ('assistant' as const),
      content: stripHtml(c.body),
    }))

  const body = {
    name: ticket.subject ?? `Zendesk #${ticket.id}`,
    description: ticket.description ?? undefined,
    session_type: 'chat',
    status: 'closed',
    source: 'zendesk',
    contact_email: requester?.email,
    user_metadata: {
      zendesk_ticket_id: String(ticket.id),
      ...(requester?.name ? { name: requester.name } : {}),
      ...(requester?.email ? { email: requester.email } : {}),
    },
    messages: messages.filter((m) => m.content.length > 0),
    external_id: String(ticket.id),
    external_source: 'zendesk',
  }

  const res = await hissunoFetch('POST', `/api/sessions?projectId=${encodeURIComponent(projectId)}`, body)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/sessions HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
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
  if (!parsed.subdomain || !parsed.adminEmail || !parsed.apiToken) {
    throw new Error('ZENDESK_CREDENTIALS missing subdomain/adminEmail/apiToken.')
  }
  return parsed as Creds
}

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
