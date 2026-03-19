import crypto from 'crypto'
import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { slackWorkspaceTokens, slackChannels, slackThreadSessions, sessions } from '@/lib/db/schema/app'

/**
 * Slack workspace token record from database
 */
export type SlackWorkspaceToken = {
  id: string
  project_id: string
  workspace_id: string
  workspace_name: string | null
  workspace_domain: string | null
  bot_token: string
  bot_user_id: string
  installed_by_user_id: string | null
  installed_by_email: string | null
  scope: string | null
  created_at: Date | null
  updated_at: Date | null
}

/**
 * Slack integration status
 */
export type SlackIntegrationStatus = {
  connected: boolean
  workspaceId: string | null
  workspaceName: string | null
  workspaceDomain: string | null
  installedByEmail: string | null
}

/**
 * Verify Slack request signature using HMAC-SHA256
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
  // Check timestamp is within 5 minutes to prevent replay attacks
  const currentTime = Math.floor(Date.now() / 1000)
  const requestTime = parseInt(timestamp, 10)
  if (Math.abs(currentTime - requestTime) > 60 * 5) {
    console.warn('[slack.verifyRequest] Request timestamp too old')
    return false
  }

  // Create signature base string
  const sigBase = `v0:${timestamp}:${body}`

  // Generate HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', signingSecret)
  hmac.update(sigBase)
  const mySignature = `v0=${hmac.digest('hex')}`

  // Compare signatures using timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    )
  } catch {
    return false
  }
}

/**
 * Check if a project has Slack integration connected
 */
export async function hasSlackIntegration(
  projectId: string
): Promise<SlackIntegrationStatus> {
  const rows = await db
    .select({
      workspace_id: slackWorkspaceTokens.workspace_id,
      workspace_name: slackWorkspaceTokens.workspace_name,
      workspace_domain: slackWorkspaceTokens.workspace_domain,
      installed_by_email: slackWorkspaceTokens.installed_by_email,
    })
    .from(slackWorkspaceTokens)
    .where(eq(slackWorkspaceTokens.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return {
      connected: false,
      workspaceId: null,
      workspaceName: null,
      workspaceDomain: null,
      installedByEmail: null,
    }
  }

  return {
    connected: true,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name,
    workspaceDomain: data.workspace_domain,
    installedByEmail: data.installed_by_email,
  }
}

/**
 * Get the Slack bot token for a workspace
 */
export async function getSlackBotToken(
  workspaceId: string
): Promise<{ token: string; botUserId: string; projectId: string } | null> {
  const rows = await db
    .select({
      bot_token: slackWorkspaceTokens.bot_token,
      bot_user_id: slackWorkspaceTokens.bot_user_id,
      project_id: slackWorkspaceTokens.project_id,
    })
    .from(slackWorkspaceTokens)
    .where(eq(slackWorkspaceTokens.workspace_id, workspaceId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    token: data.bot_token,
    botUserId: data.bot_user_id,
    projectId: data.project_id,
  }
}

/**
 * Get the Slack bot token by project ID
 */
export async function getSlackBotTokenByProject(
  projectId: string
): Promise<{ token: string; botUserId: string; workspaceId: string } | null> {
  const rows = await db
    .select({
      bot_token: slackWorkspaceTokens.bot_token,
      bot_user_id: slackWorkspaceTokens.bot_user_id,
      workspace_id: slackWorkspaceTokens.workspace_id,
    })
    .from(slackWorkspaceTokens)
    .where(eq(slackWorkspaceTokens.project_id, projectId))

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    token: data.bot_token,
    botUserId: data.bot_user_id,
    workspaceId: data.workspace_id,
  }
}

/**
 * Disconnect Slack integration for a project
 */
export async function disconnectSlack(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(slackWorkspaceTokens)
      .where(eq(slackWorkspaceTokens.project_id, projectId))

    return { success: true }
  } catch (error) {
    console.error('[slack.disconnectSlack] Failed to delete token:', error)
    return { success: false, error: 'Failed to disconnect Slack.' }
  }
}

/**
 * Store Slack OAuth tokens after successful authorization
 */
