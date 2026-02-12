/**
 * Slack Message Processor
 * Handles @mentions and message monitoring
 */

import type { CoreMessage } from 'ai'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { createAdminClient } from '@/lib/supabase/server'
import { upsertSession, updateSessionActivity } from '@/lib/supabase/sessions'
import { saveSessionMessage } from '@/lib/supabase/session-messages'
import { triggerChatRun, updateChatRunStatus, type ChatMessage } from '@/lib/agent/chat-run-service'
import { mastra } from '@/mastra'
import type { SupportAgentContext } from '@/types/agent'
import { SlackClient, type SlackMessage } from './client'
import {
  getOrCreateThreadSession,
  updateThreadSessionLastMessage,
  updateThreadSessionResponder,
  type ThreadSessionWithTracking,
} from './index'

const LOG_PREFIX = '[slack.message-processor]'

type ProcessMentionParams = {
  projectId: string
  channelId: string
  channelDbId: string
  threadTs: string
  messageTs: string
  userId?: string
  text: string
  botUserId: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
}

type ProcessMessageParams = {
  projectId: string
  channelId: string
  channelDbId: string
  threadTs: string
  messageTs: string
  userId?: string
  text: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
  workspacePrimaryDomain: string | null
}

/**
 * Generate session ID for Slack threads
 * Format: slack_{team_id}_{channel_id}_{thread_ts}
 */
function generateSlackSessionId(teamId: string, channelId: string, threadTs: string): string {
  return `slack_${teamId}_${channelId}_${threadTs.replace('.', '_')}`
}

/**
 * Remove bot mention from message text
 * Slack formats mentions as <@U12345>
 */
function removeBotMention(text: string, botUserId: string): string {
  const mentionPattern = new RegExp(`<@${botUserId}>\\s*`, 'g')
  return text.replace(mentionPattern, '').trim()
}

/**
 * Convert Slack messages to chat messages format
 */
function convertSlackMessages(
  messages: SlackMessage[],
  botUserId: string
): ChatMessage[] {
  return messages
    .filter((msg) => msg.type === 'message' && msg.text)
    .map((msg) => {
      const isBot = msg.user === botUserId || !!msg.bot_id
      return {
        role: isBot ? 'assistant' : 'user',
        content: isBot ? msg.text : removeBotMention(msg.text, botUserId),
      } as ChatMessage
    })
}

/**
 * Process @mention - triggers agent response
 */
