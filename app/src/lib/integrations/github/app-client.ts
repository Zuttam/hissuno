/**
 * GitHub App API client
 * Handles GitHub API calls using installation access tokens
 */

const GITHUB_API_BASE = 'https://api.github.com'
const MAX_PAGES = 10 // Cap at 1000 repos to prevent excessive API calls

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
 * List repositories accessible by the installation
 * Uses the installation access token (already scoped to permitted repos)
 */
export async function listInstallationRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = []
  let page = 1

  while (page <= MAX_PAGES) {
    const response = await fetch(
      `${GITHUB_API_BASE}/installation/repositories?per_page=100&page=${page}`,
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
      console.error('[github.listInstallationRepos] Error:', response.status, errorText)
      throw new Error(`Failed to list repos: ${response.status}`)
    }

    const data = (await response.json()) as {
      total_count: number
      repositories: GitHubRepo[]
    }

    repos.push(...data.repositories)

    if (data.repositories.length < 100) break
    page++
  }

  return repos
}

/**
 * List repositories accessible by a Personal Access Token
 * Uses the authenticated user's repos endpoint
 */
export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = []
  let page = 1

  while (page <= MAX_PAGES) {
    const response = await fetch(
      `${GITHUB_API_BASE}/user/repos?per_page=100&sort=updated&type=all&page=${page}`,
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

    const data: GitHubRepo[] = await response.json()
    repos.push(...data)

    if (data.length < 100) break
    page++
  }

  return repos
}
