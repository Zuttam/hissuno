/**
 * PostHog API client wrapper.
 * Provides typed methods for common PostHog API operations.
 *
 * API Documentation: https://posthog.com/docs/api
 * Auth: Bearer token via Personal API Key
 */

/**
 * Error thrown when PostHog API request fails
 */
export class PosthogApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message)
    this.name = 'PosthogApiError'
  }
}

/**
 * Error thrown when rate limit is hit
 */
export class PosthogRateLimitError extends PosthogApiError {
  constructor(
    public retryAfter: number = 60
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, 429)
    this.name = 'PosthogRateLimitError'
  }
}

/**
 * PostHog person (user profile)
 */
export interface PosthogPerson {
  id: number
  uuid: string
  distinct_ids: string[]
  properties: Record<string, unknown>
  created_at: string
}

/**
 * PostHog event definition (schema entry)
 */
export interface PosthogEventDefinition {
  id: string
  name: string
  description?: string
  volume_30_day: number | null
  query_usage_30_day: number | null
}

/**
 * PostHog event
 */
export interface PosthogEvent {
  id: string
  event: string
  properties: Record<string, unknown>
  timestamp: string
  distinct_id: string
}

/**
 * PostHog cohort
 */
export interface PosthogCohort {
  id: number
  name: string
  count: number | null
  groups: unknown[]
}

/**
 * PostHog property definition
 */
export interface PosthogPropertyDefinition {
  id: string
  name: string
  property_type: string | null
  is_numerical: boolean
}

/**
 * PostHog API client
 */
export class PosthogClient {
  private apiKey: string
  private host: string
  private projectId: string

  constructor(apiKey: string, host: string = 'https://app.posthog.com', posthogProjectId: string) {
    this.apiKey = apiKey
    this.host = host.replace(/\/+$/, '')
    this.projectId = posthogProjectId
  }

  /**
   * Make a request to the PostHog API
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>
      body?: Record<string, unknown>
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.host}${path}`)

    // Add query params
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
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
      throw new PosthogRateLimitError(retryAfter)
    }

    // Parse response
    const text = await response.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(text)
    } catch {
      console.error(`[PosthogClient] Non-JSON response (${response.status}): ${text.slice(0, 500)}`)
      throw new PosthogApiError(`PostHog returned non-JSON response (${response.status})`, response.status)
    }

    if (!response.ok) {
      console.error(`[PosthogClient] Error response (${response.status}):`, JSON.stringify(data))
      const errorMessage =
        (data.detail as string) ||
        (data.error as string) ||
        (data.message as string) ||
        `PostHog API error (${response.status}): ${text.slice(0, 200)}`
      const errorCode = (data.type as string) || (data.attr as string)
      throw new PosthogApiError(errorMessage, response.status, errorCode)
    }

    return data as T
  }

  /**
   * Test the connection by fetching the project info
   */
  async testConnection(): Promise<{ projectId: string; projectName: string }> {
    const data = await this.request<{ id: number; name: string }>('GET', `/api/projects/${this.projectId}`)
    return {
      projectId: String(data.id),
      projectName: data.name,
    }
  }

  /**
   * Get event definitions for the project
   */
  async getEventDefinitions(): Promise<PosthogEventDefinition[]> {
    const data = await this.request<{ results: PosthogEventDefinition[] }>(
      'GET',
      `/api/projects/${this.projectId}/event_definitions`,
      { params: { limit: 200 } }
    )
    return data.results || []
  }

  /**
   * Get property definitions for the project
   */
  async getPropertyDefinitions(type?: 'person' | 'event'): Promise<PosthogPropertyDefinition[]> {
    const data = await this.request<{ results: PosthogPropertyDefinition[] }>(
      'GET',
      `/api/projects/${this.projectId}/property_definitions`,
      { params: { type, limit: 200 } }
    )
    return data.results || []
  }

  /**
   * Look up a person by email address
   */
  async getPersonByEmail(email: string): Promise<PosthogPerson | null> {
    const properties = JSON.stringify([
      { key: 'email', value: email, type: 'person', operator: 'exact' },
    ])

    const data = await this.request<{ results: PosthogPerson[] }>(
      'GET',
      `/api/projects/${this.projectId}/persons`,
      { params: { properties } }
    )

    return data.results?.[0] ?? null
  }

  /**
   * Get events for a specific person by distinct ID
   */
  async getPersonEvents(
    distinctId: string,
    options: {
      after?: string
      before?: string
      limit?: number
      eventNames?: string[]
    } = {}
  ): Promise<PosthogEvent[]> {
    const params: Record<string, string | number | boolean | undefined> = {
      person_id: distinctId,
      limit: options.limit ?? 100,
      after: options.after,
      before: options.before,
    }

    if (options.eventNames?.length) {
      params.event = options.eventNames.join(',')
    }

    const data = await this.request<{ results: PosthogEvent[] }>(
      'GET',
      `/api/projects/${this.projectId}/events`,
      { params }
    )

    return data.results || []
  }

  /**
   * List persons (paginated)
   */
  async listPersons(options: { limit?: number; offset?: number } = {}): Promise<{
    results: PosthogPerson[]
    next: string | null
  }> {
    const data = await this.request<{ results: PosthogPerson[]; next: string | null }>(
      'GET',
      `/api/projects/${this.projectId}/persons`,
      { params: { limit: options.limit ?? 100, offset: options.offset ?? 0 } }
    )
    return { results: data.results || [], next: data.next ?? null }
  }

  /**
   * Get all cohorts for the project
   */
  async getCohorts(): Promise<PosthogCohort[]> {
    const data = await this.request<{ results: PosthogCohort[] }>(
      'GET',
      `/api/projects/${this.projectId}/cohorts`
    )
    return data.results || []
  }
}
