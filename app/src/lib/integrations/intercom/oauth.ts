/**
 * Intercom OAuth helpers.
 * Follows the same pattern as Slack/Jira OAuth utilities.
 */

const INTERCOM_OAUTH_BASE = 'https://app.intercom.com/oauth'
const INTERCOM_TOKEN_URL = 'https://api.intercom.io/auth/eagle/token'

/**
 * Build the Intercom OAuth authorization URL.
 * Note: Intercom scopes are configured in the Developer Hub, not in the URL.
 */
export function getIntercomOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(INTERCOM_OAUTH_BASE)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  return url.toString()
}

/**
 * Exchange an OAuth authorization code for an access token.
 * Intercom does not use refresh tokens.
 */
export async function exchangeIntercomOAuthCode(params: {
  code: string
  clientId: string
  clientSecret: string
}): Promise<{ token: string }> {
  const response = await fetch(INTERCOM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const message = errorData.message || errorData.error || 'Token exchange failed'
    throw new Error(`Intercom OAuth token exchange failed: ${message}`)
  }

  const data = await response.json()
  return { token: data.token }
}
