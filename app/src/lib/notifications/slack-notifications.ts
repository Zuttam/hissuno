/**
 * Slack DM notification service
 *
 * Sends notifications to users via Slack DMs using the project bot tokens.
 * Resolves the user's Slack ID by matching their email across project workspaces.
 */

import { db } from '@/lib/db'
import { projects, slackWorkspaceTokens, userProfiles } from '@/lib/db/schema/app'
import { users } from '@/lib/db/schema/auth'
import { eq, inArray } from 'drizzle-orm'
import { SlackClient } from '@/lib/integrations/slack/client'

const LOG_PREFIX = '[slack-notifications]'

const SLACK_API_BASE = 'https://slack.com/api'

/**
 * Look up a Slack user by email using a bot token.
 * Uses the Slack `users.lookupByEmail` API method.
 */
async function lookupSlackUserByEmail(
  botToken: string,
  email: string
): Promise<string | null> {
  try {
    const response = await fetch(`${SLACK_API_BASE}/users.lookupByEmail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ email }).toString(),
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.ok || !data.user?.id) return null

    return data.user.id as string
  } catch (error) {
    console.error(`${LOG_PREFIX} lookupByEmail failed:`, error)
    return null
  }
}

/**
 * Resolve a Hissuno user's Slack user ID.
 *
 * 1. Check cached slack_user_id on user_profiles
 * 2. Get user email from auth
 * 3. Get all projects owned by user, find their slack_workspace_tokens
 * 4. Call Slack users.lookupByEmail with each bot token until match
 * 5. Cache result on user_profiles.slack_user_id
 */
export async function resolveSlackUserId(
  userId: string
): Promise<{ slackUserId: string; botToken: string } | null> {
  // 1. Check cached slack_user_id
  const [profile] = await db
    .select({ slack_user_id: userProfiles.slack_user_id })
    .from(userProfiles)
    .where(eq(userProfiles.user_id, userId))
    .limit(1)

  if (profile?.slack_user_id) {
    // We have the cached Slack ID, but still need a bot token to send DMs.
    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.user_id, userId))

    if (userProjects.length > 0) {
      const projectIds = userProjects.map((p) => p.id)
      const tokens = await db
        .select({ bot_token: slackWorkspaceTokens.bot_token })
        .from(slackWorkspaceTokens)
        .where(inArray(slackWorkspaceTokens.project_id, projectIds))
        .limit(1)

      if (tokens.length > 0) {
        return { slackUserId: profile.slack_user_id, botToken: tokens[0].bot_token }
      }
    }
  }

  // 2. Get user email from users table
  const [authUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!authUser?.email) {
    console.warn(`${LOG_PREFIX} Cannot resolve email for user ${userId}`)
    return null
  }
  const email = authUser.email

  // 3. Get all projects owned by user that have Slack tokens
  const userProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.user_id, userId))

  if (userProjects.length === 0) {
    console.log(`${LOG_PREFIX} User ${userId} has no projects`)
    return null
  }

  const projectIds = userProjects.map((p) => p.id)

  const tokens = await db
    .select({ bot_token: slackWorkspaceTokens.bot_token })
    .from(slackWorkspaceTokens)
    .where(inArray(slackWorkspaceTokens.project_id, projectIds))

  if (tokens.length === 0) {
    console.log(`${LOG_PREFIX} No Slack tokens found for user ${userId}`)
    return null
  }

  // 4. Try each bot token to find the user
  for (const { bot_token } of tokens) {
    const slackUserId = await lookupSlackUserByEmail(bot_token, email)
    if (slackUserId) {
      // 5. Cache the result
      await db
        .update(userProfiles)
        .set({ slack_user_id: slackUserId })
        .where(eq(userProfiles.user_id, userId))

      console.log(`${LOG_PREFIX} Resolved Slack user ${slackUserId} for user ${userId}`)
      return { slackUserId, botToken: bot_token }
    }
  }

  console.log(`${LOG_PREFIX} Could not find Slack user for email ${email}`)
  return null
}

/**
 * Send a DM to a Slack user via a bot token.
 * Opens a DM conversation and posts a message.
 * Returns channel and message info for thread tracking.
 */
export async function sendSlackDM(params: {
  slackUserId: string
  botToken: string
  text: string
}): Promise<{
  ok: boolean
  error?: string
  channelId?: string
  messageTs?: string
}> {
  const { slackUserId, botToken, text } = params

  try {
    // Open a DM channel with the user
    const openResponse = await fetch(`${SLACK_API_BASE}/conversations.open`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ users: slackUserId }).toString(),
    })

    const openData = await openResponse.json()
    if (!openData.ok || !openData.channel?.id) {
      console.error(`${LOG_PREFIX} Failed to open DM:`, openData.error)
      return { ok: false, error: openData.error ?? 'Failed to open DM' }
    }

    const channelId = openData.channel.id as string

    // Post the message
    const client = new SlackClient(botToken)
    const result = await client.postMessage({ channel: channelId, text })

    if (!result.ok) {
      console.error(`${LOG_PREFIX} Failed to send DM:`, result.error)
      return { ok: false, error: result.error }
    }

    console.log(`${LOG_PREFIX} Sent Slack DM to ${slackUserId}`)
    return {
      ok: true,
      channelId,
      messageTs: result.ts,
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending Slack DM:`, error)
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * High-level: resolve Slack user and send a DM notification.
 */
export async function sendSlackNotification(params: {
  userId: string
  text: string
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, text } = params

  const resolved = await resolveSlackUserId(userId)
  if (!resolved) {
    return { ok: false, error: 'Could not resolve Slack user' }
  }

  return sendSlackDM({
    slackUserId: resolved.slackUserId,
    botToken: resolved.botToken,
    text,
  })
}
