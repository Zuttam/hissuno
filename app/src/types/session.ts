/**
 * Session status values
 */
export type SessionStatus = 'active' | 'closing_soon' | 'awaiting_idle_response' | 'closed'

/**
 * Session source channels
 */
export type SessionSource = 'widget' | 'slack' | 'intercom' | 'zendesk' | 'gong' | 'api' | 'manual'

/**
 * Session content type (determines how content is rendered)
 */
export type SessionType = 'chat' | 'meeting' | 'behavioral'

/**
 * Session type display information for UI
 */
export const SESSION_TYPE_INFO: Record<
  SessionType,
  { label: string; description: string; contentLabel: string; variant: 'info' | 'success' | 'warning' | 'default' }
> = {
  chat: { label: 'Chat', description: 'Live chat conversation', contentLabel: 'Messages', variant: 'info' },
  meeting: { label: 'Meeting', description: 'Call or meeting transcript', contentLabel: 'Transcript', variant: 'success' },
  behavioral: { label: 'Behavioral', description: 'User behavior events', contentLabel: 'Events', variant: 'warning' },
}

/**
 * Get the default session type for a given source
 */
export function getDefaultSessionType(source: SessionSource): SessionType {
  switch (source) {
    case 'gong':
      return 'meeting'
    default:
      return 'chat'
  }
}

/**
 * Source display information for UI
 */
export const SESSION_SOURCE_INFO: Record<
  SessionSource,
  { label: string; variant: 'info' | 'success' | 'warning' | 'default' }
> = {
  widget: { label: 'Widget', variant: 'info' },
  slack: { label: 'Slack', variant: 'warning' },
  intercom: { label: 'Intercom', variant: 'success' },
  zendesk: { label: 'Zendesk', variant: 'success' },
  gong: { label: 'Gong', variant: 'default' },
  api: { label: 'API', variant: 'default' },
  manual: { label: 'Manual', variant: 'default' },
}

/**
 * Predefined session tags for classification
 */
export const SESSION_TAGS = [
  'general_feedback',
  'wins',
  'losses',
  'bug',
  'feature_request',
  'change_request',
] as const

export type SessionTag = (typeof SESSION_TAGS)[number]

/**
 * Tag display information for UI
 */
export const SESSION_TAG_INFO: Record<
  SessionTag,
  { label: string; variant: 'info' | 'success' | 'danger' | 'warning' }
> = {
  general_feedback: { label: 'General Feedback', variant: 'info' },
  wins: { label: 'Win', variant: 'success' },
  losses: { label: 'Loss', variant: 'danger' },
  bug: { label: 'Bug', variant: 'danger' },
  feature_request: { label: 'Feature Request', variant: 'warning' },
  change_request: { label: 'Change Request', variant: 'warning' },
}

/**
 * Sender type for messages
 */
export type MessageSenderType = 'user' | 'ai' | 'human_agent' | 'system'

/**
 * Session record from the database
 */
export interface SessionRecord {
  id: string
  project_id: string
  user_id: string | null
  user_metadata: Record<string, string> | null
  contact_id: string | null
  page_url: string | null
  page_title: string | null
  name: string | null
  source: SessionSource
  session_type: SessionType
  message_count: number
  status: SessionStatus
  tags: SessionTag[]
  tags_auto_applied_at: string | null
  first_message_at: string | null
  last_activity_at: string
  pm_reviewed_at: string | null
  goodbye_detected_at: string | null
  idle_prompt_sent_at: string | null
  scheduled_close_at: string | null
  is_archived: boolean
  is_human_takeover: boolean
  human_takeover_at: string | null
  human_takeover_user_id: string | null
  human_takeover_slack_channel_id: string | null
  human_takeover_slack_thread_ts: string | null
  created_at: string
  updated_at: string
}

/**
 * Linked issue from PM review
 */
export interface SessionLinkedIssue {
  id: string
  title: string
  type: 'bug' | 'feature_request' | 'change_request'
  status: string
  upvote_count: number
}

/**
 * Contact info resolved from session email matching
 */
export interface SessionContact {
  id: string
  name: string
  email: string
  company: {
    id: string
    name: string
    domain: string
    arr: number | null
    stage: string
  } | null
}

/**
 * Session with project details for display
 */
