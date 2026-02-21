import { LinearClient } from '@linear/sdk'
import type { LinearConnectionRecord, LinearTeam } from '@/types/linear'
import { refreshAccessToken } from './oauth'
import { updateLinearTokens } from './index'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Create an authenticated Linear client with automatic token refresh
 */
export async function createAuthedLinearClient(
  connection: LinearConnectionRecord
): Promise<LinearClient> {
  let accessToken = connection.access_token

  // Check if token is expired or about to expire (5 min buffer)
  const expiresAt = new Date(connection.token_expires_at)
  const now = new Date()
  const fiveMinutes = 5 * 60 * 1000

  if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
    const clientId = process.env.LINEAR_CLIENT_ID
    const clientSecret = process.env.LINEAR_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('Linear OAuth not configured')
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
    await updateLinearTokens(supabase, connection.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: newExpiresAt,
    })

    // Update in-memory connection
    connection.access_token = tokens.access_token
    connection.refresh_token = tokens.refresh_token
    connection.token_expires_at = newExpiresAt
  }

  return new LinearClient({ accessToken })
}

/**
 * Get Linear teams accessible to the user
 */
export async function getLinearTeams(
  connection: LinearConnectionRecord
): Promise<LinearTeam[]> {
  const client = await createAuthedLinearClient(connection)
  const teams = await client.teams()

  return teams.nodes.map((team) => ({
    id: team.id,
    name: team.name,
    key: team.key,
  }))
}

/**
 * Get the viewer (current user) to verify connection and get org info
 */
export async function getLinearViewer(
  connection: LinearConnectionRecord
): Promise<{ id: string; name: string; email: string; organizationId: string; organizationName: string }> {
  const client = await createAuthedLinearClient(connection)
  const viewer = await client.viewer
  const org = await viewer.organization

  return {
    id: viewer.id,
    name: viewer.name,
    email: viewer.email,
    organizationId: org.id,
    organizationName: org.name,
  }
}

/**
 * Create a Linear issue with the "hissuno" label
 */
export async function createLinearIssue(
  connection: LinearConnectionRecord,
  params: {
    teamId: string
    title: string
    description: string
    labelName?: string
  }
): Promise<{ id: string; identifier: string; url: string }> {
  const client = await createAuthedLinearClient(connection)

  // Find or create the "hissuno" label
  const labelName = params.labelName ?? 'hissuno'
  let labelId: string | undefined

  const existingLabels = await client.issueLabels({
    filter: {
      name: { eq: labelName },
      team: { id: { eq: params.teamId } },
    },
  })

  if (existingLabels.nodes.length > 0) {
    labelId = existingLabels.nodes[0].id
  } else {
    // Check workspace-level labels
    const workspaceLabels = await client.issueLabels({
      filter: {
        name: { eq: labelName },
        team: { null: true },
      },
    })

    if (workspaceLabels.nodes.length > 0) {
      labelId = workspaceLabels.nodes[0].id
    } else {
      // Create the label on the team
      const labelResult = await client.createIssueLabel({
        name: labelName,
        teamId: params.teamId,
        color: '#6366f1', // Indigo color
      })
      const label = await labelResult.issueLabel
      if (label) {
        labelId = label.id
      }
    }
  }

  const issuePayload = await client.createIssue({
    teamId: params.teamId,
    title: params.title,
    description: params.description,
    labelIds: labelId ? [labelId] : undefined,
  })

  const issue = await issuePayload.issue
  if (!issue) {
    throw new Error('Failed to create Linear issue: no issue returned')
  }

  return {
    id: issue.id,
    identifier: issue.identifier,
    url: issue.url,
  }
}

/**
 * Add a markdown comment to a Linear issue
 */
export async function addLinearComment(
  connection: LinearConnectionRecord,
  issueId: string,
  body: string
): Promise<void> {
  const client = await createAuthedLinearClient(connection)
  await client.createComment({
    issueId,
    body,
  })
}
