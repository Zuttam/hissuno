import type {
  JiraProject,
  JiraIssueType,
  JiraCreateIssuePayload,
  JiraCreatedIssue,
  JiraAdfDocument,
  JiraAdfNode,
  JiraConnectionRecord,
} from '@/types/jira'
import { refreshAccessToken } from './oauth'
import { updateJiraTokens } from './index'
import { createAdminClient } from '@/lib/supabase/server'

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
    const supabase = createAdminClient()
    await updateJiraTokens(supabase, connection.id, {
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
 * Create a Jira issue
 */
export async function createJiraIssue(
  connection: JiraConnectionRecord,
  payload: JiraCreateIssuePayload
): Promise<JiraCreatedIssue> {
  const response = await jiraFetch(connection, '/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[jira.client] Create issue failed:', error)
    throw new Error(`Failed to create Jira issue: ${response.status} - ${error}`)
  }

  return response.json() as Promise<JiraCreatedIssue>
}

/**
 * Add a comment to a Jira issue
 */
export async function addJiraComment(
  connection: JiraConnectionRecord,
  issueKey: string,
  commentBody: JiraAdfDocument
): Promise<void> {
  const response = await jiraFetch(connection, `/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body: commentBody }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[jira.client] Add comment failed:', error)
    throw new Error(`Failed to add Jira comment: ${response.status}`)
  }
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

// ============================================================================
// ADF Document Builders
// ============================================================================

/**
 * Convert plain text to Atlassian Document Format (ADF)
 */
export function textToAdf(text: string): JiraAdfDocument {
  const paragraphs: JiraAdfNode[] = text.split('\n\n').map((paragraph) => ({
    type: 'paragraph',
    content: paragraph.split('\n').flatMap((line, idx, arr) => {
      const nodes: JiraAdfNode[] = [{ type: 'text', text: line }]
      if (idx < arr.length - 1) {
        nodes.push({ type: 'hardBreak' })
      }
      return nodes
    }),
  }))

  return {
    type: 'doc',
    version: 1,
    content: paragraphs,
  }
}

/**
 * Build an ADF document for issue creation with a link back to Hissuno
 */
export function buildIssueDescription(
  description: string,
  hissunoUrl: string
): JiraAdfDocument {
  const descriptionParagraphs = textToAdf(description).content

  return {
    type: 'doc',
    version: 1,
    content: [
      ...descriptionParagraphs,
      { type: 'rule' },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'View in Hissuno: ' },
          {
            type: 'text',
            text: hissunoUrl,
            marks: [{ type: 'link', attrs: { href: hissunoUrl } }],
          },
        ],
      },
    ],
  }
}

/**
 * Build an ADF comment for spec generation notification
 */
export function buildSpecComment(specUrl: string): JiraAdfDocument {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Product spec generated. View full spec: ' },
          {
            type: 'text',
            text: specUrl,
            marks: [{ type: 'link', attrs: { href: specUrl } }],
          },
        ],
      },
    ],
  }
}
