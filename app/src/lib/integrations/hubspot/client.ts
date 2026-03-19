/**
 * HubSpot CRM API client.
 * Provides typed methods for fetching companies and contacts from HubSpot.
 *
 * API Documentation: https://developers.hubspot.com/docs/api/crm
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

/**
 * Error thrown when HubSpot API request fails
 */
export class HubSpotApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message)
    this.name = 'HubSpotApiError'
  }
}

/**
 * Error thrown when rate limit is hit
 */
export class HubSpotRateLimitError extends HubSpotApiError {
  constructor(
    public retryAfter: number = 10
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, 429)
    this.name = 'HubSpotRateLimitError'
  }
}

/**
 * Response from PAK token exchange endpoint
 */
interface PakTokenResponse {
  hubId: number
  hubName?: string
  oauthAccessToken: string
  expiresAtMillis: number
  scopeGroups: string[]
  accountType?: string
}

/**
 * Account info from /account-info/v3/details or PAK exchange
 */
export interface HubSpotAccountInfo {
  portalId: number
  accountType: string
  timeZone: string
  companyCurrency: string
  uiDomain: string
}

/**
 * HubSpot company record
 */
export interface HubSpotCompany {
  id: string
  properties: {
    name?: string | null
    domain?: string | null
    industry?: string | null
    country?: string | null
    numberofemployees?: string | null
    annualrevenue?: string | null
    hs_object_id?: string | null
    notes_last_updated?: string | null
    description?: string | null
    phone?: string | null
    website?: string | null
    [key: string]: string | null | undefined
  }
  createdAt: string
  updatedAt: string
}

/**
 * HubSpot contact record
 */
export interface HubSpotContact {
  id: string
  properties: {
    firstname?: string | null
    lastname?: string | null
    email?: string | null
    phone?: string | null
    jobtitle?: string | null
    company?: string | null
    hs_object_id?: string | null
    notes_last_updated?: string | null
    lifecyclestage?: string | null
    [key: string]: string | null | undefined
  }
  createdAt: string
  updatedAt: string
}

/**
 * Paginated search response
 */
interface HubSpotSearchResponse<T> {
  total: number
  results: T[]
  paging?: {
    next?: {
      after: string
    }
  }
}

/**
 * Company properties to fetch
 */
const COMPANY_PROPERTIES = [
  'name',
  'domain',
  'industry',
  'country',
  'numberofemployees',
  'annualrevenue',
  'hs_object_id',
  'notes_last_updated',
  'description',
  'phone',
  'website',
]

/**
 * Contact properties to fetch
 */
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'phone',
  'jobtitle',
  'company',
  'hs_object_id',
  'notes_last_updated',
  'lifecyclestage',
]

/**
 * Exchange a HubSpot Personal Access Key for a short-lived OAuth access token
 * via POST /localdevauth/v1/auth/refresh.
 * Returns the access token and account metadata.
 */
export async function exchangePersonalAccessKey(
  personalAccessKey: string
): Promise<PakTokenResponse> {
  const url = `${HUBSPOT_API_BASE}/localdevauth/v1/auth/refresh`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encodedOAuthRefreshToken: personalAccessKey }),
  })

  const data = await response.json()

  if (!response.ok) {
    const message = data.message || 'Failed to exchange personal access key'
    throw new HubSpotApiError(message, response.status, data.category)
  }

  return data as PakTokenResponse
}

/**
 * HubSpot CRM API client
 */
