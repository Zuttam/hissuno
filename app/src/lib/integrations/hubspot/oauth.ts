/**
 * HubSpot OAuth helpers.
 * Handles OAuth authorization URL generation, code exchange, and token refresh.
 * HubSpot uses rotating refresh tokens - both access and refresh tokens change on each refresh.
 */

const HUBSPOT_OAUTH_BASE = 'https://app.hubspot.com/oauth/authorize'
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'

/**
 * Build the HubSpot OAuth authorization URL.
 */
export function getHubSpotOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scopes?: string[]
}): string {
  const url = new URL(HUBSPOT_OAUTH_BASE)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set(
    'scope',
    (params.scopes ?? ['crm.objects.contacts.read', 'crm.objects.companies.read']).join(' ')
  )
  return url.toString()
}

/**
 * Exchange an OAuth authorization code for tokens.
 * Returns access token, refresh token, and expiry.
 */
export async function exchangeHubSpotOAuthCode(params: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      code: params.code,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const message = errorData.message || errorData.error || 'Token exchange failed'
    throw new Error(`HubSpot OAuth token exchange failed: ${message}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Refresh an OAuth access token.
 * HubSpot rotates BOTH tokens on refresh - the old refresh token becomes invalid.
 */
export async function refreshHubSpotToken(params: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const message = errorData.message || errorData.error || 'Token refresh failed'
    throw new Error(`HubSpot token refresh failed: ${message}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}
