/**
 * Intercom conversation sync logic.
 * Handles fetching conversations from Intercom and creating Hissuno sessions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  IntercomClient,
  type IntercomConversation,
  type IntercomConversationListItem,
  IntercomApiError,
  IntercomRateLimitError,
} from './client'
import {
  getIntercomCredentials,
  isConversationSynced,
  recordSyncedConversation,
  updateSyncState,
  createSyncRun,
  completeSyncRun,
  type IntercomFilterConfig,
} from './index'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

/**
 * Progress event during sync
 */
export interface SyncProgressEvent {
  type: 'progress' | 'synced' | 'skipped' | 'error'
  conversationId?: string
  sessionId?: string
  message: string
  current: number
  total: number
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean
  conversationsFound: number
  conversationsSynced: number
  conversationsSkipped: number
  error?: string
}

/**
 * Sync options
 */
export interface SyncOptions {
  triggeredBy: 'manual' | 'cron'
  filterConfig?: IntercomFilterConfig
  onProgress?: (event: SyncProgressEvent) => void
}

/**
 * Map Intercom author type to Hissuno sender type
 */
function mapAuthorTypeToSenderType(authorType: string): 'user' | 'ai' | 'human_agent' {
  switch (authorType) {
    case 'user':
      // Intercom "user" is the contact (customer)
      return 'user'
    case 'admin':
      // Intercom "admin" is a team member
      return 'human_agent'
    case 'bot':
      // Intercom bot
      return 'ai'
    case 'team':
      // Team responses
      return 'human_agent'
    default:
      return 'human_agent'
  }
}

/**
 * Generate a session ID from Intercom conversation
 */
function generateSessionId(conversationId: string): string {
  return `intercom-${conversationId}-${Date.now()}`
}

/**
 * Extract contact info from conversation
 */
function extractContactInfo(conversation: IntercomConversation): {
  userId: string | null
  name: string | null
  email: string | null
} {
  const contact = conversation.contacts?.contacts?.[0]
  if (!contact) {
    return { userId: null, name: null, email: null }
  }

  return {
    userId: contact.external_id || contact.id,
    name: contact.name || null,
    email: contact.email || null,
  }
}

/**
 * Generate session name from conversation
 */
function generateSessionName(conversation: IntercomConversation): string {
  // Use title if available
  if (conversation.title) {
    return conversation.title
  }

  // Use first message content (truncated)
  const firstMessage = conversation.source?.body
  if (firstMessage) {
    const cleaned = firstMessage.replace(/<[^>]*>/g, '').trim()
    if (cleaned.length > 50) {
      return cleaned.substring(0, 47) + '...'
    }
    return cleaned || 'Intercom Conversation'
  }

  return 'Intercom Conversation'
}

/**
 * Create a session and messages from an Intercom conversation
 */
async function createSessionFromConversation(
  supabase: AnySupabase,
  projectId: string,
  connectionId: string,
  conversation: IntercomConversation
): Promise<{ sessionId: string; messageCount: number } | null> {
  const sessionId = generateSessionId(conversation.id)
  const contactInfo = extractContactInfo(conversation)

  // Build user metadata
  const userMetadata: Record<string, unknown> = {
    intercom_conversation_id: conversation.id,
  }
  if (contactInfo.name) userMetadata.name = contactInfo.name
  if (contactInfo.email) userMetadata.email = contactInfo.email

  // Create session
  const { error: sessionError } = await supabase.from('sessions').insert({
    id: sessionId,
    project_id: projectId,
    source: 'intercom',
    status: 'closed', // Historical data is always closed
    name: generateSessionName(conversation),
    user_id: contactInfo.userId,
    user_metadata: userMetadata,
    first_message_at: new Date(conversation.created_at * 1000).toISOString(),
    last_activity_at: new Date(conversation.updated_at * 1000).toISOString(),
    created_at: new Date(conversation.created_at * 1000).toISOString(),
  })

  if (sessionError) {
    console.error('[intercom.sync] Failed to create session:', sessionError)
    return null
  }

  // Collect all messages (source + parts)
  const messages: Array<{
    session_id: string
    project_id: string
    sender_type: 'user' | 'ai' | 'human_agent'
    content: string
    created_at: string
  }> = []

  // Add source message (first message in conversation)
  if (conversation.source?.body) {
    messages.push({
      session_id: sessionId,
      project_id: projectId,
      sender_type: mapAuthorTypeToSenderType(conversation.source.author.type),
      content: conversation.source.body,
      created_at: new Date(conversation.created_at * 1000).toISOString(),
    })
  }

  // Add conversation parts
  const parts = conversation.conversation_parts?.conversation_parts || []
  for (const part of parts) {
    // Skip empty parts or non-message parts
    if (!part.body || part.part_type === 'assignment' || part.part_type === 'close') {
      continue
    }

    messages.push({
      session_id: sessionId,
      project_id: projectId,
      sender_type: mapAuthorTypeToSenderType(part.author.type),
      content: part.body,
      created_at: new Date(part.created_at * 1000).toISOString(),
    })
  }

  // Insert messages
  if (messages.length > 0) {
    const { error: messagesError } = await supabase
      .from('session_messages')
      .insert(messages)

    if (messagesError) {
      console.error('[intercom.sync] Failed to insert messages:', messagesError)
      // Continue anyway - session was created
    }
  }

  // Update session message count
  await supabase
    .from('sessions')
    .update({ message_count: messages.length })
    .eq('id', sessionId)

  // Record the sync
  await recordSyncedConversation(supabase, {
    connectionId,
    intercomConversationId: conversation.id,
    sessionId,
    conversationCreatedAt: new Date(conversation.created_at * 1000).toISOString(),
    conversationUpdatedAt: new Date(conversation.updated_at * 1000).toISOString(),
    partsCount: messages.length,
  })

  return { sessionId, messageCount: messages.length }
}

