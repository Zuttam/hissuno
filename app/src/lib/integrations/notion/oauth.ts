/**
 * Notion OAuth helpers.
 * Follows the same pattern as Intercom/Slack OAuth utilities.
 */

const NOTION_OAUTH_URL = 'https://api.notion.com/v1/oauth/authorize'
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token'

/**
 * Build the Notion OAuth authorization URL.
 */
export function getNotionOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(NOTION_OAUTH_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('owner', 'user')
  url.searchParams.set('state', params.state)
  return url.toString()
}

/**
 * Exchange an OAuth authorization code for an access token.
 * Notion uses Basic auth with client_id:client_secret for token exchange.
 */
export async function exchangeNotionOAuthCode(params: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<{
  access_token: string
  workspace_id: string
  workspace_name: string | null
  workspace_icon: string | null
  bot_id: string
}> {
  const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')

  const response = await fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const message = errorData.error || errorData.message || 'Token exchange failed'
    throw new Error(`Notion OAuth token exchange failed: ${message}`)
  }

  const data = await response.json()
  return {
    access_token: data.access_token,
    workspace_id: data.workspace_id,
    workspace_name: data.workspace_name ?? null,
    workspace_icon: data.workspace_icon ?? null,
    bot_id: data.bot_id,
  }
}
