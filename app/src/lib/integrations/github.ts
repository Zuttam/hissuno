import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export type GitHubRepo = {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
  private: boolean
  default_branch: string
  html_url: string
  description: string | null
  updated_at: string
}

export type GitHubBranch = {
  name: string
  commit: {
    sha: string
  }
  protected: boolean
}

export type GitHubIntegrationStatus = {
  connected: boolean
  username: string | null
  userId: string | null
}

/**
 * Check if a user has GitHub integration connected
 */
export async function hasGitHubIntegration(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<GitHubIntegrationStatus> {
  const { data, error } = await supabase
    .from('user_github_tokens')
    .select('github_username, github_user_id')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return { connected: false, username: null, userId: null }
  }

  return {
    connected: true,
    username: data.github_username,
    userId: data.github_user_id,
  }
}

/**
 * Get the stored GitHub access token for a user
 */
export async function getGitHubToken(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_github_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data.access_token
}

/**
 * Disconnect GitHub integration for a user
 */
export async function disconnectGitHub(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('user_github_tokens')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('[github.disconnectGitHub] Failed to delete token:', error)
    return { success: false, error: 'Failed to disconnect GitHub.' }
  }

  return { success: true }
}

/**
 * Fetch user's GitHub repositories
 */
export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const response = await fetch(
    'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[github.fetchUserRepos] GitHub API error:', response.status, errorText)
    throw new Error(`Failed to fetch repositories: ${response.status}`)
  }

  const repos: GitHubRepo[] = await response.json()
  return repos
}

/**
 * Fetch branches for a specific repository
 */
export async function fetchRepoBranches(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[github.fetchRepoBranches] GitHub API error:', response.status, errorText)
    throw new Error(`Failed to fetch branches: ${response.status}`)
  }

  const branches: GitHubBranch[] = await response.json()
  return branches
}

/**
 * Get the OAuth URL for linking GitHub account
 * This uses Supabase's linkIdentity which requires client-side execution
 */
export function getGitHubLinkUrl(redirectTo: string): string {
  // This function is a placeholder - the actual linking happens client-side
  // using supabase.auth.linkIdentity({ provider: 'github' })
  return `/api/integrations/github/link?redirectTo=${encodeURIComponent(redirectTo)}`
}

/**
 * Get the latest commit SHA for a branch
 */
export async function getLatestCommitSha(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[github.getLatestCommitSha] GitHub API error:', response.status, errorText)
    throw new Error(`Failed to fetch branch info: ${response.status}`)
  }

  const branchInfo: GitHubBranch = await response.json()
  return branchInfo.commit.sha
}

/**
 * Download repository as a tarball
 * Returns the tarball as an ArrayBuffer
 */
export async function downloadRepoTarball(
  token: string,
  owner: string,
  repo: string,
  ref: string
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'follow', // Follow the 302 redirect automatically
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[github.downloadRepoTarball] GitHub API error:', response.status, errorText)
    throw new Error(`Failed to download tarball: ${response.status}`)
  }

  return response.arrayBuffer()
}

/**
 * Parse owner and repo from a GitHub repository URL
 * Supports formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - github.com/owner/repo
 */
export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  // Remove .git suffix if present
  const cleanUrl = url.replace(/\.git$/, '')
  
  // Try to match GitHub URL patterns
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/,
    /^github\.com\/([^/]+)\/([^/]+)\/?$/,
  ]

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern)
    if (match) {
      return { owner: match[1], repo: match[2] }
    }
  }

  return null
}
