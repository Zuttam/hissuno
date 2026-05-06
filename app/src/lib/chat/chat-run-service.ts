/**
 * Chat Run Service
 * Shared logic for triggering and managing agent chat runs with SSE streaming
 */

import { db } from '@/lib/db'
import { chatRuns } from '@/lib/db/schema/app'
import { UUID_REGEX } from '@/lib/db/server'
import { eq, and, desc } from 'drizzle-orm'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type TriggerChatRunParams = {
  projectId: string
  sessionId: string
  messages: ChatMessage[]
  userId?: string | null
  userMetadata?: Record<string, string> | null
  /** Override the knowledge package used for this chat (for testing specific packages) */
  packageId?: string | null
  /** Resolved contact ID for data tool scoping (null = user mode) */
  contactId?: string | null
}

export type TriggerChatRunResult = {
  success: true
  runId: string
  chatRunId: string
} | {
  success: false
  error: string
  statusCode: number
  /** If chat is already running */
  runId?: string
  chatRunId?: string
}

export type GetChatRunStatusResult = {
  isRunning: boolean
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  chatRunId?: string
  runId?: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

/**
 * Triggers a new chat run for agent streaming.
 * Creates a record in chat_runs and returns the runId for SSE streaming.
 */
export async function triggerChatRun(
  params: TriggerChatRunParams
): Promise<TriggerChatRunResult> {
  const { projectId, sessionId, messages, userId, userMetadata, packageId, contactId } = params

  // Check if a chat run is already running for this session
  const runningChats = await db
    .select()
    .from(chatRuns)
    .where(
      and(
        eq(chatRuns.session_id, sessionId),
        eq(chatRuns.status, 'running')
      )
    )
    .orderBy(desc(chatRuns.started_at))
    .limit(1)

  const runningChat = runningChats[0]

  if (runningChat) {
    return {
      success: false,
      error: 'A chat response is already in progress. Cancel it first to send a new message.',
      statusCode: 409,
      runId: runningChat.run_id,
      chatRunId: runningChat.id,
    }
  }

  // Generate a unique run ID
  const runId = `chat-${sessionId}-${Date.now()}`

  // Create chat run record with messages stored in metadata
  try {
    const [chatRunRecord] = await db
      .insert(chatRuns)
      .values({
        project_id: projectId,
        session_id: sessionId,
        run_id: runId,
        status: 'running',
        started_at: new Date(),
        metadata: {
          messages,
          userId,
          userMetadata,
          packageId,
          contactId: contactId ?? null,
          messageCount: messages.length,
          lastUserMessage: messages[messages.length - 1]?.content?.slice(0, 100),
        },
      })
      .returning()

    if (!chatRunRecord) {
      console.error('[chat-run-service] Failed to create chat run record')
      return { success: false, error: 'Failed to start chat.', statusCode: 500 }
    }

    console.log('[chat-run-service] Created chat run record:', chatRunRecord.id)

    return {
      success: true,
      runId,
      chatRunId: chatRunRecord.id,
    }
  } catch (error) {
    console.error('[chat-run-service] Failed to create chat run record', error)
    return { success: false, error: 'Failed to start chat.', statusCode: 500 }
  }
}

/**
 * Get the current status of a chat run for a session
 */
export async function getChatRunStatus(
  params: Pick<TriggerChatRunParams, 'sessionId'>
): Promise<GetChatRunStatusResult> {
  const { sessionId } = params

  // Widget generates non-UUID session IDs — no chat runs can exist for them
  if (!UUID_REGEX.test(sessionId)) {
    return { isRunning: false, status: 'idle' as const }
  }

  // Get the latest chat run for this session
  const latestRuns = await db
    .select()
    .from(chatRuns)
    .where(eq(chatRuns.session_id, sessionId))
    .orderBy(desc(chatRuns.started_at))
    .limit(1)

  const latestRun = latestRuns[0]

  if (!latestRun) {
    return {
      isRunning: false,
      status: 'idle',
    }
  }

  return {
    isRunning: latestRun.status === 'running',
    status: latestRun.status as GetChatRunStatusResult['status'],
    chatRunId: latestRun.id,
    runId: latestRun.run_id,
    startedAt: latestRun.started_at?.toISOString(),
    completedAt: latestRun.completed_at?.toISOString() ?? undefined,
    errorMessage: latestRun.error_message ?? undefined,
  }
}

/**
 * Cancel a running chat
 */
export async function cancelChatRun(
  params: Pick<TriggerChatRunParams, 'sessionId'>
): Promise<{ success: boolean; error?: string }> {
  const { sessionId } = params

  if (!UUID_REGEX.test(sessionId)) {
    return { success: false, error: 'No running chat found.' }
  }

  // Find running chat run
  const runningChats = await db
    .select({ id: chatRuns.id })
    .from(chatRuns)
    .where(
      and(
        eq(chatRuns.session_id, sessionId),
        eq(chatRuns.status, 'running')
      )
    )
    .limit(1)

  const runningChat = runningChats[0]

  if (!runningChat) {
    return { success: false, error: 'No running chat found.' }
  }

  // Mark as cancelled
  try {
    await db
      .update(chatRuns)
      .set({
        status: 'cancelled',
        completed_at: new Date(),
      })
      .where(eq(chatRuns.id, runningChat.id))

    return { success: true }
  } catch (error) {
    console.error('[chat-run-service] Failed to cancel chat run', error)
    return { success: false, error: 'Failed to cancel chat.' }
  }
}

/**
 * Get a running chat run by session ID
 */
export async function getRunningChatRun(
  params: Pick<TriggerChatRunParams, 'sessionId'>
) {
  const { sessionId } = params

  if (!UUID_REGEX.test(sessionId)) {
    return null
  }

  const rows = await db
    .select()
    .from(chatRuns)
    .where(
      and(
        eq(chatRuns.session_id, sessionId),
        eq(chatRuns.status, 'running')
      )
    )
    .orderBy(desc(chatRuns.started_at))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Update chat run status
 */
export async function updateChatRunStatus(
  params: {
    chatRunId: string
    status: 'completed' | 'failed' | 'cancelled'
    errorMessage?: string
  }
) {
  const { chatRunId, status, errorMessage } = params

  try {
    await db
      .update(chatRuns)
      .set({
        status,
        completed_at: new Date(),
        ...(errorMessage && { error_message: errorMessage }),
      })
      .where(eq(chatRuns.id, chatRunId))

    return true
  } catch (error) {
    console.error('[chat-run-service] Failed to update chat run status', error)
    return false
  }
}
