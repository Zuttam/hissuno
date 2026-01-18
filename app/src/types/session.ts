/**
 * Session status values
 */
export type SessionStatus = 'active' | 'closing_soon' | 'awaiting_idle_response' | 'closed'

/**
 * Session source channels
 */
export type SessionSource = 'widget' | 'slack' | 'intercom' | 'gong' | 'api' | 'manual'

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
  page_url: string | null
  page_title: string | null
  source: SessionSource
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
  /** True if session was created when account was over session limit. PM review is skipped. */
  is_over_limit: boolean
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
 * Session with project details for display
 */
export interface SessionWithProject extends SessionRecord {
  project: {
    id: string
    name: string
  } | null
  /** Issues linked to this session from PM review */
  linked_issues?: SessionLinkedIssue[]
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
  status?: SessionStatus
  tags?: SessionTag[]
  dateFrom?: string
  dateTo?: string
  showArchived?: boolean
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
  page_url?: string
  page_title?: string
  tags?: SessionTag[]
  messages?: CreateMessageInput[]
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
 * Input for creating/updating a custom tag
 */
export interface CustomTagInput {
  name: string
  slug: string
  description: string
  color?: string
  position?: number
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
