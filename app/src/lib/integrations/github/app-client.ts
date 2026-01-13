/**
 * GitHub OAuth client for project-level integration
 *
 * Flow:
 * 1. Redirect user to GitHub OAuth authorization
 * 2. Exchange authorization code for access token
 * 3. Use access token for API calls
 */

const GITHUB_API_BASE = 'https://api.github.com'

export type GitHubOAuthTokenResponse = {
  access_token: string
  token_type: string
  scope: string
  error?: string
  error_description?: string
}

export type GitHubUser = {
  id: number
  login: string
  email: string | null
  name: string | null
  avatar_url: string
}

export type GitHubRepo = {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    id: number
    type: string
  }
  private: boolean
  default_branch: string
  html_url: string
  description: string | null
  updated_at: string
}

/**
 * Build GitHub OAuth authorization URL
 */
export function getGitHubOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scopes?: string[]
}): string {
  const { clientId, redirectUri, state, scopes = ['repo', 'read:user', 'user:email'] } = params

  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', scopes.join(' '))

  return url.toString()
}

/**
 * Exchange OAuth authorization code for access token
 */
export async function exchangeGitHubOAuthCode(params: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<GitHubOAuthTokenResponse> {
  const { code, clientId, clientSecret, redirectUri } = params

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[github.exchangeOAuthCode] Error:', response.status, errorText)
    throw new Error(`Failed to exchange code: ${response.status}`)
  }

  return response.json()
}

/**
 * Get authenticated user info
 */
export async function getGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[github.getUser] Error:', response.status, errorText)
    throw new Error(`Failed to get user: ${response.status}`)
  }

  return response.json()
}

/**
 * List repositories accessible by the authenticated user
 */
export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = []
  let page = 1

  while (true) {
    const response = await fetch(
      `${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[github.listUserRepos] Error:', response.status, errorText)
      throw new Error(`Failed to list repos: ${response.status}`)
    }

    const data = await response.json()
    repos.push(...data)

    if (data.length < 100) break
    page++
  }

  return repos
}
