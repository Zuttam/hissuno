/**
 * Session Messages Queries (Drizzle)
 * Provides save/get operations for session_messages table.
 * This is the single source of truth for message display in the app.
 */

import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sessionMessages, sessions } from '@/lib/db/schema/app'
import { resolveRequestContext } from '@/lib/db/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { ForbiddenError } from '@/lib/auth/authorization'
import type { MessageSenderType, ChatMessage } from '@/types/session'

export type SessionMessageRow = typeof sessionMessages.$inferSelect
export type SessionMessageInsert = typeof sessionMessages.$inferInsert

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
export async function saveSessionMessage(params: SaveMessageParams): Promise<SessionMessageRow | null> {
  try {
    const [row] = await db
      .insert(sessionMessages)
      .values({
        session_id: params.sessionId,
        project_id: params.projectId,
        sender_type: params.senderType,
        sender_user_id: params.senderUserId ?? null,
        content: params.content,
      })
      .returning()

    return row ?? null
  } catch (error) {
    console.error('[session-messages] Failed to save message:', error)
    return null
  }
}

/**
 * Get all messages for a session, ordered chronologically
 */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    const { userId } = await resolveRequestContext()

    // Verify the session belongs to a project the user can access
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      columns: { project_id: true },
    })

    if (!session) {
      return []
    }

    const hasAccess = await hasProjectAccess(session.project_id, userId)
    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this session.')
    }

    const rows = await db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.session_id, sessionId))
      .orderBy(asc(sessionMessages.created_at))

    return rows.map((msg) => ({
      id: msg.id,
      role: mapSenderTypeToRole(msg.sender_type as MessageSenderType),
      content: msg.content,
      createdAt: msg.created_at?.toISOString() ?? new Date().toISOString(),
      senderType: msg.sender_type as MessageSenderType,
    }))
  } catch (error) {
    console.error('[session-messages] Failed to get messages:', error)
    return []
  }
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
