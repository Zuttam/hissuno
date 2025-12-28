/**
 * Chat Run Service
 * Shared logic for triggering and managing agent chat runs with SSE streaming
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>

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
  supabase: AnySupabaseClient
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
  const { projectId, sessionId, messages, userId, userMetadata, supabase } = params

  // Check if a chat run is already running for this session
  const { data: runningChat } = await supabase
    .from('chat_runs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

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
  const { data: chatRunRecord, error: insertError } = await supabase
    .from('chat_runs')
    .insert({
      project_id: projectId,
      session_id: sessionId,
      run_id: runId,
      status: 'running',
      started_at: new Date().toISOString(),
      metadata: {
        messages,
        userId,
        userMetadata,
        messageCount: messages.length,
        lastUserMessage: messages[messages.length - 1]?.content?.slice(0, 100),
      },
    })
    .select()
    .single()

  if (insertError || !chatRunRecord) {
    console.error('[chat-run-service] Failed to create chat run record', insertError)
    return { success: false, error: 'Failed to start chat.', statusCode: 500 }
  }

  console.log('[chat-run-service] Created chat run record:', chatRunRecord.id)

  return {
    success: true,
    runId,
    chatRunId: chatRunRecord.id,
  }
}

/**
 * Get the current status of a chat run for a session
 */
export async function getChatRunStatus(
  params: Pick<TriggerChatRunParams, 'sessionId' | 'supabase'>
): Promise<GetChatRunStatusResult> {
  const { sessionId, supabase } = params

  // Get the latest chat run for this session
  const { data: latestRun, error } = await supabase
    .from('chat_runs')
    .select('*')
    .eq('session_id', sessionId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[chat-run-service] Failed to get chat run status', error)
  }

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
    startedAt: latestRun.started_at,
    completedAt: latestRun.completed_at ?? undefined,
    errorMessage: latestRun.error_message ?? undefined,
  }
}

/**
 * Cancel a running chat
 */
export async function cancelChatRun(
  params: Pick<TriggerChatRunParams, 'sessionId' | 'supabase'>
): Promise<{ success: boolean; error?: string }> {
  const { sessionId, supabase } = params

  // Find running chat run
  const { data: runningChat, error: findError } = await supabase
    .from('chat_runs')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'running')
    .single()

  if (findError && findError.code !== 'PGRST116') {
    console.error('[chat-run-service] Failed to find running chat run', findError)
    return { success: false, error: 'Failed to find running chat.' }
  }

  if (!runningChat) {
    return { success: false, error: 'No running chat found.' }
  }

  // Mark as cancelled
  const { error: updateError } = await supabase
    .from('chat_runs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', runningChat.id)

  if (updateError) {
    console.error('[chat-run-service] Failed to cancel chat run', updateError)
    return { success: false, error: 'Failed to cancel chat.' }
  }

  return { success: true }
}

/**
 * Get a running chat run by session ID
 */
export async function getRunningChatRun(
  params: Pick<TriggerChatRunParams, 'sessionId' | 'supabase'>
) {
  const { sessionId, supabase } = params

  const { data, error } = await supabase
    .from('chat_runs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[chat-run-service] Failed to get running chat run', error)
    return null
  }

  return data
}

/**
 * Update chat run status
 */
export async function updateChatRunStatus(
  params: {
    chatRunId: string
    status: 'completed' | 'failed' | 'cancelled'
    errorMessage?: string
    supabase: AnySupabaseClient
  }
) {
  const { chatRunId, status, errorMessage, supabase } = params

  const { error } = await supabase
    .from('chat_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      ...(errorMessage && { error_message: errorMessage }),
    })
    .eq('id', chatRunId)

  if (error) {
    console.error('[chat-run-service] Failed to update chat run status', error)
    return false
  }

  return true
}