export async function storeSlackToken(
  params: {
    projectId: string
    workspaceId: string
    workspaceName: string | null
    workspaceDomain: string | null
    botToken: string
    botUserId: string
    installedByUserId: string | null
    installedByEmail: string | null
    scope: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .insert(slackWorkspaceTokens)
      .values({
        project_id: params.projectId,
        workspace_id: params.workspaceId,
        workspace_name: params.workspaceName,
        workspace_domain: params.workspaceDomain,
        bot_token: params.botToken,
        bot_user_id: params.botUserId,
        installed_by_user_id: params.installedByUserId,
        installed_by_email: params.installedByEmail,
        scope: params.scope,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: slackWorkspaceTokens.project_id,
        set: {
          workspace_id: params.workspaceId,
          workspace_name: params.workspaceName,
          workspace_domain: params.workspaceDomain,
          bot_token: params.botToken,
          bot_user_id: params.botUserId,
          installed_by_user_id: params.installedByUserId,
          installed_by_email: params.installedByEmail,
          scope: params.scope,
          updated_at: new Date(),
        },
      })

    return { success: true }
  } catch (error) {
    console.error('[slack.storeSlackToken] Failed to store token:', error)
    return { success: false, error: 'Failed to store Slack token.' }
  }
}

/**
 * Get or create a Slack channel record
 */
export async function getOrCreateSlackChannel(
  params: {
    workspaceTokenId: string
    channelId: string
    channelName: string | null
    channelType: 'channel' | 'private_channel' | 'im' | 'mpim'
    workspacePrimaryDomain: string | null
  }
): Promise<{ id: string } | null> {
  // Try to get existing channel (including soft-deleted ones)
  const existingRows = await db
    .select({ id: slackChannels.id, is_active: slackChannels.is_active })
    .from(slackChannels)
    .where(
      and(
        eq(slackChannels.workspace_token_id, params.workspaceTokenId),
        eq(slackChannels.channel_id, params.channelId)
      )
    )

  const existing = existingRows[0]

  if (existing) {
    if (existing.is_active === false) {
      // Reactivate soft-deleted channel and refresh metadata
      console.log('[slack.getOrCreateSlackChannel] Reactivating soft-deleted channel', {
        channelId: params.channelId,
        channelName: params.channelName,
      })
      await db
        .update(slackChannels)
        .set({
          is_active: true,
          channel_name: params.channelName,
          workspace_primary_domain: params.workspacePrimaryDomain,
        })
        .where(eq(slackChannels.id, existing.id))
    }
    return { id: existing.id }
  }

  // Create new channel record
  try {
    const inserted = await db
      .insert(slackChannels)
      .values({
        workspace_token_id: params.workspaceTokenId,
        channel_id: params.channelId,
        channel_name: params.channelName,
        channel_type: params.channelType,
        workspace_primary_domain: params.workspacePrimaryDomain,
      })
      .returning({ id: slackChannels.id })

    const data = inserted[0]
    if (!data) {
      console.error('[slack.getOrCreateSlackChannel] Insert returned no data')
      return null
    }

    console.log('[slack.getOrCreateSlackChannel] Created new channel record', {
      id: data.id,
      channelId: params.channelId,
      channelName: params.channelName,
    })

    return { id: data.id }
  } catch (error) {
    console.error('[slack.getOrCreateSlackChannel] Failed:', error)
    return null
  }
}

/**
 * Get Slack channel by workspace and channel ID
 */
export async function getSlackChannel(
  workspaceId: string,
  channelId: string
): Promise<{ id: string; workspaceTokenId: string; workspacePrimaryDomain: string | null } | null> {
  const rows = await db
    .select({
      id: slackChannels.id,
      workspace_primary_domain: slackChannels.workspace_primary_domain,
      workspace_token_id: slackChannels.workspace_token_id,
    })
    .from(slackChannels)
    .innerJoin(
      slackWorkspaceTokens,
      eq(slackChannels.workspace_token_id, slackWorkspaceTokens.id)
    )
    .where(
      and(
        eq(slackWorkspaceTokens.workspace_id, workspaceId),
        eq(slackChannels.channel_id, channelId)
      )
    )

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    id: data.id,
    workspaceTokenId: data.workspace_token_id,
    workspacePrimaryDomain: data.workspace_primary_domain,
  }
}

/**
 * Get or create a thread session mapping
 */
