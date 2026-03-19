import type { JiraTokens, JiraResource } from '@/types/jira'

const JIRA_AUTH_URL = 'https://auth.atlassian.com/authorize'
const JIRA_TOKEN_URL = 'https://auth.atlassian.com/oauth/token'
const JIRA_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources'

/**
 * Jira OAuth 2.0 (3LO) scopes
 * https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/
 */
export const JIRA_OAUTH_SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'offline_access',
]

/**
 * Generate the Jira OAuth 2.0 authorization URL
 */
export function getJiraOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(JIRA_AUTH_URL)
  url.searchParams.set('audience', 'api.atlassian.com')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('scope', JIRA_OAUTH_SCOPES.join(' '))
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('response_type', 'code')
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
}): Promise<JiraTokens> {
  const response = await fetch(JIRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[jira.oauth] Token exchange failed:', error)
    throw new Error(`Jira token exchange failed: ${response.status}`)
  }

  return response.json() as Promise<JiraTokens>
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(params: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<JiraTokens> {
  const response = await fetch(JIRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[jira.oauth] Token refresh failed:', error)
    throw new Error(`Jira token refresh failed: ${response.status}`)
  }

  return response.json() as Promise<JiraTokens>
}

/**
 * Get accessible Jira resources (sites) for the authenticated user
 */
export async function getAccessibleResources(
  accessToken: string
): Promise<JiraResource[]> {
  const response = await fetch(JIRA_RESOURCES_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[jira.oauth] Get accessible resources failed:', error)
    throw new Error(`Failed to get Jira resources: ${response.status}`)
  }

  return response.json() as Promise<JiraResource[]>
}
