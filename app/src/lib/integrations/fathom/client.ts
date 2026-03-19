/**
 * Fathom API client wrapper.
 * Provides typed methods for common Fathom API operations.
 *
 * API Documentation: https://api.fathom.ai/external/v1
 * Auth: API key via X-Api-Key header
 */

/**
 * Error thrown when Fathom API request fails
 */
export class FathomApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message)
    this.name = 'FathomApiError'
  }
}

/**
 * Error thrown when rate limit is hit
 */
export class FathomRateLimitError extends FathomApiError {
  constructor(
    public retryAfter: number = 60
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, 429)
    this.name = 'FathomRateLimitError'
  }
}

/**
 * Fathom meeting invitee
 */
export interface FathomInvitee {
  name?: string
  email?: string
  is_external?: boolean
}

/**
 * Fathom transcript entry
 */
export interface FathomTranscriptEntry {
  speaker_name?: string
  speaker_email?: string
  start_time?: number
  end_time?: number
  text: string
}

/**
 * Fathom summary
 */
export interface FathomSummary {
  markdown?: string
  action_items?: Array<{ text: string; assignee?: string }>
}

/**
 * Fathom meeting metadata
 */
export interface FathomMeeting {
  id: string
  title?: string
  url?: string
  share_url?: string
  created_at: string
  scheduled_start_time?: string
  scheduled_end_time?: string
  recording_start_time?: string
  recording_end_time?: string
  meeting_type?: 'internal' | 'external'
  transcript_language?: string
  calendar_invitees?: FathomInvitee[]
  recorded_by?: string
  transcript?: FathomTranscriptEntry[]
  default_summary?: string
  action_items?: Array<{ text: string; assignee?: string }>
  crm_matches?: unknown[]
}

/**
 * Fathom API client
 */
export class FathomClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.baseUrl = 'https://api.fathom.ai/external/v1'
  }

  /**
   * Make a request to the Fathom API
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>
      body?: Record<string, unknown>
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)

    // Add query params
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      'X-Api-Key': this.apiKey,
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
      const retryAfter = parseInt(response.headers.get('RateLimit-Reset') || response.headers.get('Retry-After') || '60', 10)
      throw new FathomRateLimitError(retryAfter)
    }

    // Parse response
    const text = await response.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(text)
    } catch {
      console.error(`[FathomClient] Non-JSON response (${response.status}): ${text.slice(0, 500)}`)
      throw new FathomApiError(`Fathom returned non-JSON response (${response.status})`, response.status)
    }

    if (!response.ok) {
      console.error(`[FathomClient] Error response (${response.status}):`, JSON.stringify(data))
      const errorMessage = (data.message as string) || (data.error as string) || `Fathom API error (${response.status}): ${text.slice(0, 200)}`
      const errorCode = data.code as string | undefined
      throw new FathomApiError(errorMessage, response.status, errorCode)
    }

    return data as T
  }

  /**
   * Test the connection by listing meetings with a minimal request
   */
  async testConnection(): Promise<{ success: boolean }> {
    await this.request<{ items: unknown[] }>('GET', '/meetings', {
      params: { limit: 1 },
    })
    return { success: true }
  }

  /**
   * List meetings with optional filters
   */
  async listMeetings(options: {
    createdAfter?: string
    createdBefore?: string
    includeTranscript?: boolean
    includeSummary?: boolean
    cursor?: string
    limit?: number
  } = {}): Promise<{
    items: FathomMeeting[]
    next_cursor?: string
    limit: number
  }> {
    return this.request<{
      items: FathomMeeting[]
      next_cursor?: string
      limit: number
    }>('GET', '/meetings', {
      params: {
        created_after: options.createdAfter,
        created_before: options.createdBefore,
        include_transcript: options.includeTranscript,
        include_summary: options.includeSummary,
        cursor: options.cursor,
        limit: options.limit,
      },
    })
  }

  /**
   * Get transcript for a recording
   */
  async getMeetingTranscript(recordingId: string): Promise<FathomTranscriptEntry[]> {
    const response = await this.request<{ entries: FathomTranscriptEntry[] } | FathomTranscriptEntry[]>(
      'GET',
      `/recordings/${recordingId}/transcript`
    )
    // Handle both possible response shapes
    if (Array.isArray(response)) {
      return response
    }
    return (response as { entries: FathomTranscriptEntry[] }).entries || []
  }

  /**
   * Get summary for a recording
   */
  async getMeetingSummary(recordingId: string): Promise<FathomSummary> {
    return this.request<FathomSummary>('GET', `/recordings/${recordingId}/summary`)
  }

  /**
   * Iterate through all meetings with optional date filtering.
   * Async generator that handles cursor pagination automatically.
   */
  async *listAllMeetings(options: {
    createdAfter?: string
    createdBefore?: string
    includeTranscript?: boolean
    includeSummary?: boolean
    onProgress?: (fetched: number) => void
  } = {}): AsyncGenerator<FathomMeeting, void, unknown> {
    let cursor: string | undefined
    let fetched = 0
    let page = 0
    const maxPages = 200 // Safety limit

    while (page < maxPages) {
      const response = await this.listMeetings({
        createdAfter: options.createdAfter,
        createdBefore: options.createdBefore,
        includeTranscript: options.includeTranscript,
        includeSummary: options.includeSummary,
        cursor,
      })

      for (const meeting of response.items) {
        fetched++
        yield meeting

        if (options.onProgress) {
          options.onProgress(fetched)
        }
      }

      // Check for next page
      if (!response.next_cursor) {
        break
      }

      cursor = response.next_cursor
      page++
    }
  }
}
