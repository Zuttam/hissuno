/**
 * Slack DM notification service
 *
 * Sends notifications to users via Slack DMs using the project bot tokens.
 * Resolves the user's Slack ID by matching their email across project workspaces.
 */

import { createAdminClient } from '@/lib/supabase/server'
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
  const supabase = createAdminClient()

  // 1. Check cached slack_user_id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('slack_user_id')
    .eq('user_id', userId)
    .single()

  if (profile?.slack_user_id) {
    // We have the cached Slack ID, but still need a bot token to send DMs.
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)

    if (projects && projects.length > 0) {
      const projectIds = projects.map((p) => p.id)
      const { data: tokens } = await supabase
        .from('slack_workspace_tokens')
        .select('bot_token')
        .in('project_id', projectIds)
        .limit(1)

      if (tokens && tokens.length > 0) {
        return { slackUserId: profile.slack_user_id, botToken: tokens[0].bot_token }
      }
    }
  }

  // 2. Get user email from auth
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
  if (authError || !authData.user?.email) {
    console.warn(`${LOG_PREFIX} Cannot resolve email for user ${userId}`)
    return null
  }
  const email = authData.user.email

  // 3. Get all projects owned by user that have Slack tokens
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)

  if (!projects || projects.length === 0) {
    console.log(`${LOG_PREFIX} User ${userId} has no projects`)
    return null
  }

  const projectIds = projects.map((p) => p.id)

  const { data: tokens } = await supabase
    .from('slack_workspace_tokens')
    .select('bot_token')
    .in('project_id', projectIds)

  if (!tokens || tokens.length === 0) {
    console.log(`${LOG_PREFIX} No Slack tokens found for user ${userId}`)
    return null
  }

  // 4. Try each bot token to find the user
  for (const { bot_token } of tokens) {
    const slackUserId = await lookupSlackUserByEmail(bot_token, email)
    if (slackUserId) {
      // 5. Cache the result
      await supabase
        .from('user_profiles')
        .update({ slack_user_id: slackUserId })
        .eq('user_id', userId)

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
