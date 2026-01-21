/**
 * Session Name Generator Service
 *
 * Generates session names from conversation content using lightweight LLM calls.
 */

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/server'
import { getSessionMessages } from '@/lib/supabase/session-messages'
import type { ChatMessage, SessionSource } from '@/types/session'

const LOG_PREFIX = '[session-name]'

interface GenerateDefaultNameParams {
  userId: string | null
  source: SessionSource
  createdAt: string
}

/**
 * Generates a default session name based on user ID and creation date.
 * Format: "User {userId} - {Jan 20}" or "Anonymous - {Jan 20}"
 */
export function generateDefaultName({ userId, createdAt }: GenerateDefaultNameParams): string {
  const date = new Date(createdAt)
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  const dateStr = `${month} ${day}`

  if (userId) {
    // Truncate long user IDs
    const displayId = userId.length > 12 ? `${userId.slice(0, 12)}...` : userId
    return `User ${displayId} - ${dateStr}`
  }

  return `Anonymous - ${dateStr}`
}

/**
 * Generates a session name from messages using an LLM.
 * Returns null if generation fails or no meaningful content.
 */
export async function generateSessionNameFromMessages(
  messages: ChatMessage[]
): Promise<string | null> {
  // Filter to only user messages
  const userMessages = messages.filter((m) => m.role === 'user')

  if (userMessages.length === 0) {
    return null
  }

  // Take first few messages (limit context)
  const contextMessages = userMessages.slice(0, 5)
  const conversationText = contextMessages.map((m) => m.content).join('\n\n')

  // Limit total text to avoid large payloads
  const truncatedText =
    conversationText.length > 2000 ? `${conversationText.slice(0, 2000)}...` : conversationText

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      maxOutputTokens: 50,
      temperature: 0.3,
      system: `You generate concise, descriptive titles for support conversations.
Rules:
- Output ONLY the title, nothing else
- Maximum 6 words
- Be specific about the user's issue or question
- Use action words when appropriate (e.g., "Can't export CSV", "Need help with billing")
- No quotes, no punctuation at the end
- If the conversation is unclear, output a generic title like "General inquiry"`,
      prompt: `Generate a short title for this customer conversation:\n\n${truncatedText}`,
    })

    const cleanedTitle = text.trim().replace(/^["']|["']$/g, '').replace(/[.!?]$/, '')

    // Validate the title
    if (!cleanedTitle || cleanedTitle.length < 3 || cleanedTitle.length > 100) {
      return null
    }

    return cleanedTitle
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to generate name from messages:`, error)
    return null
  }
}

interface EnsureSessionNameParams {
  sessionId: string
  projectId: string
  userId?: string | null
  source?: SessionSource
  createdAt?: string
}

/**
 * Ensures a session has a name. If no name exists, generates one.
 * 1. Checks if session already has a name
 * 2. Tries to generate from messages (if any)
 * 3. Falls back to default name
 * 4. Saves to database
 *
 * This function is idempotent - safe to call multiple times.
 */
export async function ensureSessionName(params: EnsureSessionNameParams): Promise<string | null> {
  if (!isServiceRoleConfigured()) {
    console.warn(`${LOG_PREFIX} Service role not configured, skipping name generation`)
    return null
  }

  const supabase = createAdminClient()

  try {
    // 1. Get current session state
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, name, user_id, source, created_at')
      .eq('id', params.sessionId)
      .single()

    if (sessionError || !session) {
      console.error(`${LOG_PREFIX} Session not found:`, params.sessionId)
      return null
    }

    // 2. If name already exists, return it
    if (session.name) {
      return session.name
    }

    // 3. Try to generate from messages
    const messages = await getSessionMessages(params.sessionId)
    let generatedName = await generateSessionNameFromMessages(messages)

    // 4. Fall back to default name
    if (!generatedName) {
      generatedName = generateDefaultName({
        userId: session.user_id,
        source: session.source,
        createdAt: session.created_at,
      })
    }

    // 5. Save to database
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ name: generatedName })
      .eq('id', params.sessionId)

    if (updateError) {
      console.error(`${LOG_PREFIX} Failed to save session name:`, updateError)
      return null
    }

    console.log(`${LOG_PREFIX} Generated name for session ${params.sessionId}: "${generatedName}"`)
    return generatedName
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error ensuring session name:`, error)
    return null
  }
}
