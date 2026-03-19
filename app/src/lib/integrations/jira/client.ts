import type {
  JiraProject,
  JiraIssueType,
  JiraConnectionRecord,
} from '@/types/jira'
import { refreshAccessToken } from './oauth'
import { updateJiraTokens } from './index'

const JIRA_API_BASE = 'https://api.atlassian.com/ex/jira'

/**
 * Make an authenticated request to the Jira API, with automatic token refresh
 */
async function jiraFetch(
  connection: JiraConnectionRecord,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  let accessToken = connection.access_token

  // Check if token is expired or about to expire (5 min buffer)
  const expiresAt = new Date(connection.token_expires_at)
  const now = new Date()
  const fiveMinutes = 5 * 60 * 1000

  if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
    const clientId = process.env.JIRA_CLIENT_ID
    const clientSecret = process.env.JIRA_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('Jira OAuth not configured')
    }

    const tokens = await refreshAccessToken({
      refreshToken: connection.refresh_token,
      clientId,
      clientSecret,
    })

    accessToken = tokens.access_token
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Update stored tokens
    await updateJiraTokens(connection.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: newExpiresAt,
    })

    // Update in-memory connection
    connection.access_token = tokens.access_token
    connection.refresh_token = tokens.refresh_token
    connection.token_expires_at = newExpiresAt
  }

  const url = `${JIRA_API_BASE}/${connection.cloud_id}${path}`
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

/**
 * Get Jira projects accessible to the user
 */
export async function getJiraProjects(
  connection: JiraConnectionRecord
): Promise<JiraProject[]> {
  const response = await jiraFetch(connection, '/rest/api/3/project/search?maxResults=50')

  if (!response.ok) {
    const error = await response.text()
    console.error('[jira.client] Get projects failed:', error)
    throw new Error(`Failed to get Jira projects: ${response.status}`)
  }

  const data = await response.json()
  return (data.values ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    key: p.key as string,
    name: p.name as string,
    projectTypeKey: p.projectTypeKey as string,
  }))
}

/**
 * Get issue types for a Jira project
 */
export async function getJiraIssueTypes(
  connection: JiraConnectionRecord,
  projectKey: string
): Promise<JiraIssueType[]> {
  const response = await jiraFetch(
    connection,
    `/rest/api/3/issue/createmeta/${projectKey}/issuetypes`
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('[jira.client] Get issue types failed:', error)
    throw new Error(`Failed to get issue types: ${response.status}`)
  }

  const data = await response.json()
  return (data.issueTypes ?? data.values ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    name: t.name as string,
    description: (t.description as string) ?? '',
    subtask: Boolean(t.subtask),
    iconUrl: (t.iconUrl as string) ?? '',
  }))
}

/**
 * Get current user information (for verifying connection)
 */
export async function getJiraCurrentUser(
  connection: JiraConnectionRecord
): Promise<{ accountId: string; displayName: string; emailAddress: string }> {
  const response = await jiraFetch(connection, '/rest/api/3/myself')

  if (!response.ok) {
    const error = await response.text()
    console.error('[jira.client] Get current user failed:', error)
    throw new Error(`Failed to get Jira user: ${response.status}`)
  }

  return response.json()
}