export async function processSlackMention(params: ProcessMentionParams): Promise<void> {
  const {
    projectId,
    channelId,
    channelDbId,
    threadTs,
    messageTs,
    userId,
    text,
    botUserId,
    slackClient,
    supabase,
    teamId,
  } = params

  console.log(`${LOG_PREFIX} Processing mention`, { channelId, threadTs, userId })

  // React with :eyes: to acknowledge receipt (fire-and-forget)
  void slackClient.addReaction({ channel: channelId, timestamp: messageTs, name: 'eyes' })

  // Generate session ID
  const sessionId = generateSlackSessionId(teamId, channelId, threadTs)

  // Get user info for metadata
  let userEmail: string | null = null
  let userName: string | null = null
  let userDisplayName: string | null = null

  if (userId) {
    const userInfo = await slackClient.getUserInfo(userId)
    if (userInfo) {
      userEmail = userInfo.profile.email || userInfo.email || null
      userName = userInfo.real_name || userInfo.name || null
      userDisplayName = userInfo.profile.display_name || userInfo.display_name || null
    }
  }

  // Build user metadata
  const userMetadata: Record<string, string> = {
    slack_user_id: userId || 'unknown',
    slack_channel_id: channelId,
    slack_workspace_id: teamId,
  }
  if (userEmail) userMetadata.email = userEmail
  if (userName) userMetadata.name = userName
  if (userDisplayName) userMetadata.display_name = userDisplayName

  console.log(`${LOG_PREFIX} Session upsert`, { sessionId, userEmail, userName })

  // Upsert session (limits are enforced at analysis time, not session creation)
  await upsertSession({
    id: sessionId,
    projectId,
    userId: userEmail || userId || null,
    userMetadata,
    pageUrl: null, // No page URL for Slack
    pageTitle: `Slack: #${channelId}`,
    source: 'slack',
  })

  // Create thread session mapping
  await getOrCreateThreadSession(supabase, {
    sessionId,
    channelDbId,
    slackChannelId: channelId,
    threadTs,
    hasExternalParticipants: false, // Will be updated by message monitoring
  })

  // Fetch thread history
  const threadMessages = await slackClient.getThreadMessages(channelId, threadTs)
  console.log(`${LOG_PREFIX} Thread history fetched`, { count: threadMessages.length })

  // Convert to chat messages
  const chatMessages = convertSlackMessages(threadMessages, botUserId)

  if (chatMessages.length === 0) {
    // No valid messages, just use the mention text
    chatMessages.push({
      role: 'user',
      content: removeBotMention(text, botUserId),
    })
  }

  // Trigger chat run
  const chatRunResult = await triggerChatRun({
    projectId,
    sessionId,
    messages: chatMessages,
    userId: userEmail || userId || null,
    userMetadata,
    supabase,
  })

  if (!chatRunResult.success) {
    console.error(`${LOG_PREFIX} Failed to trigger chat run:`, chatRunResult.error)

    // If already running, let user know
    if (chatRunResult.error?.includes('already in progress')) {
      await slackClient.postMessage({
        channel: channelId,
        text: "I'm still working on a previous response. Please wait a moment!",
        threadTs,
      })
    }
    return
  }

  // Execute the agent synchronously (different from widget's SSE streaming)
  console.log(`${LOG_PREFIX} Agent execution starting`, { sessionId, chatRunId: chatRunResult.chatRunId })
  const response = await executeAgentSync({
    projectId,
    sessionId,
    chatRunId: chatRunResult.chatRunId,
    messages: chatMessages,
    userId: userEmail || userId || null,
    userMetadata,
    supabase,
  })
  console.log(`${LOG_PREFIX} Agent execution complete`, {
    sessionId,
    hasResponse: !!response,
    responseLength: response?.length ?? 0,
  })

  // Post response to Slack
  if (response) {
    // Remove the [SESSION_GOODBYE] marker if present (internal use only)
    const cleanResponse = response.replace(/\[SESSION_GOODBYE\]/g, '').trim()

    const postResult = await slackClient.postMessage({
      channel: channelId,
      text: cleanResponse,
      threadTs,
    })
    console.log(`${LOG_PREFIX} Slack message posted`, { ok: postResult.ok, ts: postResult.ts })

    // React with :white_check_mark: to indicate response posted
    void slackClient.addReaction({ channel: channelId, timestamp: messageTs, name: 'white_check_mark' })

    // Update session activity
    await updateSessionActivity(sessionId)

    // Update thread session last message ts
    await updateThreadSessionLastMessage(supabase, chatRunResult.chatRunId, messageTs)
  } else {
    await slackClient.postMessage({
      channel: channelId,
      text: "I'm sorry, I encountered an issue processing your request. Please try again.",
      threadTs,
    })
  }
}

/**
 * Execute agent synchronously (for Slack, we don't stream)
 */
async function executeAgentSync(params: {
  projectId: string
  sessionId: string
  chatRunId: string
  messages: ChatMessage[]
  userId: string | null
  userMetadata: Record<string, string> | null
  supabase: ReturnType<typeof createAdminClient>
}): Promise<string | null> {
  const { projectId, sessionId, chatRunId, messages, userId, userMetadata, supabase } = params

  try {
    // Get the support agent
    const agent = mastra.getAgent('supportAgent')
    if (!agent) {
      console.error(`${LOG_PREFIX} supportAgent not found`)
      await updateChatRunStatus({
        chatRunId,
        status: 'failed',
        errorMessage: 'Agent not available',
        supabase,
      })
      return null
    }

    // Build runtime context
    const runtimeContext = new RuntimeContext<SupportAgentContext>()
    runtimeContext.set('projectId', projectId)
    runtimeContext.set('userId', userId)
    runtimeContext.set('userMetadata', userMetadata)
    runtimeContext.set('sessionId', sessionId)

    // Convert messages to CoreMessage format
    const mastraMessages: CoreMessage[] = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // Generate response (non-streaming)
    const result = await agent.generate(mastraMessages, {
      runtimeContext,
      memory: {
        thread: sessionId,
        resource: userId || 'anonymous',
      },
    })

    // Mark as completed
    await updateChatRunStatus({
      chatRunId,
      status: 'completed',
      supabase,
    })

    return result.text || null
  } catch (error) {
    console.error(`${LOG_PREFIX} Agent execution error:`, error)

    await updateChatRunStatus({
      chatRunId,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      supabase,
    })

    return null
  }
}

