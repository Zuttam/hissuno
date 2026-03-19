/**
 * Slack Message Processor
 * Handles @mentions and message monitoring
 */

import type { ModelMessage } from 'ai'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { slackThreadSessions, projectSettings, projects } from '@/lib/db/schema/app'
import { sessions } from '@/lib/db/schema/app'
import { upsertSession, updateSessionActivity } from '@/lib/db/queries/sessions'
import { saveSessionMessage } from '@/lib/db/queries/session-messages'
import { triggerChatRun, updateChatRunStatus, type ChatMessage } from '@/lib/agent/chat-run-service'
import { generateWidgetJWT } from '@/lib/utils/widget-auth'
import type { SupportAgentContext } from '@/types/agent'
import { resolveAgent } from '@/mastra/agents/router'
import { getSupportAgentSettingsAdmin } from '@/lib/db/queries/project-settings/support-agent'
import { resolveContactForSession } from '@/lib/customers/contact-resolution'
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
  teamId: string
  workspacePrimaryDomain: string | null
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
 * Resolve Slack user mentions (<@U12345>) to readable names.
 * Replaces mentions with "@RealName (email)" or "@RealName" if no email.
 * Skips the bot's own mention (already handled by removeBotMention).
 */
async function resolveUserMentions(
  text: string,
  botUserId: string,
  slackClient: SlackClient
): Promise<string> {
  const mentionPattern = /<@(U[A-Z0-9]+)>/g
  const matches = [...text.matchAll(mentionPattern)]
  if (matches.length === 0) return text

  const cache = new Map<string, string>()
  let resolved = text

  for (const match of matches) {
    const mentionUserId = match[1]
    if (mentionUserId === botUserId) continue
    if (cache.has(mentionUserId)) {
      resolved = resolved.replace(match[0], cache.get(mentionUserId)!)
      continue
    }

    const userInfo = await slackClient.getUserInfo(mentionUserId)
    let replacement: string
    if (userInfo) {
      const name = userInfo.real_name || userInfo.name || mentionUserId
      const email = userInfo.profile.email || userInfo.email || null
      replacement = email ? `@${name} (${email})` : `@${name}`
    } else {
      replacement = `@${mentionUserId}`
    }
    cache.set(mentionUserId, replacement)
    resolved = resolved.replace(match[0], replacement)
  }

  return resolved
}

/**
 * Schedule session close after goodbye detection.
 * Matches the widget behavior in widget/chat/stream/route.ts.
 */
async function scheduleSessionClose(
  sessionId: string,
  projectId: string
): Promise<void> {
  // Get project goodbye delay (default 90s)
  let goodbyeDelaySeconds = 90
  const settingsRows = await db
    .select({ session_goodbye_delay_seconds: projectSettings.session_goodbye_delay_seconds })
    .from(projectSettings)
    .where(eq(projectSettings.project_id, projectId))

  const settings = settingsRows[0]
  if (settings?.session_goodbye_delay_seconds) {
    goodbyeDelaySeconds = settings.session_goodbye_delay_seconds
  }

  const scheduledCloseAt = new Date(Date.now() + goodbyeDelaySeconds * 1000)
  await db
    .update(sessions)
    .set({
      status: 'closing_soon',
      goodbye_detected_at: new Date(),
      scheduled_close_at: scheduledCloseAt,
    })
    .where(eq(sessions.id, sessionId))

  console.log(`${LOG_PREFIX} Session goodbye scheduled`, {
    sessionId,
    goodbyeDelaySeconds,
    scheduledCloseAt: scheduledCloseAt.toISOString(),
  })
}

/**
 * Determine whether a Slack user is external (contact mode) or internal (team member mode).
 * Returns a contactId for external users, or null for internal/unknown users.
 */
