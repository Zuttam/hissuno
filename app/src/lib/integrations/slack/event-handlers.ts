/**
 * Slack Event Handlers
 * Routes Slack events to appropriate handlers
 */

import { createAdminClient } from '@/lib/supabase/server'
import {
  getSlackBotToken,
  getOrCreateSlackChannel,
  getSlackChannel,
} from './index'
import { SlackClient } from './client'
import { processSlackMention, processSlackMessage } from './message-processor'

export type SlackEventPayload = {
  teamId: string
  event: SlackEvent
  eventId: string
  eventTime: number
}

export type SlackEvent = {
  type: string
  user?: string
  channel?: string
  channel_type?: string
  text?: string
  ts?: string
  thread_ts?: string
  bot_id?: string
  subtype?: string
  // For member_joined_channel
  channel_id?: string
  inviter?: string
}

/**
 * Main event router
 */
export async function handleSlackEvent(payload: SlackEventPayload): Promise<void> {
  const { teamId, event } = payload

  console.log(`[slack.event-handlers] Received event: ${event.type}`, {
    teamId,
    channel: event.channel,
    user: event.user,
  })

  // Get bot token for this workspace
  const supabase = createAdminClient()
  const tokenInfo = await getSlackBotToken(supabase, teamId)

  if (!tokenInfo) {
    console.warn(`[slack.event-handlers] No token found for workspace: ${teamId}`)
    return
  }

  const { token, botUserId, projectId } = tokenInfo
  const slackClient = new SlackClient(token)

  // Ignore bot's own messages
  if (event.user === botUserId || event.bot_id) {
    return
  }

  try {
    switch (event.type) {
      case 'app_mention':
        await handleAppMention({
          event,
          projectId,
          botUserId,
          slackClient,
          supabase,
          teamId,
        })
        break

      case 'message':
        // Handle regular messages (for monitoring)
        // Skip message subtypes like message_changed, message_deleted
        if (!event.subtype) {
          await handleMessage({
            event,
            projectId,
            botUserId,
            slackClient,
            supabase,
            teamId,
          })
        }
        break

      case 'member_joined_channel':
        // Handle when bot joins a channel
        if (event.user === botUserId) {
          await handleBotJoinedChannel({
            event,
            projectId,
            slackClient,
            supabase,
            teamId,
          })
        }
        break

      default:
        console.log(`[slack.event-handlers] Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error(`[slack.event-handlers] Error handling event:`, error)
  }
}

/**
 * Handle app_mention event (user @mentioned the bot)
 */
async function handleAppMention(params: {
  event: SlackEvent
  projectId: string
  botUserId: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
}): Promise<void> {
  const { event, projectId, botUserId, slackClient, supabase, teamId } = params

  if (!event.channel || !event.ts) {
    console.warn('[slack.event-handlers] Missing channel or ts in app_mention')
    return
  }

  // Get or create channel record
  const channelInfo = await slackClient.getChannelInfo(event.channel)
  const channel = await getSlackChannel(supabase, teamId, event.channel)

  let channelDbId: string
  if (!channel) {
    // Get workspace token ID first
    const { data: workspaceToken } = await (supabase as any)
      .from('slack_workspace_tokens')
      .select('id, workspace_domain')
      .eq('workspace_id', teamId)
      .single()

    if (!workspaceToken) {
      console.error('[slack.event-handlers] No workspace token found')
      return
    }

    const newChannel = await getOrCreateSlackChannel(supabase, {
      workspaceTokenId: workspaceToken.id,
      channelId: event.channel,
      channelName: channelInfo?.name || null,
      channelType: channelInfo?.is_private ? 'private_channel' : 'channel',
      workspacePrimaryDomain: workspaceToken.workspace_domain,
    })

    if (!newChannel) {
      console.error('[slack.event-handlers] Failed to create channel record')
      return
    }
    channelDbId = newChannel.id
  } else {
    channelDbId = channel.id
  }

  // Process the mention
  await processSlackMention({
    projectId,
    channelId: event.channel,
    channelDbId,
    threadTs: event.thread_ts || event.ts, // Use thread_ts if in thread, else message ts
    messageTs: event.ts,
    userId: event.user,
    text: event.text || '',
    botUserId,
    slackClient,
    supabase,
    teamId,
  })
}

/**
 * Handle message event (for monitoring external participants)
 */
async function handleMessage(params: {
  event: SlackEvent
  projectId: string
  botUserId: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
}): Promise<void> {
  const { event, projectId, slackClient, supabase, teamId } = params

  // Only monitor threaded messages for now
  if (!event.thread_ts) {
    return
  }

  if (!event.channel || !event.ts) {
    return
  }

  // Get channel record
  const channel = await getSlackChannel(supabase, teamId, event.channel)
  if (!channel) {
    return // Channel not tracked
  }

  // Process message for external participant detection
  await processSlackMessage({
    projectId,
    channelId: event.channel,
    channelDbId: channel.id,
    threadTs: event.thread_ts,
    messageTs: event.ts,
    userId: event.user,
    text: event.text || '',
    slackClient,
    supabase,
    teamId,
    workspacePrimaryDomain: channel.workspacePrimaryDomain,
  })
}

/**
 * Handle bot joining a channel
 */
async function handleBotJoinedChannel(params: {
  event: SlackEvent
  projectId: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
}): Promise<void> {
  const { event, slackClient, supabase, teamId } = params

  const channelId = event.channel || event.channel_id
  if (!channelId) {
    return
  }

  console.log(`[slack.event-handlers] Bot joined channel: ${channelId}`)

  // Get workspace token
  const { data: workspaceToken } = await (supabase as any)
    .from('slack_workspace_tokens')
    .select('id, workspace_domain')
    .eq('workspace_id', teamId)
    .single()

  if (!workspaceToken) {
    console.error('[slack.event-handlers] No workspace token found for bot join')
    return
  }

  // Get channel info
  const channelInfo = await slackClient.getChannelInfo(channelId)

  // Create or update channel record
  await getOrCreateSlackChannel(supabase, {
    workspaceTokenId: workspaceToken.id,
    channelId,
    channelName: channelInfo?.name || null,
    channelType: channelInfo?.is_private ? 'private_channel' : 'channel',
    workspacePrimaryDomain: workspaceToken.workspace_domain,
  })
}