/**
 * Process message for external participant detection
 * Creates session if thread has external participants
 */
export async function processSlackMessage(params: ProcessMessageParams): Promise<void> {
  const {
    projectId,
    channelId,
    channelDbId,
    threadTs,
    messageTs,
    userId,
    slackClient,
    supabase,
    teamId,
    workspacePrimaryDomain,
  } = params

  // Skip if no user or no domain to compare
  if (!userId || !workspacePrimaryDomain) {
    return
  }

  // Check if this thread is already tracked as having external participants
  const { data: existingSession } = await (supabase as any)
    .from('slack_thread_sessions')
    .select('id, has_external_participants, session_id')
    .eq('channel_id', channelDbId)
    .eq('thread_ts', threadTs)
    .single()

  if (existingSession?.has_external_participants) {
    // Already tracking this thread, just update last message
    await updateThreadSessionLastMessage(supabase, existingSession.id, messageTs)
    return
  }

  // Get user email to check domain
  const userEmail = await slackClient.getUserEmail(userId)

  if (!userEmail) {
    return // Can't determine if external
  }

  // Extract email domain
  const emailDomain = userEmail.split('@')[1]?.toLowerCase()
  const primaryDomain = workspacePrimaryDomain.toLowerCase()

  // Check if external
  const isExternal = emailDomain && emailDomain !== primaryDomain

  if (!isExternal) {
    return // Internal user, skip
  }

  console.log(`${LOG_PREFIX} Detected external participant`, {
    channelId,
    threadTs,
    userId,
    emailDomain,
    primaryDomain,
  })

  // Generate session ID
  const sessionId = generateSlackSessionId(teamId, channelId, threadTs)

  // Get user info for metadata
  const userInfo = await slackClient.getUserInfo(userId)

  const userMetadata: Record<string, string> = {
    slack_user_id: userId,
    slack_channel_id: channelId,
    slack_workspace_id: teamId,
    is_external: 'true',
  }
  if (userEmail) userMetadata.email = userEmail
  if (userInfo?.real_name) userMetadata.name = userInfo.real_name
  if (userInfo?.profile.display_name) userMetadata.display_name = userInfo.profile.display_name

  // Upsert session with external participant info (limits are enforced at analysis time)
  await upsertSession({
    id: sessionId,
    projectId,
    userId: userEmail,
    userMetadata,
    pageUrl: null,
    pageTitle: `Slack: External conversation`,
    source: 'slack',
  })

  // Create or update thread session
  if (existingSession) {
    // Update existing session to mark as external
    await (supabase as any)
      .from('slack_thread_sessions')
      .update({
        has_external_participants: true,
        last_message_ts: messageTs,
      })
      .eq('id', existingSession.id)
  } else {
    // Create new thread session
    await getOrCreateThreadSession(supabase, {
      sessionId,
      channelDbId,
      slackChannelId: channelId,
      threadTs,
      hasExternalParticipants: true,
    })
  }
}

type ProcessPassiveThreadCaptureParams = {
  projectId: string
  channelId: string
  channelDbId: string
  threadTs: string
  messageTs: string
  userId?: string
  text: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
  workspacePrimaryDomain?: string | null
  captureMode: 'passive_mention' | 'passive_all' | 'passive_external'
}

/**
 * Process passive thread capture - creates session without bot response
 * Used in passive mode to capture threads silently
 */
