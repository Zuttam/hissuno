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

// ---------------------------------------------------------------------------
// Issue & Comment types
// ---------------------------------------------------------------------------

export type GitHubIssue = {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  user: { login: string; id: number } | null
  labels: Array<{ id: number; name: string }>
  created_at: string
  updated_at: string
  closed_at: string | null
  html_url: string
  pull_request?: unknown // present if this is a PR
  comments: number
}

export type GitHubComment = {
  id: number
  body: string
  user: { login: string; id: number } | null
  created_at: string
  updated_at: string
  html_url: string
}

// ---------------------------------------------------------------------------
// Issue fetching
// ---------------------------------------------------------------------------

const MAX_ISSUE_PAGES = 10

/**
 * List issues for a repository (excludes pull requests).
 * Supports label filtering and incremental sync via `since`.
 */
export async function listRepoIssues(
  token: string,
  owner: string,
  repo: string,
  opts?: { labels?: string; since?: string; state?: 'open' | 'closed' | 'all' }
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = []
  let page = 1
  const state = opts?.state ?? 'all'

  while (page <= MAX_ISSUE_PAGES) {
    const params = new URLSearchParams({
      state,
      per_page: '100',
      page: String(page),
      sort: 'updated',
      direction: 'desc',
    })
    if (opts?.labels) params.set('labels', opts.labels)
    if (opts?.since) params.set('since', opts.since)

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?${params}`,
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
      console.error('[github.listRepoIssues] Error:', response.status, errorText)
      throw new Error(`Failed to list issues: ${response.status}`)
    }

    const data: GitHubIssue[] = await response.json()

    // Filter out pull requests (GitHub issues API returns PRs too)
    const realIssues = data.filter((item) => !item.pull_request)
    issues.push(...realIssues)

    if (data.length < 100) break
    page++
  }

  return issues
}

/**
 * Get all comments for an issue.
 */
export async function getIssueComments(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubComment[]> {
  const comments: GitHubComment[] = []
  let page = 1

  while (page <= MAX_ISSUE_PAGES) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
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
      console.error('[github.getIssueComments] Error:', response.status, errorText)
      throw new Error(`Failed to get comments: ${response.status}`)
    }

    const data: GitHubComment[] = await response.json()
    comments.push(...data)

    if (data.length < 100) break
    page++
  }

  return comments
}
