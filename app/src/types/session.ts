/**
 * Session status values
 */
export type SessionStatus = 'active' | 'closing_soon' | 'awaiting_idle_response' | 'closed'

/**
 * Session source channels
 */
export type SessionSource = 'widget' | 'slack' | 'intercom' | 'gong' | 'api'

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
export type MessageSenderType = 'ai' | 'human_agent' | 'system'

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
 * Session message record from database (for human/system messages)
 */
export interface SessionMessageRecord {
  id: string
  session_id: string
  project_id: string
  sender_type: 'human_agent' | 'system'
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
  limit?: number
  offset?: number
}
