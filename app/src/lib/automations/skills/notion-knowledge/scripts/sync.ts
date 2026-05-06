/**
 * Notion → Hissuno knowledge sync. Walks a page tree, posts each page as a
 * knowledge source under the chosen product scope.
 */

import { writeFileSync } from 'node:fs'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

interface NotionPage {
  id: string
  url: string
  properties?: Record<string, unknown>
}

interface NotionBlock {
  id: string
  type: string
  has_children?: boolean
  child_page?: { title?: string }
}

interface BlockChildrenResponse {
  results: NotionBlock[]
  has_more: boolean
  next_cursor: string | null
}

const accessToken = mustEnv('NOTION_ACCESS_TOKEN')
const apiKey = mustEnv('HISSUNO_API_KEY')
const projectId = mustEnv('HISSUNO_PROJECT_ID')
const skillId = mustEnv('HISSUNO_SKILL_ID')
const baseUrl = process.env.HISSUNO_BASE_URL || 'http://localhost:3000'
const runInput = parseRunInput()
const rootPageId = mustString(runInput.rootPageId, 'rootPageId')
const productScopeId = mustString(runInput.productScopeId, 'productScopeId')
const includeChildren = runInput.includeChildren !== false

main().catch((err) => {
  console.error('[notion-knowledge] sync failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

async function main(): Promise<void> {
  const queue: string[] = [rootPageId]
  const visited = new Set<string>()
  let synced = 0
  let failed = 0

  while (queue.length > 0) {
    const pageId = queue.shift()!
    if (visited.has(pageId)) continue
    visited.add(pageId)
    try {
      const page = await fetchPage(pageId)
      await postPage(page)
      synced++
      if (includeChildren) {
        const blocks = await fetchAllBlocks(pageId)
        for (const block of blocks) {
          if (block.type === 'child_page' && !visited.has(block.id)) queue.push(block.id)
        }
      }
    } catch (err) {
      failed++
      console.error(`[notion-knowledge] ${pageId}:`, err instanceof Error ? err.message : String(err))
    }
  }

  const summary = { synced, failed, visited: visited.size }
  writeFileSync('output.json', JSON.stringify(summary, null, 2))
  console.log('[notion-knowledge]', JSON.stringify(summary))
}

async function fetchPage(pageId: string): Promise<NotionPage> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, { headers: notionHeaders() })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion fetch HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as NotionPage
}

async function fetchAllBlocks(pageId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = []
  let startCursor: string | undefined
  while (true) {
    const url = new URL(`${NOTION_API}/blocks/${pageId}/children`)
    url.searchParams.set('page_size', '100')
    if (startCursor) url.searchParams.set('start_cursor', startCursor)
    const res = await fetch(url.toString(), { headers: notionHeaders() })
    if (!res.ok) break
    const json = (await res.json()) as BlockChildrenResponse
    blocks.push(...json.results)
    if (!json.has_more || !json.next_cursor) break
    startCursor = json.next_cursor
  }
  return blocks
}

async function postPage(page: NotionPage): Promise<void> {
  const title = extractTitle(page.properties ?? {}) || 'Untitled Notion page'
  const body = {
    type: 'notion',
    notionPageId: page.id,
    name: title,
    url: page.url,
    productScopeId,
    origin: 'notion_sync',
    external_id: page.id,
    external_source: 'notion',
  }
  const res = await hissunoFetch(
    'POST',
    `/api/product-scopes/${encodeURIComponent(productScopeId)}/knowledge?projectId=${encodeURIComponent(projectId)}`,
    body,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST /knowledge HTTP ${res.status}: ${text.slice(0, 200)}`)
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
    Accept: 'application/json',
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

function mustString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Required input ${label} is missing.`)
  return value
}

function mustEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var ${name} is missing.`)
  return value
}