export async function processPassiveThreadCapture(
  params: ProcessPassiveThreadCaptureParams
): Promise<void> {
  const {
    projectId,
    channelId,
    channelDbId,
    threadTs,
    messageTs,
    userId,
    text,
    slackClient,
    supabase,
    teamId,
    workspacePrimaryDomain,
    captureMode,
  } = params

  console.log(`${LOG_PREFIX} Processing passive thread capture`, {
    channelId,
    threadTs,
    userId,
    captureMode,
  })

  // Generate session ID
  const sessionId = generateSlackSessionId(teamId, channelId, threadTs)

  // Check if thread session already exists
  const { data: existingSession } = await (supabase as any)
    .from('slack_thread_sessions')
    .select('id, session_id')
    .eq('channel_id', channelDbId)
    .eq('thread_ts', threadTs)
    .single()

  if (existingSession) {
    // Thread already being tracked, just update last message timestamp
    await updateThreadSessionLastMessage(supabase, existingSession.id, messageTs)
    return
  }

  // Get user info for metadata
  let userEmail: string | null = null
  let userName: string | null = null
  let userDisplayName: string | null = null
  let isExternal = false

  if (userId) {
    const userInfo = await slackClient.getUserInfo(userId)
    if (userInfo) {
      userEmail = userInfo.profile.email || userInfo.email || null
      userName = userInfo.real_name || userInfo.name || null
      userDisplayName = userInfo.profile.display_name || userInfo.display_name || null

      // Check if external
      if (userEmail && workspacePrimaryDomain) {
        const emailDomain = userEmail.split('@')[1]?.toLowerCase()
        isExternal = emailDomain !== workspacePrimaryDomain.toLowerCase()
      }
    }
  }

  // Build user metadata
  const userMetadata: Record<string, string> = {
    slack_user_id: userId || 'unknown',
    slack_channel_id: channelId,
    slack_workspace_id: teamId,
    capture_mode: captureMode,
  }
  if (userEmail) userMetadata.email = userEmail
  if (userName) userMetadata.name = userName
  if (userDisplayName) userMetadata.display_name = userDisplayName
  if (isExternal) userMetadata.is_external = 'true'

  // Create session
  await upsertSession({
    id: sessionId,
    projectId,
    userId: userEmail || userId || null,
    userMetadata,
    pageUrl: null,
    pageTitle: `Slack: #${channelId} (passive)`,
    source: 'slack',
  })

  // Create thread session mapping
  const threadSessionResult = await getOrCreateThreadSession(supabase, {
    sessionId,
    channelDbId,
    slackChannelId: channelId,
    threadTs,
    hasExternalParticipants: isExternal,
  })

  // Update last message timestamp
  if (threadSessionResult) {
    await updateThreadSessionLastMessage(supabase, threadSessionResult.id, messageTs)
  }
}

type ProcessSlackThreadResponseParams = {
  projectId: string
  channelId: string
  channelDbId: string
  threadTs: string
  messageTs: string
  userId?: string
  text: string
  botUserId: string
  slackClient: SlackClient
  supabase: ReturnType<typeof createAdminClient>
  teamId: string
  threadSession: ThreadSessionWithTracking
}

/**
 * Process thread response - triggers agent response for subscribed threads
 * Used in interactive mode when bot should respond to a thread message
 */