export async function getOrCreateThreadSession(
  params: {
    sessionId: string
    channelDbId: string
    slackChannelId: string
    threadTs: string
    hasExternalParticipants: boolean
  }
): Promise<{ id: string; isNew: boolean } | null> {
  // Try to get existing thread session
  const existingRows = await db
    .select({ id: slackThreadSessions.id })
    .from(slackThreadSessions)
    .where(
      and(
        eq(slackThreadSessions.channel_id, params.channelDbId),
        eq(slackThreadSessions.thread_ts, params.threadTs)
      )
    )

  const existing = existingRows[0]

  if (existing) {
    return { id: existing.id, isNew: false }
  }

  // Create new thread session
  try {
    const inserted = await db
      .insert(slackThreadSessions)
      .values({
        session_id: params.sessionId,
        channel_id: params.channelDbId,
        slack_channel_id: params.slackChannelId,
        thread_ts: params.threadTs,
        has_external_participants: params.hasExternalParticipants,
      })
      .returning({ id: slackThreadSessions.id })

    const data = inserted[0]
    if (!data) {
      console.error('[slack.getOrCreateThreadSession] Insert returned no data')
      return null
    }

    return { id: data.id, isNew: true }
  } catch (error) {
    console.error('[slack.getOrCreateThreadSession] Failed:', error)
    return null
  }
}

/**
 * Update thread session's last message timestamp
 */
export async function updateThreadSessionLastMessage(
  threadSessionId: string,
  lastMessageTs: string
): Promise<void> {
  await db
    .update(slackThreadSessions)
    .set({ last_message_ts: lastMessageTs })
    .where(eq(slackThreadSessions.id, threadSessionId))
}

/**
 * Get OAuth authorization URL for Slack
 */
export function getSlackOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scopes: string[]
}): string {
  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('scope', params.scopes.join(','))
  return url.toString()
}

/**
 * Default OAuth scopes for Slack integration
 */
export const SLACK_OAUTH_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'channels:join',
  'channels:read',
  'chat:write',
  'groups:history',
  'groups:read',
  'reactions:write',
  'users:read',
  'users:read.email',
]

/**
 * Channel mode types
 */
export type ChannelMode = 'interactive' | 'passive'
export type CaptureScope = 'external_only' | 'all'

/**
 * Slack channel with mode information
 */
export type SlackChannelWithMode = {
  id: string
  channelId: string
  channelName: string | null
  channelType: string
  channelMode: ChannelMode
  captureScope: CaptureScope
  workspaceTokenId: string
  workspacePrimaryDomain: string | null
}

/**
 * Get Slack channel with mode information
 */
export async function getSlackChannelWithMode(
  workspaceId: string,
  channelId: string
): Promise<SlackChannelWithMode | null> {
  const rows = await db
    .select({
      id: slackChannels.id,
      channel_id: slackChannels.channel_id,
      channel_name: slackChannels.channel_name,
      channel_type: slackChannels.channel_type,
      channel_mode: slackChannels.channel_mode,
      capture_scope: slackChannels.capture_scope,
      workspace_token_id: slackChannels.workspace_token_id,
      workspace_primary_domain: slackChannels.workspace_primary_domain,
    })
    .from(slackChannels)
    .innerJoin(
      slackWorkspaceTokens,
      eq(slackChannels.workspace_token_id, slackWorkspaceTokens.id)
    )
    .where(
      and(
        eq(slackWorkspaceTokens.workspace_id, workspaceId),
        eq(slackChannels.channel_id, channelId)
      )
    )

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    id: data.id,
    channelId: data.channel_id,
    channelName: data.channel_name,
    channelType: data.channel_type || 'channel',
    channelMode: (data.channel_mode as ChannelMode) || 'interactive',
    captureScope: (data.capture_scope as CaptureScope) || 'external_only',
    workspaceTokenId: data.workspace_token_id,
    workspacePrimaryDomain: data.workspace_primary_domain,
  }
}

/**
 * Thread session with response tracking
 */
export type ThreadSessionWithTracking = {
  id: string
  sessionId: string
  lastResponderType: 'bot' | 'user' | null
  lastBotResponseTs: string | null
  hasExternalParticipants: boolean
}

/**
 * Get thread session for response tracking
 */
