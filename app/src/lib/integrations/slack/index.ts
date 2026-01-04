import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// NOTE: These tables are created by migrations but types are generated from the live schema.
// After running migrations, regenerate types with: supabase gen types typescript > src/types/supabase.ts
// Until then, we use type assertions for the new Slack tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

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
  created_at: string
  updated_at: string
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
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<SlackIntegrationStatus> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('slack_workspace_tokens')
    .select('workspace_id, workspace_name, workspace_domain, installed_by_email')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
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
  supabase: SupabaseClient<Database> | AnySupabase,
  workspaceId: string
): Promise<{ token: string; botUserId: string; projectId: string } | null> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('slack_workspace_tokens')
    .select('bot_token, bot_user_id, project_id')
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !data) {
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
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{ token: string; botUserId: string; workspaceId: string } | null> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('slack_workspace_tokens')
    .select('bot_token, bot_user_id, workspace_id')
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
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
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as AnySupabase
  const { error } = await client
    .from('slack_workspace_tokens')
    .delete()
    .eq('project_id', projectId)

  if (error) {
    console.error('[slack.disconnectSlack] Failed to delete token:', error)
    return { success: false, error: 'Failed to disconnect Slack.' }
  }

  return { success: true }
}

/**
 * Store Slack OAuth tokens after successful authorization
 */
export async function storeSlackToken(
  supabase: SupabaseClient<Database> | AnySupabase,
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
  const client = supabase as AnySupabase
  const { error } = await client.from('slack_workspace_tokens').upsert(
    {
      project_id: params.projectId,
      workspace_id: params.workspaceId,
      workspace_name: params.workspaceName,
      workspace_domain: params.workspaceDomain,
      bot_token: params.botToken,
      bot_user_id: params.botUserId,
      installed_by_user_id: params.installedByUserId,
      installed_by_email: params.installedByEmail,
      scope: params.scope,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'project_id',
    }
  )

  if (error) {
    console.error('[slack.storeSlackToken] Failed to store token:', error)
    return { success: false, error: 'Failed to store Slack token.' }
  }

  return { success: true }
}

/**
 * Get or create a Slack channel record
 */
export async function getOrCreateSlackChannel(
  supabase: SupabaseClient<Database> | AnySupabase,
  params: {
    workspaceTokenId: string
    channelId: string
    channelName: string | null
    channelType: 'channel' | 'private_channel' | 'im' | 'mpim'
    workspacePrimaryDomain: string | null
  }
): Promise<{ id: string } | null> {
  const client = supabase as AnySupabase
  // Try to get existing channel
  const { data: existing } = await client
    .from('slack_channels')
    .select('id')
    .eq('workspace_token_id', params.workspaceTokenId)
    .eq('channel_id', params.channelId)
    .single()

  if (existing) {
    return { id: existing.id }
  }

  // Create new channel record
  const { data, error } = await client
    .from('slack_channels')
    .insert({
      workspace_token_id: params.workspaceTokenId,
      channel_id: params.channelId,
      channel_name: params.channelName,
      channel_type: params.channelType,
      workspace_primary_domain: params.workspacePrimaryDomain,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[slack.getOrCreateSlackChannel] Failed:', error)
    return null
  }

  return { id: data.id }
}

/**
 * Get Slack channel by workspace and channel ID
 */
export async function getSlackChannel(
  supabase: SupabaseClient<Database> | AnySupabase,
  workspaceId: string,
  channelId: string
): Promise<{ id: string; workspaceTokenId: string; workspacePrimaryDomain: string | null } | null> {
  const client = supabase as AnySupabase
  const { data, error } = await client
    .from('slack_channels')
    .select(`
      id,
      workspace_primary_domain,
      slack_workspace_tokens!inner(id, workspace_id)
    `)
    .eq('slack_workspace_tokens.workspace_id', workspaceId)
    .eq('channel_id', channelId)
    .single()

  if (error || !data) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = data.slack_workspace_tokens as any
  return {
    id: data.id,
    workspaceTokenId: tokens.id,
    workspacePrimaryDomain: data.workspace_primary_domain,
  }
}

/**
 * Get or create a thread session mapping
 */
export async function getOrCreateThreadSession(
  supabase: SupabaseClient<Database> | AnySupabase,
  params: {
    sessionId: string
    channelDbId: string
    slackChannelId: string
    threadTs: string
    hasExternalParticipants: boolean
  }
): Promise<{ id: string; isNew: boolean } | null> {
  const client = supabase as AnySupabase
  // Try to get existing thread session
  const { data: existing } = await client
    .from('slack_thread_sessions')
    .select('id')
    .eq('channel_id', params.channelDbId)
    .eq('thread_ts', params.threadTs)
    .single()

  if (existing) {
    return { id: existing.id, isNew: false }
  }

  // Create new thread session
  const { data, error } = await client
    .from('slack_thread_sessions')
    .insert({
      session_id: params.sessionId,
      channel_id: params.channelDbId,
      slack_channel_id: params.slackChannelId,
      thread_ts: params.threadTs,
      has_external_participants: params.hasExternalParticipants,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[slack.getOrCreateThreadSession] Failed:', error)
    return null
  }

  return { id: data.id, isNew: true }
}

/**
 * Update thread session's last message timestamp
 */
export async function updateThreadSessionLastMessage(
  supabase: SupabaseClient<Database> | AnySupabase,
  threadSessionId: string,
  lastMessageTs: string
): Promise<void> {
  const client = supabase as AnySupabase
  await client
    .from('slack_thread_sessions')
    .update({ last_message_ts: lastMessageTs })
    .eq('id', threadSessionId)
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
  'users:read',
  'users:read.email',
]
