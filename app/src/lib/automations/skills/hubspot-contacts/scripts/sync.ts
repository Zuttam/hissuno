/**
 * HubSpot → Hissuno contacts sync.
 *
 * Pulls contacts in pages, posts to /api/contacts in batches. Doesn't
 * resolve company association here — the contact's company name (if any) is
 * stashed in custom_fields and downstream tools can join later.
 */

import { writeFileSync } from 'node:fs'

const HUBSPOT_API = 'https://api.hubapi.com'
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'phone',
  'jobtitle',
  'company',
  'lastmodifieddate',
]

interface CursorState {
  lastModifiedSince?: string
}

interface HubSpotContact {
  id: string
  properties: Record<string, string | null>
}

interface HubSpotSearchResponse {
  results: HubSpotContact[]
  paging?: { next?: { after?: string } }
}

const accessToken = mustEnv('HUBSPOT_ACCESS_TOKEN')
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'

main().catch((err) => {
  console.error('[hubspot-contacts] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const state = await loadState()
  const since = state.lastModifiedSince ?? '1970-01-01T00:00:00.000Z'
  let maxModified = since
  let synced = 0
  let failed = 0

  let after: string | undefined
  let hasMore = true

  while (hasMore) {
    const page = await searchContacts(since, after)
    const items = page.results
      .map(toContactItem)
      .filter((c): c is ContactItem => c !== null)
    if (items.length > 0) {
      try {
        await postBatch(items)
        synced += items.length
      } catch (err) {
        failed += items.length
        console.error('[hubspot-contacts] batch failed:', err instanceof Error ? err.message : String(err))
      }
    }
    for (const c of page.results) {
      const ts = c.properties.lastmodifieddate
      if (ts && ts > maxModified) maxModified = ts
    }
    after = page.paging?.next?.after
    hasMore = Boolean(after)
  }

  await saveState({ lastModifiedSince: maxModified })
  const summary = { synced, failed, cursor: maxModified }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[hubspot-contacts]', JSON.stringify(summary))
}

interface ContactItem {
  name: string
  email: string
  phone?: string | null
  title?: string | null
  custom_fields?: Record<string, unknown>
  external_id: string
  external_source: 'hubspot'
}

function toContactItem(c: HubSpotContact): ContactItem | null {
  const email = c.properties.email?.trim()
  if (!email) return null
  const first = c.properties.firstname?.trim() ?? ''
  const last = c.properties.lastname?.trim() ?? ''
  const name = [first, last].filter(Boolean).join(' ') || email
  return {
    name,
    email,
    phone: c.properties.phone ?? null,
    title: c.properties.jobtitle ?? null,
    custom_fields: c.properties.company ? { hubspot_company: c.properties.company } : undefined,
    external_id: c.id,
    external_source: 'hubspot',
  }
}

async function searchContacts(sinceIso: string, after?: string): Promise<HubSpotSearchResponse> {
  const sinceMs = String(new Date(sinceIso).getTime())
  const body = {
    filterGroups: [
      { filters: [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: sinceMs }] },
    ],
    sorts: [{ propertyName: 'lastmodifieddate', direction: 'ASCENDING' }],
    properties: CONTACT_PROPERTIES,
    limit: 100,
    ...(after ? { after } : {}),
  }
  const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HubSpot search HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as HubSpotSearchResponse
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

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