/**
 * Sync Intercom conversations for a project.
 * This is the main sync function called by API routes.
 */
export async function syncIntercomConversations(
  supabase: SupabaseClient<Database> | AnySupabase,
  projectId: string,
  options: SyncOptions
): Promise<SyncResult> {
  const client = supabase as AnySupabase

  // Get credentials
  const credentials = await getIntercomCredentials(client, projectId)
  if (!credentials) {
    return {
      success: false,
      conversationsFound: 0,
      conversationsSynced: 0,
      conversationsSkipped: 0,
      error: 'Intercom is not connected.',
    }
  }

  // Create sync run record
  const runResult = await createSyncRun(client, credentials.connectionId, options.triggeredBy)
  const runId = runResult?.runId

  // Mark sync as in progress
  await updateSyncState(client, projectId, { status: 'in_progress' })

  // Initialize API client
  const intercom = new IntercomClient(credentials.accessToken)

  // Parse date filters
  let fromDate: Date | undefined
  let toDate: Date | undefined
  if (options.filterConfig?.fromDate) {
    fromDate = new Date(options.filterConfig.fromDate)
  }
  if (options.filterConfig?.toDate) {
    toDate = new Date(options.filterConfig.toDate)
  }

  let conversationsFound = 0
  let conversationsSynced = 0
  let conversationsSkipped = 0

  try {
    // Collect conversations to sync
    const conversationsToSync: IntercomConversationListItem[] = []

    // First pass: collect all conversation IDs
    for await (const conversation of intercom.listAllConversations({
      fromDate,
      toDate,
      onProgress: (fetched, total) => {
        conversationsFound = total
        options.onProgress?.({
          type: 'progress',
          message: `Scanning conversations... ${fetched}/${total}`,
          current: fetched,
          total,
        })
      },
    })) {
      // Check if already synced
      const alreadySynced = await isConversationSynced(
        client,
        credentials.connectionId,
        conversation.id
      )

      if (alreadySynced) {
        conversationsSkipped++
        options.onProgress?.({
          type: 'skipped',
          conversationId: conversation.id,
          message: `Skipped (already synced): ${conversation.id}`,
          current: conversationsSkipped + conversationsSynced,
          total: conversationsFound,
        })
        continue
      }

      conversationsToSync.push(conversation)
    }

    // Second pass: fetch full conversations and create sessions
    for (let i = 0; i < conversationsToSync.length; i++) {
      const conversationListItem = conversationsToSync[i]

      try {
        // Fetch full conversation with parts
        const fullConversation = await intercom.getConversation(conversationListItem.id)

        // Create session and messages
        const result = await createSessionFromConversation(
          client,
          projectId,
          credentials.connectionId,
          fullConversation
        )

        if (result) {
          conversationsSynced++
          options.onProgress?.({
            type: 'synced',
            conversationId: fullConversation.id,
            sessionId: result.sessionId,
            message: `Synced: ${fullConversation.title || fullConversation.id} (${result.messageCount} messages)`,
            current: conversationsSynced + conversationsSkipped,
            total: conversationsToSync.length + conversationsSkipped,
          })
        } else {
          conversationsSkipped++
          options.onProgress?.({
            type: 'error',
            conversationId: fullConversation.id,
            message: `Failed to create session for: ${fullConversation.id}`,
            current: conversationsSynced + conversationsSkipped,
            total: conversationsToSync.length + conversationsSkipped,
          })
        }
      } catch (convError) {
        console.error(`[intercom.sync] Error processing conversation ${conversationListItem.id}:`, convError)
        conversationsSkipped++
        options.onProgress?.({
          type: 'error',
          conversationId: conversationListItem.id,
          message: `Error: ${convError instanceof Error ? convError.message : 'Unknown error'}`,
          current: conversationsSynced + conversationsSkipped,
          total: conversationsToSync.length + conversationsSkipped,
        })
      }
    }

    // Update sync state
    await updateSyncState(client, projectId, {
      status: 'success',
      conversationsCount: conversationsSynced,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(client, runId, {
        status: 'success',
        conversationsFound,
        conversationsSynced,
        conversationsSkipped,
      })
    }

    return {
      success: true,
      conversationsFound,
      conversationsSynced,
      conversationsSkipped,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    console.error('[intercom.sync] Sync failed:', error)

    // Update sync state
    await updateSyncState(client, projectId, {
      status: 'error',
      error: errorMessage,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(client, runId, {
        status: 'error',
        conversationsFound,
        conversationsSynced,
        conversationsSkipped,
        errorMessage,
      })
    }

    // Handle specific error types
    if (error instanceof IntercomRateLimitError) {
      return {
        success: false,
        conversationsFound,
        conversationsSynced,
        conversationsSkipped,
        error: `Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`,
      }
    }

    if (error instanceof IntercomApiError) {
      return {
        success: false,
        conversationsFound,
        conversationsSynced,
        conversationsSkipped,
        error: `Intercom API error: ${error.message}`,
      }
    }

    return {
      success: false,
      conversationsFound,
      conversationsSynced,
      conversationsSkipped,
      error: errorMessage,
    }
  }
}
