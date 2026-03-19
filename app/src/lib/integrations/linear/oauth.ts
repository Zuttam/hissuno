import type { LinearTokens } from '@/types/linear'

const LINEAR_AUTH_URL = 'https://linear.app/oauth/authorize'
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token'

/**
 * Linear OAuth scopes
 * https://developers.linear.app/docs/oauth/authentication
 */
export const LINEAR_OAUTH_SCOPES = [
  'read',
  'write',
  'issues:create',
  'comments:create',
]

/**
 * Generate the Linear OAuth authorization URL
 */
export function getLinearOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(LINEAR_AUTH_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', LINEAR_OAUTH_SCOPES.join(','))
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

/**
 * Exchange an authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(params: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<LinearTokens> {
  const response = await fetch(LINEAR_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }).toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[linear.oauth] Token exchange failed:', error)
    throw new Error(`Linear token exchange failed: ${response.status}`)
  }

  return response.json() as Promise<LinearTokens>
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(params: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<LinearTokens> {
  const response = await fetch(LINEAR_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
    }).toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[linear.oauth] Token refresh failed:', error)
    throw new Error(`Linear token refresh failed: ${response.status}`)
  }

  return response.json() as Promise<LinearTokens>
}
