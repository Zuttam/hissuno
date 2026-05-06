/**
 * HubSpot → Hissuno companies sync.
 *
 * The credential resolver refreshes the OAuth token before injecting it as
 * `HUBSPOT_ACCESS_TOKEN`, so the script just reads env and runs.
 */

import { writeFileSync } from 'node:fs'

const HUBSPOT_API = 'https://api.hubapi.com'
const COMPANY_PROPERTIES = [
  'name',
  'domain',
  'industry',
  'country',
  'numberofemployees',
  'description',
  'hs_lastmodifieddate',
]

interface CursorState {
  lastModifiedSince?: string
}

interface HubSpotCompany {
  id: string
  properties: Record<string, string | null>
  updatedAt?: string
}

interface HubSpotSearchResponse {
  results: HubSpotCompany[]
  paging?: { next?: { after?: string } }
}

const accessToken = mustEnv('HUBSPOT_ACCESS_TOKEN')
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'

main().catch((err) => {
  console.error('[hubspot-companies] sync failed:', err instanceof Error ? err.message : String(err))
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
    const page = await searchCompanies(since, after)
    const items = page.results.map(toCompanyItem).filter((c): c is CompanyItem => c !== null)
    if (items.length > 0) {
      try {
        await postBatch(items)
        synced += items.length
      } catch (err) {
        failed += items.length
        console.error('[hubspot-companies] batch post failed:', err instanceof Error ? err.message : String(err))
      }
    }
    for (const c of page.results) {
      const ts = c.properties.hs_lastmodifieddate
      if (ts && ts > maxModified) maxModified = ts
    }
    after = page.paging?.next?.after
    hasMore = Boolean(after)
  }

  await saveState({ lastModifiedSince: maxModified })
  const summary = { synced, failed, cursor: maxModified }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[hubspot-companies]', JSON.stringify(summary))
}

interface CompanyItem {
  name: string
  domain: string
  industry?: string | null
  country?: string | null
  employee_count?: number | null
  notes?: string | null
  external_id: string
  external_source: 'hubspot'
}

function toCompanyItem(c: HubSpotCompany): CompanyItem | null {
  const domain = c.properties.domain?.trim()
  const name = c.properties.name?.trim()
  if (!domain || !name) return null
  const employeeCount = c.properties.numberofemployees ? Number(c.properties.numberofemployees) : null
  return {
    name,
    domain,
    industry: c.properties.industry ?? null,
    country: c.properties.country ?? null,
    employee_count: Number.isFinite(employeeCount as number) ? (employeeCount as number) : null,
    notes: c.properties.description ?? null,
    external_id: c.id,
    external_source: 'hubspot',
  }
}

async function searchCompanies(sinceIso: string, after?: string): Promise<HubSpotSearchResponse> {
  const sinceMs = String(new Date(sinceIso).getTime())
  const body = {
    filterGroups: [
      {
        filters: [{ propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: sinceMs }],
      },
    ],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
    properties: COMPANY_PROPERTIES,
    limit: 100,
    ...(after ? { after } : {}),
  }
  const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/companies/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HubSpot search HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as HubSpotSearchResponse
}

async function postBatch(items: CompanyItem[]): Promise<void> {
  const res = await hissunoFetch(
    'POST',
    `/api/companies?projectId=${encodeURIComponent(projectId)}`,
    { items },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /api/companies HTTP ${res.status}: ${text.slice(0, 200)}`)
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
