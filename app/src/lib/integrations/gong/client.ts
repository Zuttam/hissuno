/**
 * Gong API client wrapper.
 * Provides typed methods for common Gong API operations.
 *
 * API Documentation: https://gong.app.gong.io/settings/api/documentation
 * Base URL: https://api.gong.io/v2/
 * Auth: Basic Auth (access_key:access_key_secret)
 */

const GONG_API_BASE = 'https://api.gong.io/v2'

/**
 * Error thrown when Gong API request fails
 */
export class GongApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message)
    this.name = 'GongApiError'
  }
}

/**
 * Error thrown when rate limit is hit
 */
export class GongRateLimitError extends GongApiError {
  constructor(
    public retryAfter: number = 60
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, 429)
    this.name = 'GongRateLimitError'
  }
}

/**
 * Gong call participant
 */
export interface GongParticipant {
  id: string
  emailAddress?: string
  name?: string
  title?: string
  userId?: string
  speakerId?: string
  affiliation?: 'internal' | 'external' | 'unknown'
}

/**
 * Gong call metadata
 */
export interface GongCall {
  id: string
  title?: string
  url?: string
  started: string // ISO datetime
  duration: number // seconds
  direction?: 'Inbound' | 'Outbound' | 'Conference' | 'Unknown'
  scope?: string
  parties: GongParticipant[]
}

/**
 * Gong call list item (from list calls endpoint)
 */
export interface GongCallListItem {
  id: string
  title?: string
  url?: string
  started: string
  duration: number
  direction?: string
  scope?: string
  parties: GongParticipant[]
}

/**
 * Gong transcript entry
 */
export interface GongTranscriptEntry {
  speakerId: string
  topic?: string
  sentences: Array<{
    start: number
    end: number
    text: string
  }>
}

/**
 * Gong call transcript
 */
export interface GongCallTranscript {
  callId: string
  transcript: GongTranscriptEntry[]
}

/**
 * Gong API client
 */
export class GongClient {
  private accessKey: string
  private accessKeySecret: string

  constructor(accessKey: string, accessKeySecret: string) {
    this.accessKey = accessKey
    this.accessKeySecret = accessKeySecret
  }

  /**
   * Build the Basic Auth header
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.accessKey}:${this.accessKeySecret}`).toString('base64')
    return `Basic ${credentials}`
  }

  /**
   * Make a request to the Gong API
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>
      body?: Record<string, unknown>
    } = {}
  ): Promise<T> {
    const url = new URL(`${GONG_API_BASE}${path}`)

    // Add query params
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
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
      throw new GongRateLimitError(retryAfter)
    }

    // Parse response
    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.errors?.[0]?.message || data.message || 'Unknown Gong API error'
      const errorCode = data.errors?.[0]?.code || data.type
      throw new GongApiError(errorMessage, response.status, errorCode)
    }

    return data as T
  }

  /**
   * Test the connection by listing calls with a minimal request
   */
  async testConnection(): Promise<{ success: boolean }> {
    // Use list calls with a tiny window to verify credentials work
    await this.request<{ calls: GongCallListItem[] }>('POST', '/calls', {
      body: {
        filter: {
          fromDateTime: new Date(Date.now() - 60000).toISOString(),
          toDateTime: new Date().toISOString(),
        },
        cursor: undefined,
      },
    })
    return { success: true }
  }

  /**
   * List calls with date range filter
   */
  async listCalls(options: {
    fromDateTime?: string
    toDateTime?: string
    cursor?: string
  } = {}): Promise<{
    calls: GongCallListItem[]
    records: { totalRecords: number; currentPageSize: number; currentPageNumber: number }
    cursor?: string
  }> {
    // Gong uses POST for listing calls with filters
    const body: Record<string, unknown> = {
      filter: {},
    }

    const filter: Record<string, string> = {}
    if (options.fromDateTime) filter.fromDateTime = options.fromDateTime
    if (options.toDateTime) filter.toDateTime = options.toDateTime
    body.filter = filter

    if (options.cursor) {
      body.cursor = options.cursor
    }

    return this.request<{
      calls: GongCallListItem[]
      records: { totalRecords: number; currentPageSize: number; currentPageNumber: number }
      cursor?: string
    }>('POST', '/calls', { body })
  }

  /**
   * Get detailed call info with participants
   */
  async getCallDetails(callId: string): Promise<GongCall> {
    const response = await this.request<{ calls: GongCall[] }>('POST', '/calls/extensive', {
      body: {
        filter: {
          callIds: [callId],
        },
      },
    })

    if (!response.calls || response.calls.length === 0) {
      throw new GongApiError(`Call ${callId} not found`, 404)
    }

    return response.calls[0]
  }

  /**
   * Get transcripts for a set of call IDs
   */
  async getTranscripts(callIds: string[]): Promise<GongCallTranscript[]> {
    const response = await this.request<{ callTranscripts: GongCallTranscript[] }>(
      'POST',
      '/calls/transcript',
      {
        body: {
          filter: {
            callIds,
          },
        },
      }
    )

    return response.callTranscripts || []
  }

  /**
   * Iterate through all calls with optional date filtering.
   * Async generator that handles pagination automatically.
   */
  async *listAllCalls(options: {
    fromDate?: Date
    toDate?: Date
    onProgress?: (fetched: number, total: number) => void
  } = {}): AsyncGenerator<GongCallListItem, void, unknown> {
    let cursor: string | undefined
    let fetched = 0
    let totalCount = 0
    let page = 0
    const maxPages = 100 // Safety limit

    while (page < maxPages) {
      const response = await this.listCalls({
        fromDateTime: options.fromDate?.toISOString(),
        toDateTime: options.toDate?.toISOString(),
        cursor,
      })

      if (page === 0) {
        totalCount = response.records.totalRecords
      }

      for (const call of response.calls) {
        fetched++
        yield call

        if (options.onProgress) {
          options.onProgress(fetched, totalCount)
        }
      }

      // Check for next page
      if (!response.cursor) {
        break
      }

      cursor = response.cursor
      page++
    }
  }
}