export interface SessionWithProject extends SessionRecord {
  project: {
    id: string
    name: string
  } | null
  /** Issues linked to this session from PM review */
  linked_issues?: SessionLinkedIssue[]
  /** Issue count from list query aggregation */
  issue_sessions?: [{ count: number }]
  /** Matched Hissuno user profile (if user_id is a known platform user) */
  user_profile?: { full_name: string | null } | null
  /** Resolved contact from email matching */
  contact?: SessionContact | null
}

/**
 * Chat message in frontend-friendly format
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string // ISO string
  senderType?: MessageSenderType // 'ai' for AI, 'human_agent' for human takeover, 'system' for automated
  senderName?: string // Optional display name for human agents
}

/**
 * Session message record from database (all message types)
 */
export interface SessionMessageRecord {
  id: string
  session_id: string
  project_id: string
  sender_type: MessageSenderType
  sender_user_id: string | null
  content: string
  created_at: string
}

/**
 * Session detail with messages
 */
export interface SessionWithMessages {
  session: SessionWithProject
  messages: ChatMessage[]
}

/**
 * Filters for listing sessions
 */
export interface SessionFilters {
  projectId?: string
  userId?: string
  sessionId?: string
  name?: string
  status?: SessionStatus
  source?: SessionSource
  sessionType?: SessionType
  tags?: string[]
  dateFrom?: string
  dateTo?: string
  showArchived?: boolean
  isHumanTakeover?: boolean
  isAnalyzed?: boolean
  companyId?: string
  contactId?: string
  limit?: number
  offset?: number
}

/**
 * Input for a message when creating a manual session
 */
export interface CreateMessageInput {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Input for creating a manual session
 */
export interface CreateSessionInput {
  project_id: string
  user_id?: string
  user_metadata?: Record<string, string>
  page_url?: string
  page_title?: string
  name?: string
  tags?: SessionTag[]
  messages?: CreateMessageInput[]
}

/**
 * Input for updating a session
 */
export interface UpdateSessionInput {
  name?: string | null
  status?: SessionStatus
  user_id?: string | null
  user_metadata?: Record<string, string> | null
  is_human_takeover?: boolean
  contact_id?: string | null
}

/**
 * Resolved user display info from session data.
 * Priority: contact.name > user_profile.full_name > metadata.name > metadata.email > user_id
 */
export function getSessionUserDisplay(session: SessionWithProject): {
  name: string | null
  isHissuno: boolean
  contactId?: string
  companyName?: string
} {
  // 1. Linked contact (resolved from email matching)
  if (session.contact) {
    return {
      name: session.contact.name,
      isHissuno: false,
      contactId: session.contact.id,
      companyName: session.contact.company?.name ?? undefined,
    }
  }

  // 2. Hissuno platform user
  if (session.user_profile?.full_name) {
    return { name: session.user_profile.full_name, isHissuno: true }
  }

  // 3. External user with metadata
  const metaName = session.user_metadata?.name as string | undefined
  const metaEmail = session.user_metadata?.email as string | undefined
  if (metaName) {
    return { name: metaName, isHissuno: false }
  }
  if (metaEmail) {
    return { name: metaEmail, isHissuno: false }
  }

  // 4. Raw user_id fallback
  if (session.user_id) {
    return { name: session.user_id, isHissuno: false }
  }

  return { name: null, isHissuno: false }
}

/**
 * Custom tag record from database
 */
export interface CustomTagRecord {
  id: string
  project_id: string
  name: string
  slug: string
  description: string
  color: string
  position: number
  created_at: string
  updated_at: string
}

/**
 * Badge color variants for tags
 */
export type TagColorVariant = 'info' | 'success' | 'danger' | 'warning' | 'default'

/**
 * Check if a tag is a native (built-in) tag
 */
export function isNativeTag(tag: string): tag is SessionTag {
  return SESSION_TAGS.includes(tag as SessionTag)
}

/**
 * Get display info for a tag (native or custom)
 */
export function getTagInfo(
  tag: string,
  customTags: CustomTagRecord[] = []
): { label: string; variant: TagColorVariant; isCustom: boolean } {
  if (isNativeTag(tag)) {
    return {
      label: SESSION_TAG_INFO[tag].label,
      variant: SESSION_TAG_INFO[tag].variant,
      isCustom: false,
    }
  }

  const customTag = customTags.find((t) => t.slug === tag)
  if (customTag) {
    return {
      label: customTag.name,
      variant: (customTag.color as TagColorVariant) || 'default',
      isCustom: true,
    }
  }

  // Unknown tag - render as default
  return {
    label: tag,
    variant: 'default',
    isCustom: false,
  }
}
