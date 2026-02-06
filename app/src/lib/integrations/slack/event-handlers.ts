/**
 * Slack Event Handlers
 * Routes Slack events to appropriate handlers
 */

import { createAdminClient } from '@/lib/supabase/server'
import {
  getSlackBotToken,
  getOrCreateSlackChannel,
  getSlackChannelWithMode,
  getThreadSession,
  updateThreadSessionResponder,
  getNotificationThreadSession,
  type SlackChannelWithMode,
} from './index'
import { SlackClient } from './client'
import {
  processSlackMention,
  processSlackMessage,
  processPassiveThreadCapture,
  processSlackThreadResponse,
  handleHumanAgentReply,
} from './message-processor'
import { decideIfShouldRespond } from './response-decision'
import { setSessionHumanTakeover } from '@/lib/supabase/sessions'

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

  // Get channel with mode info
  let channel = await getSlackChannelWithMode(supabase, teamId, event.channel)

  if (!channel) {
    // Get workspace token ID first and create channel record
    const { data: workspaceToken } = await (supabase as any)
      .from('slack_workspace_tokens')
      .select('id, workspace_domain')
      .eq('workspace_id', teamId)
      .single()

    if (!workspaceToken) {
      console.error('[slack.event-handlers] No workspace token found')
      return
    }

    const channelInfo = await slackClient.getChannelInfo(event.channel)
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

    // Re-fetch to get full channel info with mode
    channel = await getSlackChannelWithMode(supabase, teamId, event.channel)
    if (!channel) {
      console.error('[slack.event-handlers] Failed to get channel after creation')
      return
    }
  }

  const threadTs = event.thread_ts || event.ts

  // Check channel mode
  if (channel.channelMode === 'passive') {
    // Passive mode: capture thread but don't respond
    console.log(`[slack.event-handlers] Passive mode - capturing mention without response`)

    await processPassiveThreadCapture({
      projectId,
      channelId: event.channel,
      channelDbId: channel.id,
      threadTs,
      messageTs: event.ts,
      userId: event.user,
      text: event.text || '',
      slackClient,
      supabase,
      teamId,
      workspacePrimaryDomain: channel.workspacePrimaryDomain,
      captureMode: 'passive_mention',
    })
    return
  }

  // Interactive mode: process the mention and respond
  await processSlackMention({
    projectId,
    channelId: event.channel,
    channelDbId: channel.id,
    threadTs,
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
 * Handle message event (for monitoring and intelligent response)
 */
async function handleMessage(params: {
  event: SlackEvent
  projectId: string
  botUserId: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
}): Promise<void> {
  const { event, projectId, botUserId, slackClient, supabase, teamId } = params

  if (!event.channel || !event.ts) {
    return
  }

  // Check if this is a DM reply to a notification thread
  if (event.channel_type === 'im') {
    const dmSession = await getNotificationThreadSession(
      supabase,
      event.channel,
      event.thread_ts
    )

    if (dmSession) {
      await handleHumanAgentReply({
        sessionId: dmSession.sessionId,
        projectId: dmSession.projectId,
        text: event.text || '',
        slackClient,
        channelId: event.channel,
        threadTs: event.thread_ts || event.ts,
      })
      return
    }
  }

  // Only monitor threaded messages for now (non-DM case)
  if (!event.thread_ts) {
    return
  }

  // Get channel with mode info
  const channel = await getSlackChannelWithMode(supabase, teamId, event.channel)
  if (!channel) {
    return // Channel not tracked
  }

  // Handle based on channel mode
  if (channel.channelMode === 'passive') {
    // Passive mode: capture threads based on capture scope
    await handlePassiveModeMessage({
      event,
      channel,
      projectId,
      botUserId,
      slackClient,
      supabase,
      teamId,
    })
    return
  }

  // Interactive mode: check if this is a subscribed thread
  const threadSession = await getThreadSession(supabase, channel.id, event.thread_ts)

  if (threadSession) {
    // This thread is subscribed - decide if we should respond
    const decision = await decideIfShouldRespond({
      text: event.text || '',
      botUserId,
      lastResponderType: threadSession.lastResponderType,
      sessionId: threadSession.sessionId,
    })

    console.log(`[slack.event-handlers] Response decision for thread:`, {
      channel: event.channel,
      thread: event.thread_ts,
      shouldRespond: decision.shouldRespond,
      reason: decision.reason,
      confidence: decision.confidence,
      usedClassifier: decision.usedClassifier,
    })

    if (decision.shouldRespond) {
      // Respond to the thread
      await processSlackThreadResponse({
        projectId,
        channelId: event.channel,
        channelDbId: channel.id,
        threadTs: event.thread_ts,
        messageTs: event.ts,
        userId: event.user,
        text: event.text || '',
        botUserId,
        slackClient,
        supabase,
        teamId,
        threadSession,
      })
    } else {
      // User responded, update tracking
      await updateThreadSessionResponder(supabase, threadSession.id, 'user')

      // Bridge human takeover phrase to session-level flag
      if (decision.reason === 'Human takeover phrase detected' && threadSession.sessionId) {
        void setSessionHumanTakeover(threadSession.sessionId, true)
      }
    }
    return
  }

  // Not a subscribed thread - check for external participant detection (existing behavior)
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
 * Handle message in passive mode channel
 */
async function handlePassiveModeMessage(params: {
  event: SlackEvent
  channel: SlackChannelWithMode
  projectId: string
  botUserId: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
}): Promise<void> {
  const { event, channel, projectId, slackClient, supabase, teamId } = params

  if (!event.thread_ts || !event.channel || !event.ts) {
    return
  }

  if (channel.captureScope === 'all') {
    // Capture all threaded messages
    await processPassiveThreadCapture({
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
      captureMode: 'passive_all',
    })
    return
  }

  // capture_scope === 'external_only' - only capture if external participant
  // Check if user is external before capturing
  const userEmail = event.user ? await slackClient.getUserEmail(event.user) : null
  if (!userEmail || !channel.workspacePrimaryDomain) {
    return // Can't determine if external
  }

  const emailDomain = userEmail.split('@')[1]?.toLowerCase()
  const primaryDomain = channel.workspacePrimaryDomain.toLowerCase()
  const isExternal = emailDomain !== primaryDomain

  if (!isExternal) {
    return // Internal user, skip
  }

  // External user - capture the thread
  await processPassiveThreadCapture({
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
    captureMode: 'passive_external',
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