export async function processSlackThreadResponse(
  params: ProcessSlackThreadResponseParams
): Promise<void> {
  const {
    projectId,
    channelId,
    threadTs,
    messageTs,
    userId,
    text,
    botUserId,
    slackClient,
    supabase,
    threadSession,
  } = params

  const sessionId = threadSession.sessionId

  console.log(`${LOG_PREFIX} Processing thread response`, { channelId, threadTs, userId, sessionId })

  // React with :eyes: to acknowledge receipt (fire-and-forget)
  void slackClient.addReaction({ channel: channelId, timestamp: messageTs, name: 'eyes' })

  // Get user info for metadata
  let userEmail: string | null = null
  let userName: string | null = null
  let userDisplayName: string | null = null

  if (userId) {
    const userInfo = await slackClient.getUserInfo(userId)
    if (userInfo) {
      userEmail = userInfo.profile.email || userInfo.email || null
      userName = userInfo.real_name || userInfo.name || null
      userDisplayName = userInfo.profile.display_name || userInfo.display_name || null
    }
  }

  // Build user metadata
  const userMetadata: Record<string, string> = {
    slack_user_id: userId || 'unknown',
    slack_channel_id: channelId,
  }
  if (userEmail) userMetadata.email = userEmail
  if (userName) userMetadata.name = userName
  if (userDisplayName) userMetadata.display_name = userDisplayName

  // Fetch thread history
  const threadMessages = await slackClient.getThreadMessages(channelId, threadTs)
  console.log(`${LOG_PREFIX} Thread response history fetched`, { count: threadMessages.length })

  // Convert to chat messages
  const chatMessages = convertSlackMessages(threadMessages, botUserId)

  if (chatMessages.length === 0) {
    chatMessages.push({
      role: 'user',
      content: removeBotMention(text, botUserId),
    })
  }

  // Trigger chat run
  const chatRunResult = await triggerChatRun({
    projectId,
    sessionId,
    messages: chatMessages,
    userId: userEmail || userId || null,
    userMetadata,
    supabase,
  })

  if (!chatRunResult.success) {
    console.error(`${LOG_PREFIX} Failed to trigger chat run:`, chatRunResult.error)

    if (chatRunResult.error?.includes('already in progress')) {
      await slackClient.postMessage({
        channel: channelId,
        text: "I'm still working on a previous response. Please wait a moment!",
        threadTs,
      })
    }
    return
  }

  // Execute the agent synchronously
  console.log(`${LOG_PREFIX} Thread response agent execution starting`, { sessionId, chatRunId: chatRunResult.chatRunId })
  const response = await executeAgentSync({
    projectId,
    sessionId,
    chatRunId: chatRunResult.chatRunId,
    messages: chatMessages,
    userId: userEmail || userId || null,
    userMetadata,
    supabase,
  })
  console.log(`${LOG_PREFIX} Thread response agent execution complete`, {
    sessionId,
    hasResponse: !!response,
    responseLength: response?.length ?? 0,
  })

  // Post response to Slack
  if (response) {
    const cleanResponse = response.replace(/\[SESSION_GOODBYE\]/g, '').trim()

    const postResult = await slackClient.postMessage({
      channel: channelId,
      text: cleanResponse,
      threadTs,
    })
    console.log(`${LOG_PREFIX} Thread response posted`, { ok: postResult.ok, ts: postResult.ts })

    // React with :white_check_mark: to indicate response posted
    void slackClient.addReaction({ channel: channelId, timestamp: messageTs, name: 'white_check_mark' })

    // Update session activity
    await updateSessionActivity(sessionId)

    // Update thread session tracking - mark bot as last responder
    await updateThreadSessionResponder(
      supabase,
      threadSession.id,
      'bot',
      postResult?.ts || messageTs
    )
  } else {
    await slackClient.postMessage({
      channel: channelId,
      text: "I'm sorry, I encountered an issue processing your request. Please try again.",
      threadTs,
    })
  }
}

type HandleHumanAgentReplyParams = {
  sessionId: string
  projectId: string
  text: string
  slackClient: SlackClient
  channelId: string
  threadTs: string
}

/**
 * Process a human agent's Slack DM reply and save to session.
 * The message will be saved as a human_agent message and delivered to the customer widget.
 */
export async function handleHumanAgentReply(
  params: HandleHumanAgentReplyParams
): Promise<void> {
  const { sessionId, projectId, text, slackClient, channelId, threadTs } = params

  console.log(`${LOG_PREFIX} Processing human agent reply`, { sessionId, projectId })

  // Save to session_messages as human_agent
  const savedMessage = await saveSessionMessage({
    sessionId,
    projectId,
    senderType: 'human_agent',
    content: text,
  })

  if (!savedMessage) {
    console.error(`${LOG_PREFIX} Failed to save human agent message`)
    await slackClient.postMessage({
      channel: channelId,
      threadTs,
      text: 'Failed to send message to customer. Please try again.',
    })
    return
  }

  // Update session activity
  await updateSessionActivity(sessionId)

  // Confirm in Slack thread
  await slackClient.postMessage({
    channel: channelId,
    threadTs,
    text: '\u2713 Message sent to customer',
  })

  console.log(`${LOG_PREFIX} Human agent reply saved and confirmed`, { sessionId })
}
