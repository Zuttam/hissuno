/**
 * GitHub OAuth integration module
 * Follows the Slack integration pattern with project-level tokens
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Use AnySupabase for tables not yet in generated types
type AnySupabase = SupabaseClient<Database> & {
  from(table: string): ReturnType<SupabaseClient<Database>['from']>
}

// =============================================================================
// Types
// =============================================================================

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
  accountLogin: string | null
  installedByEmail: string | null
}

// =============================================================================
// Token Management (Project-Level)
// =============================================================================

/**
 * Check if a project has GitHub integration
 */
export async function hasGitHubInstallation(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<GitHubIntegrationStatus> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('github_app_installations')
    .select('account_login, installed_by_email')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return {
      connected: false,
      accountLogin: null,
      installedByEmail: null,
    }
  }

  return {
    connected: true,
    accountLogin: data.account_login,
    installedByEmail: data.installed_by_email,
  }
}

/**
 * Get GitHub access token for a project
 */
export async function getGitHubInstallationToken(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<string | null> {
  const client = supabase as AnySupabase

  const { data, error } = await client
    .from('github_app_installations')
    .select('access_token')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    return null
  }

  return data.access_token
}

/**
 * Disconnect GitHub integration from project
 * This deletes:
 * - github_app_installations (OAuth token)
 * - knowledge_sources where type='codebase' (which has source_code_id)
 * - source_codes record
 */
export async function disconnectGitHub(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase

  // Delete github_app_installations
  const { error } = await client
    .from('github_app_installations')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    console.error('[github.disconnect] Failed:', error)
    return { success: false, error: 'Failed to disconnect GitHub.' }
  }

  // Get codebase knowledge_source to find source_code_id
  const { data: codebaseSource } = await client
    .from('knowledge_sources')
    .select('source_code_id')
    .eq('project_id', projectId)
    .eq('type', 'codebase')
    .single()

  const sourceCodeId = codebaseSource?.source_code_id

  // Delete codebase knowledge source (FK to source_codes is ON DELETE SET NULL)
  const { error: ksError } = await client
    .from('knowledge_sources')
    .delete()
    .eq('project_id', projectId)
    .eq('type', 'codebase')

  if (ksError) {
    console.warn('[github.disconnect] Failed to delete codebase knowledge source:', ksError)
  }

  // Delete the source_codes record
  if (sourceCodeId) {
    const { error: scError } = await client
      .from('source_codes')
      .delete()
      .eq('id', sourceCodeId)

    if (scError) {
      console.warn('[github.disconnect] Failed to delete source_codes:', scError)
    }
  }

  return { success: true }
}

/**
 * Store GitHub OAuth token after callback
 */
export async function storeGitHubToken(
  supabase: SupabaseClient<Database>,
  params: {
    projectId: string
    accessToken: string
    accountLogin: string
    accountId: number
    installedByUserId: string | null
    installedByEmail: string | null
    scope: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase

  const { error } = await client.from('github_app_installations').upsert(
    {
      project_id: params.projectId,
      access_token: params.accessToken,
      account_login: params.accountLogin,
      account_id: params.accountId,
      installed_by_user_id: params.installedByUserId,
      installed_by_email: params.installedByEmail,
      scope: params.scope,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'project_id',
    }
  )

  if (error) {
    console.error('[github.storeToken] Failed:', error)
    return { success: false, error: 'Failed to store GitHub token.' }
  }

  return { success: true }
}

// =============================================================================
// GitHub API Utilities
// =============================================================================

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
        Accept: 'application/vnd.github+json',
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
        Accept: 'application/vnd.github+json',
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
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'follow',
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
 */
export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const cleanUrl = url.replace(/\.git$/, '')

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