export class HubSpotClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  /**
   * Create a client from a Personal Access Key by exchanging it for an access token.
   * Returns the client and account info.
   */
  static async fromPersonalAccessKey(
    pak: string
  ): Promise<{ client: HubSpotClient; accountInfo: HubSpotAccountInfo }> {
    const tokenResponse = await exchangePersonalAccessKey(pak)
    const client = new HubSpotClient(tokenResponse.oauthAccessToken)
    return {
      client,
      accountInfo: {
        portalId: tokenResponse.hubId,
        accountType: tokenResponse.accountType || 'unknown',
        timeZone: '',
        companyCurrency: '',
        uiDomain: tokenResponse.hubName || '',
      },
    }
  }

  /**
   * Make a request to the HubSpot API
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>
      body?: Record<string, unknown>
      signal?: AbortSignal
    } = {}
  ): Promise<T> {
    const url = new URL(`${HUBSPOT_API_BASE}${path}`)

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: options.signal,
    }

    if (options.body) {
      headers['Content-Type'] = 'application/json'
      fetchOptions.body = JSON.stringify(options.body)
    }

    const response = await fetch(url.toString(), fetchOptions)

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '10', 10)
      throw new HubSpotRateLimitError(retryAfter)
    }

    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.message || 'Unknown HubSpot API error'
      const errorCode = data.category || data.status
      throw new HubSpotApiError(errorMessage, response.status, errorCode)
    }

    return data as T
  }

  /**
   * Test connection by fetching account info
   */
  async testConnection(): Promise<HubSpotAccountInfo> {
    return this.request<HubSpotAccountInfo>('GET', '/account-info/v3/details')
  }

  /**
   * Get account info (hub name comes from uiDomain)
   */
  async getAccountInfo(): Promise<HubSpotAccountInfo> {
    return this.testConnection()
  }

  /**
   * Iterate through all companies using search API with pagination.
   * Supports optional date filtering for incremental syncs.
   */
  async *searchCompanies(options: {
    fromDate?: Date
    signal?: AbortSignal
    onProgress?: (fetched: number, total: number) => void
  } = {}): AsyncGenerator<HubSpotCompany, void, unknown> {
    let after: string | undefined
    let fetched = 0
    let totalCount = 0
    let page = 0
    const maxPages = 500

    while (page < maxPages) {
      if (options.signal?.aborted) break

      const body: Record<string, unknown> = {
        properties: COMPANY_PROPERTIES,
        limit: 100,
        sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
      }

      if (after) {
        body.after = after
      }

      // Apply date filter for incremental sync
      if (options.fromDate) {
        body.filterGroups = [
          {
            filters: [
              {
                propertyName: 'hs_lastmodifieddate',
                operator: 'GTE',
                value: options.fromDate.getTime().toString(),
              },
            ],
          },
        ]
      }

      const response = await this.request<HubSpotSearchResponse<HubSpotCompany>>(
        'POST',
        '/crm/v3/objects/companies/search',
        { body, signal: options.signal }
      )

      if (page === 0) {
        totalCount = response.total
      }

      for (const company of response.results) {
        fetched++
        yield company

        if (options.onProgress) {
          options.onProgress(fetched, totalCount)
        }
      }

      if (!response.paging?.next?.after) {
        break
      }

      after = response.paging.next.after
      page++
    }
  }

  /**
   * Iterate through all contacts using search API with pagination.
   * Supports optional date filtering for incremental syncs.
   */
  async *searchContacts(options: {
    fromDate?: Date
    signal?: AbortSignal
    onProgress?: (fetched: number, total: number) => void
  } = {}): AsyncGenerator<HubSpotContact, void, unknown> {
    let after: string | undefined
    let fetched = 0
    let totalCount = 0
    let page = 0
    const maxPages = 500

    while (page < maxPages) {
      if (options.signal?.aborted) break

      const body: Record<string, unknown> = {
        properties: CONTACT_PROPERTIES,
        limit: 100,
        sorts: [{ propertyName: 'lastmodifieddate', direction: 'DESCENDING' }],
      }

      if (after) {
        body.after = after
      }

      if (options.fromDate) {
        body.filterGroups = [
          {
            filters: [
              {
                propertyName: 'lastmodifieddate',
                operator: 'GTE',
                value: options.fromDate.getTime().toString(),
              },
            ],
          },
        ]
      }

      const response = await this.request<HubSpotSearchResponse<HubSpotContact>>(
        'POST',
        '/crm/v3/objects/contacts/search',
        { body, signal: options.signal }
      )

      if (page === 0) {
        totalCount = response.total
      }

      for (const contact of response.results) {
        fetched++
        yield contact

        if (options.onProgress) {
          options.onProgress(fetched, totalCount)
        }
      }

      if (!response.paging?.next?.after) {
        break
      }

      after = response.paging.next.after
      page++
    }
  }
}