export async function getThreadSession(
  channelDbId: string,
  threadTs: string
): Promise<ThreadSessionWithTracking | null> {
  const rows = await db
    .select({
      id: slackThreadSessions.id,
      session_id: slackThreadSessions.session_id,
      last_responder_type: slackThreadSessions.last_responder_type,
      last_bot_response_ts: slackThreadSessions.last_bot_response_ts,
      has_external_participants: slackThreadSessions.has_external_participants,
    })
    .from(slackThreadSessions)
    .where(
      and(
        eq(slackThreadSessions.channel_id, channelDbId),
        eq(slackThreadSessions.thread_ts, threadTs)
      )
    )

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    id: data.id,
    sessionId: data.session_id,
    lastResponderType: data.last_responder_type as 'bot' | 'user' | null,
    lastBotResponseTs: data.last_bot_response_ts,
    hasExternalParticipants: data.has_external_participants || false,
  }
}

/**
 * Update thread session responder tracking
 */
export async function updateThreadSessionResponder(
  threadSessionId: string,
  responderType: 'bot' | 'user',
  botResponseTs?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    last_responder_type: responderType,
  }

  if (responderType === 'bot' && botResponseTs) {
    updateData.last_bot_response_ts = botResponseTs
  }

  await db
    .update(slackThreadSessions)
    .set(updateData)
    .where(eq(slackThreadSessions.id, threadSessionId))
}

/**
 * Check if a DM channel is linked to a session via human takeover notification
 */
export async function getNotificationThreadSession(
  slackChannelId: string,
  threadTs?: string
): Promise<{ sessionId: string; projectId: string; userId: string } | null> {
  // Look up session by human_takeover_slack_channel_id
  // Note: These columns (human_takeover_slack_channel_id, human_takeover_slack_thread_ts,
  // human_takeover_user_id) may not be in the Drizzle schema yet.
  // We use a raw SQL approach via db.execute or a select with the available schema.
  // Since these columns aren't in the Drizzle schema, we use sql template.
  const { sql: sqlTemplate } = await import('drizzle-orm')

  let rows: { id: string; project_id: string; human_takeover_user_id: string }[]

  if (threadTs) {
    rows = await db.execute(
      sqlTemplate`SELECT id, project_id, human_takeover_user_id FROM sessions WHERE human_takeover_slack_channel_id = ${slackChannelId} AND is_human_takeover = true AND human_takeover_slack_thread_ts = ${threadTs} LIMIT 1`
    ) as unknown as { id: string; project_id: string; human_takeover_user_id: string }[]
  } else {
    rows = await db.execute(
      sqlTemplate`SELECT id, project_id, human_takeover_user_id FROM sessions WHERE human_takeover_slack_channel_id = ${slackChannelId} AND is_human_takeover = true LIMIT 1`
    ) as unknown as { id: string; project_id: string; human_takeover_user_id: string }[]
  }

  const data = rows[0]

  if (!data) {
    return null
  }

  return {
    sessionId: data.id,
    projectId: data.project_id,
    userId: data.human_takeover_user_id,
  }
}

/**
 * Record human takeover notification info on a session
 */
export async function setSessionHumanTakeoverNotification(
  params: {
    sessionId: string
    slackChannelId: string
    slackThreadTs?: string
    userId: string
  }
): Promise<void> {
  // These columns (human_takeover_slack_channel_id, etc.) may not be in the Drizzle schema.
  const { sql: sqlTemplate } = await import('drizzle-orm')

  try {
    await db.execute(
      sqlTemplate`UPDATE sessions SET human_takeover_slack_channel_id = ${params.slackChannelId}, human_takeover_slack_thread_ts = ${params.slackThreadTs ?? null}, human_takeover_user_id = ${params.userId} WHERE id = ${params.sessionId}`
    )
  } catch (error) {
    console.error('[slack.setSessionHumanTakeoverNotification] Failed:', error)
  }
}

/**
 * Update channel mode
 */
export async function updateSlackChannelMode(
  channelDbId: string,
  mode: ChannelMode,
  captureScope?: CaptureScope
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, unknown> = {
    channel_mode: mode,
  }

  if (captureScope !== undefined) {
    updateData.capture_scope = captureScope
  }

  try {
    await db
      .update(slackChannels)
      .set(updateData)
      .where(eq(slackChannels.id, channelDbId))

    return { success: true }
  } catch (error) {
    console.error('[slack.updateSlackChannelMode] Failed:', error)
    return { success: false, error: 'Failed to update channel mode.' }
  }
}
