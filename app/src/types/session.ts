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
  message_count: number
  status: 'active' | 'closed'
  first_message_at: string | null
  last_activity_at: string
  pm_reviewed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Session with project details for display
 */
export interface SessionWithProject extends SessionRecord {
  project: {
    id: string
    name: string
  } | null
}

/**
 * Chat message in frontend-friendly format
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string // ISO string
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
  status?: 'active' | 'closed'
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}
