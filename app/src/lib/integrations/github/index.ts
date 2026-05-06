/**
 * Project-scoped GitHub helpers backed by integration_connections.
 * Used by the codebase-knowledge feature to resolve tokens + repo URLs.
 */

import { listConnections } from '../shared/connections'
import { generateInstallationToken } from './jwt'

export type GitHubIntegrationStatus = {
  connected: boolean
  accountLogin: string | null
  installationId: number | null
  authMethod: 'app' | 'pat' | null
}

type GitHubCredentials = {
  authMethod?: 'app' | 'pat'
  accountLogin?: string
  installationId?: number
  accessToken?: string
}

async function loadGithubCredentials(projectId: string): Promise<GitHubCredentials | null> {
  const [conn] = await listConnections({ projectId, pluginId: 'github' })
  return conn ? (conn.credentials as GitHubCredentials) : null
}

export async function hasGitHubInstallation(projectId: string): Promise<GitHubIntegrationStatus> {
  const creds = await loadGithubCredentials(projectId)
  if (!creds) {
    return { connected: false, accountLogin: null, installationId: null, authMethod: null }
  }
  return {
    connected: true,
    accountLogin: creds.accountLogin ?? null,
    installationId: creds.installationId ?? null,
    authMethod: creds.authMethod ?? 'app',
  }
}

export async function getGitHubInstallationToken(
  projectId: string
): Promise<{ token: string; authMethod: 'app' | 'pat' } | null> {
  const creds = await loadGithubCredentials(projectId)
  if (!creds) return null

  if (creds.authMethod === 'pat') {
    if (!creds.accessToken) return null
    return { token: creds.accessToken, authMethod: 'pat' }
  }
  if (!creds.installationId) return null
  const token = await generateInstallationToken(creds.installationId)
  return { token, authMethod: 'app' }
}

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
    throw new Error(`Failed to fetch branch info: ${response.status} ${errorText}`)
  }
  const branchInfo = (await response.json()) as { commit: { sha: string } }
  return branchInfo.commit.sha
}

export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const cleanUrl = url.replace(/\.git$/, '')
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/,
    /^github\.com\/([^/]+)\/([^/]+)\/?$/,
  ]
  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern)
    if (match) return { owner: match[1], repo: match[2] }
  }
  return null
}
