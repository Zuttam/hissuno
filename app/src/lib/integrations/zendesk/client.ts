/**
 * Zendesk API client wrapper.
 * Provides typed methods for common Zendesk API operations.
 *
 * API Documentation: https://developer.zendesk.com/api-reference/
 */

/**
 * Error thrown when Zendesk API request fails
 */
export class ZendeskApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message)
    this.name = 'ZendeskApiError'
  }
}

/**
 * Error thrown when rate limit is hit
 */
export class ZendeskRateLimitError extends ZendeskApiError {
  constructor(
    public retryAfter: number = 60
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, 429)
    this.name = 'ZendeskRateLimitError'
  }
}

/**
 * Zendesk user (requester, agent, etc.)
 */
export interface ZendeskUser {
  id: number
  name: string
  email: string
  phone?: string | null
  role: 'end-user' | 'agent' | 'admin'
  organization_id?: number | null
  time_zone?: string | null
  locale?: string | null
  tags?: string[]
  custom_fields?: Array<{ id: number; value: unknown }>
}

/**
 * Zendesk organization
 */
export interface ZendeskOrganization {
  id: number
  name: string
  domain_names?: string[]
  details?: string | null
  notes?: string | null
  tags?: string[]
}

/**
 * Zendesk ticket
 */
export interface ZendeskTicket {
  id: number
  subject: string | null
  description: string | null
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed'
  priority: 'urgent' | 'high' | 'normal' | 'low' | null
  requester_id: number
  assignee_id?: number | null
  organization_id?: number | null
  group_id?: number | null
  tags: string[]
  created_at: string
  updated_at: string
  custom_fields?: Array<{ id: number; value: unknown }>
}

/**
 * Zendesk ticket comment
 */
export interface ZendeskComment {
  id: number
  type: 'Comment' | 'VoiceComment'
  body: string
  html_body: string
  plain_body: string
  public: boolean
  author_id: number
  created_at: string
  attachments?: Array<{
    id: number
    file_name: string
    content_url: string
    content_type: string
    size: number
  }>
}

/**
 * Zendesk cursor-paginated response
 */
export interface ZendeskPaginatedResponse<T> {
  [key: string]: unknown
  meta: {
    has_more: boolean
    after_cursor?: string
    before_cursor?: string
  }
  links: {
    prev?: string
    next?: string
  }
  data?: T[]
}

/**
 * Account info from /users/me
 */
export interface ZendeskCurrentUser {
  user: ZendeskUser & {
    url: string
  }
}

/**
 * Zendesk API client
 */
export class ZendeskClient {
  private baseUrl: string
  private authHeader: string

  constructor(
    private subdomain: string,
    private email: string,
    private apiToken: string
  ) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(subdomain)) {
      throw new Error('Invalid Zendesk subdomain format.')
    }
    this.baseUrl = `https://${subdomain}.zendesk.com/api/v2`
    this.authHeader = `Basic ${Buffer.from(`${email}/token:${apiToken}`).toString('base64')}`
  }

  /**
   * Make a request to the Zendesk API
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }

    const response = await fetch(url.toString(), { method, headers })

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
      throw new ZendeskRateLimitError(retryAfter)
    }

    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.error?.message || data.error?.title || data.description || 'Unknown Zendesk API error'
      throw new ZendeskApiError(errorMessage, response.status)
    }

    return data as T
  }

  /**
   * Test the connection by fetching current user info
   */
  async testConnection(): Promise<{ userId: number; name: string; email: string }> {
    const data = await this.request<ZendeskCurrentUser>('GET', '/users/me')
    return {
      userId: data.user.id,
      name: data.user.name,
      email: data.user.email,
    }
  }

  /**
   * Iterate through solved/closed tickets with optional date filtering.
   * Uses the Zendesk Search API which returns offset-based pagination via next_page URLs.
   */
  async *listTickets(options: {
    fromDate?: Date
    toDate?: Date
    onProgress?: (fetched: number) => void
  } = {}): AsyncGenerator<ZendeskTicket, void, unknown> {
    let fetched = 0
    const pageSize = 100

    // Build search query for solved/closed tickets with date filters
    let query = 'type:ticket status:solved status:closed'
    if (options.fromDate) {
      query += ` created>${options.fromDate.toISOString().split('T')[0]}`
    }
    if (options.toDate) {
      query += ` created<${options.toDate.toISOString().split('T')[0]}`
    }

    // First request via the typed client helper
    let data = await this.request<{
      results: ZendeskTicket[]
      next_page: string | null
      count: number
    }>('GET', '/search', {
      params: { query, per_page: pageSize, sort_by: 'created_at', sort_order: 'desc' },
    })

    const maxPages = 500
    for (let page = 0; page < maxPages; page++) {
      const tickets = data.results ?? []

      for (const ticket of tickets) {
        fetched++
        yield ticket
        options.onProgress?.(fetched)
      }

      if (!data.next_page) break

      // Fetch next page using the full next_page URL provided by Zendesk
      const response = await fetch(data.next_page, {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
      })

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
        throw new ZendeskRateLimitError(retryAfter)
      }

      if (!response.ok) break

      data = await response.json()
    }
  }

  /**
   * Get all comments for a ticket
   */
  async getTicketComments(ticketId: number): Promise<ZendeskComment[]> {
    const allComments: ZendeskComment[] = []
    let nextPage: string | undefined

    // Paginate through all comments
    for (let page = 0; page < 50; page++) {
      let data: { comments: ZendeskComment[]; next_page: string | null }

      if (nextPage) {
        // Use full URL for next page
        const response = await fetch(nextPage, {
          headers: {
            Authorization: this.authHeader,
            Accept: 'application/json',
          },
        })

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
          throw new ZendeskRateLimitError(retryAfter)
        }

        if (!response.ok) {
          const err = await response.json()
          throw new ZendeskApiError(err.error?.message || 'Failed to fetch comments', response.status)
        }

        data = await response.json()
      } else {
        data = await this.request<{ comments: ZendeskComment[]; next_page: string | null }>(
          'GET',
          `/tickets/${ticketId}/comments`,
          { params: { 'page[size]': 100 } }
        )
      }

      allComments.push(...(data.comments ?? []))

      if (!data.next_page) break
      nextPage = data.next_page
    }

    return allComments
  }

  /**
   * Get a user by ID
   */
  async getUser(userId: number): Promise<ZendeskUser> {
    const data = await this.request<{ user: ZendeskUser }>('GET', `/users/${userId}`)
    return data.user
  }

  /**
   * Get an organization by ID
   */
  async getOrganization(orgId: number): Promise<ZendeskOrganization> {
    const data = await this.request<{ organization: ZendeskOrganization }>('GET', `/organizations/${orgId}`)
    return data.organization
  }
}
