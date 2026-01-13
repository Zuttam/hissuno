/**
 * Session Messages Service
 * Provides save/get operations for session_messages table.
 * This is the single source of truth for message display in the app.
 */

import { createAdminClient } from './server'
import type { MessageSenderType, ChatMessage, SessionMessageRecord } from '@/types/session'

export interface SaveMessageParams {
  sessionId: string
  projectId: string
  senderType: MessageSenderType
  content: string
  senderUserId?: string | null
}

/**
 * Save a message to session_messages table
 */
export async function saveSessionMessage(params: SaveMessageParams): Promise<SessionMessageRecord | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('session_messages')
    .insert({
      session_id: params.sessionId,
      project_id: params.projectId,
      sender_type: params.senderType,
      sender_user_id: params.senderUserId ?? null,
      content: params.content,
    })
    .select()
    .single()

  if (error) {
    console.error('[session-messages] Failed to save message:', error)
    return null
  }

  return data as SessionMessageRecord
}

/**
 * Get all messages for a session, ordered chronologically
 */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('session_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[session-messages] Failed to get messages:', error)
    return []
  }

  return (data ?? []).map((msg: SessionMessageRecord) => ({
    id: msg.id,
    role: mapSenderTypeToRole(msg.sender_type),
    content: msg.content,
    createdAt: msg.created_at,
    senderType: msg.sender_type,
  }))
}

/**
 * Map sender_type to message role for frontend compatibility
 */
function mapSenderTypeToRole(senderType: MessageSenderType): 'user' | 'assistant' | 'system' {
  switch (senderType) {
    case 'user':
      return 'user'
    case 'ai':
    case 'human_agent':
      return 'assistant'
    case 'system':
      return 'system'
  }
}
