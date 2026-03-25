/**
 * Notion API client.
 * Lightweight wrapper around the Notion REST API using fetch.
 *
 * API Documentation: https://developers.notion.com/reference
 */

const NOTION_API_VERSION = '2022-06-28'
const NOTION_BASE_URL = 'https://api.notion.com/v1'

export class NotionApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message)
    this.name = 'NotionApiError'
  }
}

export interface NotionRichText {
  type: string
  text?: { content: string; link?: { url: string } | null }
  mention?: unknown
  equation?: { expression: string }
  annotations?: {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    code?: boolean
  }
  plain_text: string
  href?: string | null
}

export interface NotionBlock {
  id: string
  type: string
  has_children: boolean
  [key: string]: unknown
}

export interface NotionPage {
  id: string
  object: 'page'
  parent: { type: string; [key: string]: unknown }
  properties: Record<string, unknown>
  icon?: { type: string; emoji?: string; external?: { url: string } } | null
  url: string
  created_time: string
  last_edited_time: string
}

export interface NotionSearchResult {
  id: string
  object: 'page' | 'database'
  parent: { type: string; [key: string]: unknown }
  icon?: { type: string; emoji?: string; external?: { url: string } } | null
  url: string
  created_time: string
  last_edited_time: string
  // page properties or database title
  properties?: Record<string, unknown>
  title?: NotionRichText[]
}

export interface NotionDatabaseProperty {
  id: string
  name: string
  type: string
  title?: Record<string, never>
  rich_text?: Record<string, never>
  number?: { format: string }
  select?: { options: Array<{ id: string; name: string; color: string }> }
  multi_select?: { options: Array<{ id: string; name: string; color: string }> }
  status?: {
    options: Array<{ id: string; name: string; color: string }>
    groups: Array<{ id: string; name: string; option_ids: string[] }>
  }
  date?: Record<string, never>
  people?: Record<string, never>
  checkbox?: Record<string, never>
  url?: Record<string, never>
  email?: Record<string, never>
  phone_number?: Record<string, never>
  formula?: { expression: string }
  relation?: { database_id: string }
  rollup?: { function: string }
}

export interface NotionDatabase {
  id: string
  object: 'database'
  title: NotionRichText[]
  properties: Record<string, NotionDatabaseProperty>
  url: string
  created_time: string
  last_edited_time: string
}

export class NotionClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | undefined>
      body?: Record<string, unknown>
    } = {}
  ): Promise<T> {
    const url = new URL(`${NOTION_BASE_URL}${path}`)

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Notion-Version': NOTION_API_VERSION,
      Accept: 'application/json',
    }

    const fetchOptions: RequestInit = { method, headers }

    if (options.body) {
      headers['Content-Type'] = 'application/json'
      fetchOptions.body = JSON.stringify(options.body)
    }

    const response = await fetch(url.toString(), fetchOptions)

    const text = await response.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(text)
    } catch {
      throw new NotionApiError(`Notion returned non-JSON response (${response.status})`, response.status)
    }

    if (!response.ok) {
      const message =
        (data.message as string) ||
        (data.error as string) ||
        `Notion API error (${response.status})`
      const code = data.code as string | undefined
      throw new NotionApiError(message, response.status, code)
    }

    return data as T
  }

  /**
   * Test the connection by fetching the bot user info.
   */
  async testConnection(): Promise<{ botId: string; name: string }> {
    const data = await this.request<{ bot: { owner: { type: string } }; id: string; name: string }>(
      'GET',
      '/users/me'
    )
    return { botId: data.id, name: data.name }
  }

  /**
   * Search for pages and databases.
   */
  async search(params: {
    query?: string
    filter?: { property: string; value: string }
    startCursor?: string
    pageSize?: number
  } = {}): Promise<{
    results: NotionSearchResult[]
    next_cursor: string | null
    has_more: boolean
  }> {
    const body: Record<string, unknown> = {}
    if (params.query) body.query = params.query
    if (params.filter) body.filter = params.filter
    if (params.startCursor) body.start_cursor = params.startCursor
    if (params.pageSize) body.page_size = params.pageSize

    return this.request('POST', '/search', { body })
  }

  /**
   * Get a single page by ID.
   */
  async getPage(pageId: string): Promise<NotionPage> {
    return this.request('GET', `/pages/${pageId}`)
  }

  /**
   * Get child blocks of a block/page (paginated).
   */
  async getPageBlocks(
    blockId: string,
    startCursor?: string
  ): Promise<{
    results: NotionBlock[]
    next_cursor: string | null
    has_more: boolean
  }> {
    return this.request('GET', `/blocks/${blockId}/children`, {
      params: {
        page_size: 100,
        start_cursor: startCursor,
      },
    })
  }

  /**
   * Get all blocks for a page (handles pagination).
   * Safety limit prevents runaway pagination on very large pages.
   */
  async getAllPageBlocks(blockId: string, maxPages = 50): Promise<NotionBlock[]> {
    const allBlocks: NotionBlock[] = []
    let cursor: string | undefined
    let page = 0

    do {
      const response = await this.getPageBlocks(blockId, cursor)
      allBlocks.push(...response.results)
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
      page++
      if (page >= maxPages) {
        console.warn(`[notion.client] getAllPageBlocks: hit pagination limit (${maxPages} pages) for block ${blockId}`)
        break
      }
    } while (cursor)

    return allBlocks
  }

  /**
   * Query a database for its pages.
   */
  async getDatabasePages(
    databaseId: string,
    startCursor?: string
  ): Promise<{
    results: NotionPage[]
    next_cursor: string | null
    has_more: boolean
  }> {
    const body: Record<string, unknown> = { page_size: 100 }
    if (startCursor) body.start_cursor = startCursor

    return this.request('POST', `/databases/${databaseId}/query`, { body })
  }

  /**
   * Get a database schema (properties/columns).
   */
  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    return this.request('GET', `/databases/${databaseId}`)
  }

  /**
   * Get all pages from a database (handles pagination).
   */
  async getAllDatabasePages(databaseId: string, maxPages = 20): Promise<NotionPage[]> {
    const allPages: NotionPage[] = []
    let cursor: string | undefined
    let page = 0

    do {
      const response = await this.getDatabasePages(databaseId, cursor)
      allPages.push(...response.results)
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
      page++
      if (page >= maxPages) {
        console.warn(`[notion.client] getAllDatabasePages: hit pagination limit (${maxPages} pages) for database ${databaseId}`)
        break
      }
    } while (cursor)

    return allPages
  }
}
