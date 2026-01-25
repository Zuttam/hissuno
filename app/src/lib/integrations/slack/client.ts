/**
 * Slack Web API client wrapper
 * Provides typed methods for common Slack API operations
 */

const SLACK_API_BASE = 'https://slack.com/api'

/**
 * Slack user profile information
 */
export type SlackUserInfo = {
  id: string
  team_id: string
  name: string
  real_name: string | null
  display_name: string | null
  email: string | null
  is_bot: boolean
  is_admin: boolean
  is_owner: boolean
  profile: {
    email?: string
    real_name?: string
    display_name?: string
    first_name?: string
    last_name?: string
    image_72?: string
    team?: string
  }
}

/**
 * Slack channel information
 */
export type SlackChannelInfo = {
  id: string
  name: string
  is_channel: boolean
  is_private: boolean
  is_member: boolean
  is_archived: boolean
  num_members: number
  topic?: { value: string }
  purpose?: { value: string }
}

/**
 * Slack message from API
 */
export type SlackMessage = {
  type: string
  user?: string
  bot_id?: string
  text: string
  ts: string
  thread_ts?: string
  reply_count?: number
  reply_users_count?: number
  attachments?: Array<{ text?: string; fallback?: string }>
  blocks?: Array<{ type: string; text?: { text: string } }>
}

/**
 * Slack API response wrapper
 */
type SlackApiResponse<T> = {
  ok: boolean
  error?: string
} & T

/**
 * Slack Web API client
 */
export class SlackClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  /**
   * Make a request to the Slack API
   */
  private async request<T>(
    method: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<SlackApiResponse<T>> {
    const url = new URL(`${SLACK_API_BASE}/${method}`)

    // Filter out undefined params
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined)
    ) as Record<string, string>

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(filteredParams).toString(),
    })

    if (!response.ok) {
      throw new Error(`Slack API HTTP error: ${response.status}`)
    }

    const data = await response.json()
    return data as SlackApiResponse<T>
  }

  /**
   * Get information about a user
   */
  async getUserInfo(userId: string): Promise<SlackUserInfo | null> {
    const result = await this.request<{ user: SlackUserInfo }>('users.info', {
      user: userId,
    })

    if (!result.ok) {
      console.error('[SlackClient.getUserInfo] Error:', result.error)
      return null
    }

    return result.user
  }

  /**
   * Get user's email address
   * Requires users:read.email scope
   */
  async getUserEmail(userId: string): Promise<string | null> {
    const user = await this.getUserInfo(userId)
    return user?.profile.email ?? user?.email ?? null
  }

  /**
   * Get information about a channel
   */
  async getChannelInfo(channelId: string): Promise<SlackChannelInfo | null> {
    const result = await this.request<{ channel: SlackChannelInfo }>(
      'conversations.info',
      {
        channel: channelId,
      }
    )

    if (!result.ok) {
      console.error('[SlackClient.getChannelInfo] Error:', result.error)
      return null
    }

    return result.channel
  }

  /**
   * Post a message to a channel
   */
  async postMessage(params: {
    channel: string
    text: string
    threadTs?: string
    unfurlLinks?: boolean
    unfurlMedia?: boolean
  }): Promise<{ ok: boolean; ts?: string; error?: string }> {
    const result = await this.request<{ ts: string }>('chat.postMessage', {
      channel: params.channel,
      text: params.text,
      thread_ts: params.threadTs,
      unfurl_links: params.unfurlLinks ?? false,
      unfurl_media: params.unfurlMedia ?? false,
    })

    if (!result.ok) {
      console.error('[SlackClient.postMessage] Error:', result.error)
      return { ok: false, error: result.error }
    }

    return { ok: true, ts: result.ts }
  }

  /**
   * Get messages in a thread
   */
  async getThreadMessages(
    channelId: string,
    threadTs: string,
    options: { limit?: number; oldest?: string } = {}
  ): Promise<SlackMessage[]> {
    const result = await this.request<{ messages: SlackMessage[] }>(
      'conversations.replies',
      {
        channel: channelId,
        ts: threadTs,
        limit: options.limit ?? 100,
        oldest: options.oldest,
      }
    )

    if (!result.ok) {
      console.error('[SlackClient.getThreadMessages] Error:', result.error)
      return []
    }

    return result.messages
  }

  /**
   * Get channel history (non-threaded messages)
   */
  async getChannelHistory(
    channelId: string,
    options: { limit?: number; oldest?: string; latest?: string } = {}
  ): Promise<SlackMessage[]> {
    const result = await this.request<{ messages: SlackMessage[] }>(
      'conversations.history',
      {
        channel: channelId,
        limit: options.limit ?? 100,
        oldest: options.oldest,
        latest: options.latest,
      }
    )

    if (!result.ok) {
      console.error('[SlackClient.getChannelHistory] Error:', result.error)
      return []
    }

    return result.messages
  }

  /**
   * Join a channel
   */
  async joinChannel(channelId: string): Promise<{ ok: boolean; error?: string }> {
    const result = await this.request<Record<string, never>>('conversations.join', {
      channel: channelId,
    })

    if (!result.ok) {
      console.error('[SlackClient.joinChannel] Error:', result.error)
      return { ok: false, error: result.error }
    }

    return { ok: true }
  }

  /**
   * Leave a channel
   */
  async leaveChannel(channelId: string): Promise<{ ok: boolean; error?: string }> {
    const result = await this.request<Record<string, never>>('conversations.leave', {
      channel: channelId,
    })

    if (!result.ok) {
      console.error('[SlackClient.leaveChannel] Error:', result.error)
      return { ok: false, error: result.error }
    }

    return { ok: true }
  }

  /**
   * List public channels the bot can access
   */
  async listPublicChannels(): Promise<SlackChannelInfo[]> {
    const result = await this.request<{ channels: SlackChannelInfo[] }>('conversations.list', {
      types: 'public_channel',
      exclude_archived: 'true',
      limit: 200,
    })

    if (!result.ok || !result.channels) {
      console.error('[SlackClient.listPublicChannels] Error:', result.error)
      return []
    }

    return result.channels
  }

  /**
   * Get team/workspace information
   */
  async getTeamInfo(): Promise<{
    id: string
    name: string
    domain: string
    email_domain?: string
  } | null> {
    const result = await this.request<{
      team: {
        id: string
        name: string
        domain: string
        email_domain?: string
      }
    }>('team.info', {})

    if (!result.ok) {
      console.error('[SlackClient.getTeamInfo] Error:', result.error)
      return null
    }

    return result.team
  }

  /**
   * Test API connection / auth
   */
  async authTest(): Promise<{
    ok: boolean
    url?: string
    team?: string
    user?: string
    team_id?: string
    user_id?: string
    bot_id?: string
    error?: string
  }> {
    const result = await this.request<{
      url: string
      team: string
      user: string
      team_id: string
      user_id: string
      bot_id: string
    }>('auth.test', {})

    return result
  }
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeSlackOAuthCode(params: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<{
  ok: boolean
  access_token?: string
  bot_user_id?: string
  team?: { id: string; name: string }
  authed_user?: { id: string }
  scope?: string
  error?: string
}> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    }).toString(),
  })

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` }
  }

  return response.json()
}