async function determineSlackContactId(params: {
  projectId: string
  sessionId: string
  userEmail: string | null
  workspacePrimaryDomain: string | null
  userMetadata: Record<string, string>
}): Promise<string | null> {
  const { projectId, sessionId, userEmail, workspacePrimaryDomain, userMetadata } = params

  // Can't determine externality -> default to user mode (trusted)
  if (!userEmail || !workspacePrimaryDomain) return null

  const emailDomain = userEmail.split('@')[1]?.toLowerCase()
  const isExternal = emailDomain && emailDomain !== workspacePrimaryDomain.toLowerCase()

  if (!isExternal) return null // Internal -> team member mode

  // External -> resolve contact for scoped access
  const result = await resolveContactForSession({ projectId, sessionId, userMetadata })
  return result.contactId // May be null if resolution fails; falls back to user mode
}

/**
 * Shared helper that handles the common agent interaction flow for both
 * processSlackMention and processSlackThreadResponse.
 */
type RunSlackAgentInteractionParams = {
  projectId: string
  channelId: string
  threadTs: string
  messageTs: string
  userId?: string
  text: string
  botUserId: string
  slackClient: SlackClient
  teamId: string
  sessionId: string
  workspacePrimaryDomain: string | null
  onResponsePosted?: (responseTs: string) => Promise<void>
}

