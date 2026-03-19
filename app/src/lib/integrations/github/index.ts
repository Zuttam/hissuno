/**
 * GitHub App integration module
 * Handles GitHub App installations per project
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { githubAppInstallations, knowledgeSources, sourceCodes } from '@/lib/db/schema/app'
import { generateInstallationToken, clearTokenCache } from './jwt'

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
  installationId: number | null
  authMethod: 'app' | 'pat' | null
}

// =============================================================================
// Installation Management
// =============================================================================

/**
 * Check if a project has GitHub integration
 */
export async function hasGitHubInstallation(
  projectId: string
): Promise<GitHubIntegrationStatus> {
  const rows = await db
    .select({
      account_login: githubAppInstallations.account_login,
      installed_by_email: githubAppInstallations.installed_by_email,
      installation_id: githubAppInstallations.installation_id,
      auth_method: githubAppInstallations.auth_method,
    })
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      accountLogin: null,
      installedByEmail: null,
      installationId: null,
      authMethod: null,
    }
  }

  return {
    connected: true,
    accountLogin: data.account_login,
    installedByEmail: data.installed_by_email,
    installationId: data.installation_id,
    authMethod: data.auth_method as 'app' | 'pat',
  }
}

/**
 * Get GitHub installation access token for a project
 * Generates a short-lived token on-demand using the installation ID
 */
export async function getGitHubInstallationToken(
  projectId: string
): Promise<{ token: string; authMethod: 'app' | 'pat' } | null> {
  const rows = await db
    .select({
      installation_id: githubAppInstallations.installation_id,
      access_token: githubAppInstallations.access_token,
      auth_method: githubAppInstallations.auth_method,
    })
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.project_id, projectId))

  const data = rows[0]
  if (!data) return null

  const authMethod = data.auth_method === 'pat' ? 'pat' : 'app'

  if (authMethod === 'pat') {
    if (!data.access_token) return null
    return { token: data.access_token, authMethod }
  }

  if (!data.installation_id) return null
  const token = await generateInstallationToken(data.installation_id)
  return { token, authMethod }
}

/**
 * Disconnect GitHub integration from project
 */
export async function disconnectGitHub(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  // Get installation info to clear cache if needed
  const instRows = await db
    .select({
      installation_id: githubAppInstallations.installation_id,
      auth_method: githubAppInstallations.auth_method,
    })
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.project_id, projectId))

  const installation = instRows[0]

  if (installation?.auth_method === 'app' && installation.installation_id) {
    clearTokenCache(installation.installation_id)
  }

  // Delete github_app_installations
  try {
    await db
      .delete(githubAppInstallations)
      .where(eq(githubAppInstallations.project_id, projectId))
  } catch (error) {
    console.error('[github.disconnect] Failed:', error)
    return { success: false, error: 'Failed to disconnect GitHub.' }
  }

  // Get codebase knowledge_source to find source_code_id
  const ksRows = await db
    .select({ source_code_id: knowledgeSources.source_code_id })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.project_id, projectId),
        eq(knowledgeSources.type, 'codebase')
      )
    )

  const codebaseSource = ksRows[0]
  const sourceCodeId = codebaseSource?.source_code_id

  // Delete codebase knowledge source
  try {
    await db
      .delete(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.project_id, projectId),
          eq(knowledgeSources.type, 'codebase')
        )
      )
  } catch (ksError) {
    console.warn('[github.disconnect] Failed to delete codebase knowledge source:', ksError)
  }

  // Delete the source_codes record
  if (sourceCodeId) {
    try {
      await db.delete(sourceCodes).where(eq(sourceCodes.id, sourceCodeId))
    } catch (scError) {
      console.warn('[github.disconnect] Failed to delete source_codes:', scError)
    }
  }

  return { success: true }
}

/**
 * Store GitHub App installation after callback
 */
export async function storeGitHubInstallation(
  params: {
    projectId: string
    installationId: number
    accountLogin: string
    accountId: number
    targetType: 'User' | 'Organization'
    installedByUserId: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .insert(githubAppInstallations)
      .values({
        project_id: params.projectId,
        installation_id: params.installationId,
        account_login: params.accountLogin,
        account_id: params.accountId,
        target_type: params.targetType,
        auth_method: 'app',
        access_token: null,
        installed_by_user_id: params.installedByUserId,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: githubAppInstallations.project_id,
        set: {
          installation_id: params.installationId,
          account_login: params.accountLogin,
          account_id: params.accountId,
          target_type: params.targetType,
          auth_method: 'app',
          access_token: null,
          installed_by_user_id: params.installedByUserId,
          updated_at: new Date(),
        },
      })

    return { success: true }
  } catch (error) {
    console.error('[github.storeInstallation] Failed:', error)
    return { success: false, error: 'Failed to store GitHub installation.' }
  }
}

/**
 * Store a GitHub Personal Access Token for a project
 */
export async function storeGitHubPAT(
  params: {
    projectId: string
    accessToken: string
    accountLogin: string
    accountId: number
    installedByUserId: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .insert(githubAppInstallations)
      .values({
        project_id: params.projectId,
        installation_id: null,
        account_login: params.accountLogin,
        account_id: params.accountId,
        auth_method: 'pat',
        access_token: params.accessToken,
        installed_by_user_id: params.installedByUserId,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: githubAppInstallations.project_id,
        set: {
          installation_id: null,
          account_login: params.accountLogin,
          account_id: params.accountId,
          auth_method: 'pat',
          access_token: params.accessToken,
          installed_by_user_id: params.installedByUserId,
          updated_at: new Date(),
        },
      })

    return { success: true }
  } catch (error) {
    console.error('[github.storeGitHubPAT] Failed:', error)
    return { success: false, error: 'Failed to store GitHub PAT.' }
  }
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
