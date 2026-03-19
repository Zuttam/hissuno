import { LinearClient } from '@linear/sdk'
import type { LinearConnectionRecord, LinearTeam } from '@/types/linear'
import { refreshAccessToken } from './oauth'
import { updateLinearTokens } from './index'

/**
 * Create an authenticated Linear client with automatic token refresh
 */
export async function createAuthedLinearClient(
  connection: LinearConnectionRecord
): Promise<LinearClient> {
  // API key connections don't need token refresh
  if (connection.auth_method === 'token') {
    return new LinearClient({ apiKey: connection.access_token })
  }

  let accessToken = connection.access_token

  // Check if token is expired or about to expire (5 min buffer)
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at)
    const now = new Date()
    const fiveMinutes = 5 * 60 * 1000

    if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
      const clientId = process.env.LINEAR_CLIENT_ID
      const clientSecret = process.env.LINEAR_CLIENT_SECRET
      if (!clientId || !clientSecret) {
        throw new Error('Linear OAuth not configured')
      }

      if (!connection.refresh_token) {
        throw new Error('No refresh token available for OAuth connection')
      }

      const tokens = await refreshAccessToken({
        refreshToken: connection.refresh_token,
        clientId,
        clientSecret,
      })

      accessToken = tokens.access_token
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

      // Update stored tokens
      await updateLinearTokens(connection.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: newExpiresAt,
      })

      // Update in-memory connection
      connection.access_token = tokens.access_token
      connection.refresh_token = tokens.refresh_token
      connection.token_expires_at = newExpiresAt
    }
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
