/**
 * Intercom API client wrapper.
 * Provides typed methods for common Intercom API operations.
 *
 * API Documentation: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/
 */

const INTERCOM_API_BASE = 'https://api.intercom.io'
const INTERCOM_API_VERSION = '2.11'

/**
 * Error thrown when Intercom API request fails
 */
export class IntercomApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message)
    this.name = 'IntercomApiError'
  }
}

/**
 * Error thrown when rate limit is hit
 */
export class IntercomRateLimitError extends IntercomApiError {
  constructor(
    public retryAfter: number = 60
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, 429)
    this.name = 'IntercomRateLimitError'
  }
}

/**
 * Workspace information from /me endpoint
 */
export interface IntercomWorkspace {
  type: 'app'
  id: string
  name: string
  region: string
}

/**
 * Contact (user/lead) information
 */
export interface IntercomContact {
  type: 'contact'
  id: string
  external_id?: string | null
  email?: string | null
  name?: string | null
  phone?: string | null
  role: 'user' | 'lead'
  avatar?: string | null
  owner_id?: number | null
  location?: {
    country?: string | null
    country_code?: string | null
    region?: string | null
    city?: string | null
  } | null
  companies?: {
    companies: Array<{
      id: string
      name?: string | null
      company_id?: string | null
    }>
  } | null
  tags?: {
    tags: Array<{
      id: string
      name: string
    }>
  } | null
  social_profiles?: {
    data: Array<{
      type: string
      name: string
      url: string
    }>
  } | null
  custom_attributes?: Record<string, unknown> | null
  created_at?: number | null
  last_seen_at?: number | null
  signed_up_at?: number | null
  browser?: string | null
  browser_language?: string | null
  os?: string | null
}

/**
 * Admin (team member) information
 */
export interface IntercomAdmin {
  type: 'admin'
  id: string
  name: string
  email: string
}

/**
 * Conversation author
 */
export interface IntercomAuthor {
  type: 'user' | 'admin' | 'bot' | 'team'
  id: string
  name?: string | null
  email?: string | null
}

/**
 * Conversation part (message)
 */
export interface IntercomConversationPart {
  type: 'conversation_part'
  id: string
  part_type: string
  body: string | null
  created_at: number
  updated_at: number
  author: IntercomAuthor
}

/**
 * Conversation source (first message)
 */
export interface IntercomConversationSource {
  type: string
  id: string
  body: string | null
  delivered_as: string
  author: IntercomAuthor
}

/**
 * Full conversation with parts
 */
export interface IntercomConversation {
  type: 'conversation'
  id: string
  title: string | null
  created_at: number
  updated_at: number
  state: 'open' | 'closed' | 'snoozed'
  read: boolean
  waiting_since: number | null
  snoozed_until: number | null
  source: IntercomConversationSource
  contacts: { contacts: IntercomContact[] }
  conversation_parts: {
    type: 'conversation_part.list'
    conversation_parts: IntercomConversationPart[]
    total_count: number
  }
}

/**
 * Conversation list item (without parts)
 */
export interface IntercomConversationListItem {
  type: 'conversation'
  id: string
  title: string | null
  created_at: number
  updated_at: number
  state: 'open' | 'closed' | 'snoozed'
  contacts: { contacts: IntercomContact[] }
  source: IntercomConversationSource
}

/**
 * Paginated list response
 */
export interface IntercomListResponse<T> {
  type: string
  data: T[]
  pages: {
    type: 'pages'
    page: number
    per_page: number
    total_pages: number
    next?: {
      starting_after: string
    }
  }
  total_count: number
}

/**
 * Intercom API client
 */
export class IntercomClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  /**
   * Make a request to the Intercom API
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>
      body?: Record<string, unknown>
    } = {}
  ): Promise<T> {
    const url = new URL(`${INTERCOM_API_BASE}${path}`)

    // Add query params
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Intercom-Version': INTERCOM_API_VERSION,
      Accept: 'application/json',
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    }

    if (options.body) {
      headers['Content-Type'] = 'application/json'
      fetchOptions.body = JSON.stringify(options.body)
    }

    const response = await fetch(url.toString(), fetchOptions)

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
      throw new IntercomRateLimitError(retryAfter)
    }

    // Parse response
    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.errors?.[0]?.message || data.message || 'Unknown Intercom API error'
      const errorCode = data.errors?.[0]?.code || data.type
      throw new IntercomApiError(errorMessage, response.status, errorCode)
    }

    return data as T
  }

  /**
   * Test the connection by fetching workspace info
   */
  async testConnection(): Promise<IntercomWorkspace> {
    return this.request<IntercomWorkspace>('GET', '/me')
  }

  /**
   * Get workspace info
   */
  async getWorkspace(): Promise<IntercomWorkspace> {
    return this.testConnection()
  }

  /**
   * List conversations with pagination
   */
  async listConversations(options: {
    perPage?: number
    startingAfter?: string
  } = {}): Promise<IntercomListResponse<IntercomConversationListItem>> {
    // Intercom API returns conversations under a `conversations` key, not `data`
    const response = await this.request<{
      type: string
      conversations: IntercomConversationListItem[]
      pages: IntercomListResponse<IntercomConversationListItem>['pages']
      total_count: number
    }>('GET', '/conversations', {
      params: {
        per_page: options.perPage || 20,
        starting_after: options.startingAfter,
      },
    })

    return {
      type: response.type,
      data: response.conversations ?? [],
      pages: response.pages,
      total_count: response.total_count,
    }
  }

  /**
   * Get a single conversation with all parts
   */
  async getConversation(conversationId: string): Promise<IntercomConversation> {
    return this.request<IntercomConversation>('GET', `/conversations/${conversationId}`, {
      params: {
        display_as: 'plaintext',
      },
    })
  }

  /**
   * Iterate through all conversations with optional date filtering.
   * This is an async generator that handles pagination automatically.
   */
  async *listAllConversations(options: {
    fromDate?: Date
    toDate?: Date
    onProgress?: (fetched: number, total: number) => void
  } = {}): AsyncGenerator<IntercomConversationListItem, void, unknown> {
    let cursor: string | undefined
    let fetched = 0
    let totalCount = 0
    let page = 0
    const maxPages = 100 // Safety limit

    while (page < maxPages) {
      const response = await this.listConversations({
        perPage: 20,
        startingAfter: cursor,
      })

      if (page === 0) {
        totalCount = response.total_count
      }

      for (const conversation of response.data) {
        // Apply date filtering (Intercom timestamps are Unix seconds)
        const createdAt = new Date(conversation.created_at * 1000)

        if (options.fromDate && createdAt < options.fromDate) {
          // Since results are ordered by most recent first,
          // if we hit a conversation older than fromDate, we can stop
          return
        }

        if (options.toDate && createdAt > options.toDate) {
          // Skip conversations newer than toDate
          continue
        }

        fetched++
        yield conversation

        if (options.onProgress) {
          options.onProgress(fetched, totalCount)
        }
      }

      // Check for next page
      if (!response.pages.next?.starting_after) {
        break
      }

      cursor = response.pages.next.starting_after
      page++
    }
  }

  /**
   * Get a contact by ID
   */
  async getContact(contactId: string): Promise<IntercomContact> {
    return this.request<IntercomContact>('GET', `/contacts/${contactId}`)
  }
}