async function runSlackAgentInteraction(params: RunSlackAgentInteractionParams): Promise<void> {
  const {
    projectId,
    channelId,
    threadTs,
    messageTs,
    userId,
    text,
    botUserId,
    slackClient,
    teamId,
    sessionId,
    workspacePrimaryDomain,
    onResponsePosted,
  } = params

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

  // Determine contact mode (external) vs user mode (internal)
  const contactId = await determineSlackContactId({
    projectId,
    sessionId,
    userEmail,
    workspacePrimaryDomain,
    userMetadata,
  })

  console.log(`${LOG_PREFIX} Contact mode resolved`, { sessionId, contactId, userEmail })

  // Fetch thread history
  const threadMessages = await slackClient.getThreadMessages(channelId, threadTs)
  console.log(`${LOG_PREFIX} Thread history fetched`, { count: threadMessages.length })

  // Convert to chat messages
  const chatMessages = convertSlackMessages(threadMessages, botUserId)

  if (chatMessages.length === 0) {
    chatMessages.push({
      role: 'user',
      content: removeBotMention(text, botUserId),
    })
  }

  // Resolve @user mentions to readable names in user messages
  for (const msg of chatMessages) {
    if (msg.role === 'user') {
      msg.content = await resolveUserMentions(msg.content, botUserId, slackClient)
    }
  }

  // Save the latest user message to session_messages
  const lastUserMessage = chatMessages[chatMessages.length - 1]
  if (lastUserMessage?.role === 'user') {
    void saveSessionMessage({
      sessionId,
      projectId,
      senderType: 'user',
      content: lastUserMessage.content,
    })
  }

  // Trigger chat run
  const chatRunResult = await triggerChatRun({
    projectId,
    sessionId,
    messages: chatMessages,
    userId: userEmail || userId || null,
    userMetadata,
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

  // Execute the agent synchronously (different from widget's SSE streaming)
  console.log(`${LOG_PREFIX} Agent execution starting`, { sessionId, chatRunId: chatRunResult.chatRunId })
  const response = await executeAgentSync({
    projectId,
    sessionId,
    chatRunId: chatRunResult.chatRunId,
    messages: chatMessages,
    userId: userEmail || userId || null,
    userMetadata,
    contactId,
  })
  console.log(`${LOG_PREFIX} Agent execution complete`, {
    sessionId,
    hasResponse: !!response,
    responseLength: response?.length ?? 0,
  })

  // Post response to Slack
  if (response) {
    const cleanResponse = response.replace(/\[SESSION_GOODBYE\]/g, '').trim()

    void saveSessionMessage({
      sessionId,
      projectId,
      senderType: 'ai',
      content: cleanResponse,
    })

    if (response.includes('[SESSION_GOODBYE]')) {
      void scheduleSessionClose(sessionId, projectId)
    }

    const postResult = await slackClient.postMessage({
      channel: channelId,
      text: cleanResponse,
      threadTs,
    })
    console.log(`${LOG_PREFIX} Slack message posted`, { ok: postResult.ok, ts: postResult.ts })

    // Remove :eyes: thinking indicator, add :white_check_mark: to indicate done
    void slackClient.removeReaction({ channel: channelId, timestamp: messageTs, name: 'eyes' })
    void slackClient.addReaction({ channel: channelId, timestamp: messageTs, name: 'white_check_mark' })

    await updateSessionActivity(sessionId)

    if (onResponsePosted) {
      await onResponsePosted(postResult?.ts || messageTs)
    }
  } else {
    // Remove :eyes: on error too
    void slackClient.removeReaction({ channel: channelId, timestamp: messageTs, name: 'eyes' })
    await slackClient.postMessage({
      channel: channelId,
      text: "I'm sorry, I encountered an issue processing your request. Please try again.",
      threadTs,
    })
  }
}

/**
 * Process @mention - creates session and triggers agent response
 */
export async function processSlackMention(params: ProcessMentionParams): Promise<void> {
  const { projectId, channelId, channelDbId, threadTs, messageTs, userId, text, botUserId, slackClient, teamId, workspacePrimaryDomain } = params

  console.log(`${LOG_PREFIX} Processing mention`, { channelId, threadTs, userId })

  // React with :eyes: to acknowledge receipt (fire-and-forget)
  void slackClient.addReaction({ channel: channelId, timestamp: messageTs, name: 'eyes' })

  const sessionId = generateSlackSessionId(teamId, channelId, threadTs)

  // Upsert session (limits are enforced at analysis time, not session creation)
  await upsertSession({
    id: sessionId,
    projectId,
    userId: userId || null,
    userMetadata: { slack_user_id: userId || 'unknown', slack_channel_id: channelId, slack_workspace_id: teamId },
    pageUrl: null,
    pageTitle: `Slack: #${channelId}`,
    source: 'slack',
  })

  // Create thread session mapping
  const threadSession = await getOrCreateThreadSession({
    sessionId,
    channelDbId,
    slackChannelId: channelId,
    threadTs,
    hasExternalParticipants: false, // Will be updated by message monitoring
  })

  await runSlackAgentInteraction({
    projectId,
    channelId,
    threadTs,
    messageTs,
    userId,
    text,
    botUserId,
    slackClient,
    teamId,
    sessionId,
    workspacePrimaryDomain,
    onResponsePosted: threadSession
      ? async (responseTs: string) => {
          await updateThreadSessionResponder(threadSession.id, 'bot', responseTs)
        }
      : undefined,
  })
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
  contactId: string | null
}): Promise<string | null> {
  const { projectId, sessionId, chatRunId, messages, userId, userMetadata, contactId } = params

  try {
    // Load knowledge package ID from project settings
    let knowledgePackageId: string | null = null
    try {
      const agentSettings = await getSupportAgentSettingsAdmin(projectId)
      knowledgePackageId = agentSettings.support_agent_package_id
    } catch (err) {
      console.warn(`${LOG_PREFIX} Failed to load agent settings for knowledge:`, err)
    }

    // Resolve agent via router (support or PM based on contactId)
    const { agent, systemMessages } = await resolveAgent({
      contactId,
      knowledgePackageId,
      projectId,
    })

    // Build runtime context
    const runtimeContext = new RuntimeContext<SupportAgentContext>()
    runtimeContext.set('projectId', projectId)
    runtimeContext.set('userId', userId)
    runtimeContext.set('userMetadata', userMetadata)
    runtimeContext.set('sessionId', sessionId)
    runtimeContext.set('knowledgePackageId', knowledgePackageId)

    // Generate contact JWT for MCP contact-mode auth (if we have an email)
    let contactToken: string | null = null
    const email = userMetadata?.email ?? userId
    if (email && email.includes('@')) {
      const projectRows = await db
        .select({ secret_key: projects.secret_key })
        .from(projects)
        .where(eq(projects.id, projectId))

      const project = projectRows[0]

      if (project?.secret_key) {
        contactToken = generateWidgetJWT(
          { userId: email, userMetadata: userMetadata ?? undefined },
          project.secret_key
        )
      }
    }
    runtimeContext.set('contactToken', contactToken)
    runtimeContext.set('contactId', contactId)

    // Convert messages to ModelMessage format, with knowledge prepended
    const mastraMessages: ModelMessage[] = [
      ...systemMessages,
      ...messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ]

    // Generate response -- tools are baked into the agent
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
    })

    return result.text || null
  } catch (error) {
    console.error(`${LOG_PREFIX} Agent execution error:`, error)

    await updateChatRunStatus({
      chatRunId,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
    teamId,
    workspacePrimaryDomain,
  } = params

  // Skip if no user or no domain to compare
  if (!userId || !workspacePrimaryDomain) {
    return
  }

  // Check if this thread is already tracked as having external participants
  const existingRows = await db
    .select({
      id: slackThreadSessions.id,
      has_external_participants: slackThreadSessions.has_external_participants,
      session_id: slackThreadSessions.session_id,
    })
    .from(slackThreadSessions)
    .where(
      and(
        eq(slackThreadSessions.channel_id, channelDbId),
        eq(slackThreadSessions.thread_ts, threadTs)
      )
    )

  const existingSession = existingRows[0]

  if (existingSession?.has_external_participants) {
    // Already tracking this thread, just update last message
    await updateThreadSessionLastMessage(existingSession.id, messageTs)
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
    await db
      .update(slackThreadSessions)
      .set({
        has_external_participants: true,
        last_message_ts: messageTs,
      })
      .where(eq(slackThreadSessions.id, existingSession.id))
  } else {
    // Create new thread session
    await getOrCreateThreadSession({
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
  const existingRows = await db
    .select({ id: slackThreadSessions.id, session_id: slackThreadSessions.session_id })
    .from(slackThreadSessions)
    .where(
      and(
        eq(slackThreadSessions.channel_id, channelDbId),
        eq(slackThreadSessions.thread_ts, threadTs)
      )
    )

  const existingSession = existingRows[0]

  if (existingSession) {
    // Thread already being tracked, just update last message timestamp
    await updateThreadSessionLastMessage(existingSession.id, messageTs)
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
  const threadSessionResult = await getOrCreateThreadSession({
    sessionId,
    channelDbId,
    slackChannelId: channelId,
    threadTs,
    hasExternalParticipants: isExternal,
  })

  // Update last message timestamp
  if (threadSessionResult) {
    await updateThreadSessionLastMessage(threadSessionResult.id, messageTs)
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
  teamId: string
  threadSession: ThreadSessionWithTracking
  workspacePrimaryDomain: string | null
}

/**
 * Process thread response - triggers agent response for subscribed threads
 * Used in interactive mode when bot should respond to a thread message
 */
export async function processSlackThreadResponse(
  params: ProcessSlackThreadResponseParams
): Promise<void> {
  const { projectId, channelId, threadTs, messageTs, userId, text, botUserId, slackClient, teamId, threadSession, workspacePrimaryDomain } = params

  const sessionId = threadSession.sessionId

  console.log(`${LOG_PREFIX} Processing thread response`, { channelId, threadTs, userId, sessionId })

  // React with :eyes: to acknowledge receipt (fire-and-forget)
  void slackClient.addReaction({ channel: channelId, timestamp: messageTs, name: 'eyes' })

  await runSlackAgentInteraction({
    projectId,
    channelId,
    threadTs,
    messageTs,
    userId,
    text,
    botUserId,
    slackClient,
    teamId,
    sessionId,
    workspacePrimaryDomain,
    onResponsePosted: async (responseTs: string) => {
      await updateThreadSessionResponder(threadSession.id, 'bot', responseTs)
    },
  })
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
