/**
 * Intercom conversation sync logic.
 * Handles fetching conversations from Intercom and creating Hissuno sessions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  IntercomClient,
  type IntercomContact,
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
  type: 'progress' | 'synced' | 'error'
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
 * Sync mode
 */
export type SyncMode = 'incremental' | 'full'

/**
 * Sync options
 */
export interface SyncOptions {
  triggeredBy: 'manual' | 'cron'
  filterConfig?: IntercomFilterConfig
  syncMode?: SyncMode
  onProgress?: (event: SyncProgressEvent) => void
  signal?: AbortSignal
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
 * Build enriched user metadata from a full Intercom contact
 */
function buildUserMetadata(
  conversationId: string,
  contact: IntercomContact | null
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    intercom_conversation_id: conversationId,
  }
  if (!contact) return metadata

  if (contact.name) metadata.name = contact.name
  if (contact.email) metadata.email = contact.email
  if (contact.phone) metadata.phone = contact.phone
  if (contact.role) metadata.role = contact.role
  if (contact.location?.city) metadata.city = contact.location.city
  if (contact.location?.region) metadata.region = contact.location.region
  if (contact.location?.country) metadata.country = contact.location.country
  if (contact.companies?.companies?.[0]?.name) {
    metadata.company = contact.companies.companies[0].name
  }
  if (contact.browser) metadata.browser = contact.browser
  if (contact.os) metadata.os = contact.os
  if (contact.last_seen_at) {
    metadata.last_seen_at = new Date(contact.last_seen_at * 1000).toISOString()
  }
  if (contact.signed_up_at) {
    metadata.signed_up_at = new Date(contact.signed_up_at * 1000).toISOString()
  }
  if (contact.tags?.tags?.length) {
    metadata.tags = contact.tags.tags.map((t) => t.name).join(', ')
  }
  if (contact.social_profiles?.data?.length) {
    for (const profile of contact.social_profiles.data) {
      metadata[`social_${profile.name.toLowerCase()}`] = profile.url
    }
  }
  if (contact.custom_attributes) {
    for (const [key, value] of Object.entries(contact.custom_attributes)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        metadata[`custom_${key}`] = String(value)
      }
    }
  }

  return metadata
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
  intercom: IntercomClient,
  projectId: string,
  connectionId: string,
  conversation: IntercomConversation
): Promise<{ sessionId: string; messageCount: number } | null> {
  const sessionId = generateSessionId(conversation.id)

  // Fetch full contact data (the conversation only has minimal contact refs)
  const embeddedContact = conversation.contacts?.contacts?.[0]
  let fullContact: IntercomContact | null = null
  if (embeddedContact?.id) {
    try {
      fullContact = await intercom.getContact(embeddedContact.id)
    } catch (err) {
      console.warn('[intercom.sync] Failed to fetch contact details:', err)
      fullContact = embeddedContact
    }
  }

  const userId = fullContact?.external_id || fullContact?.id || null
  const userMetadata = buildUserMetadata(conversation.id, fullContact)

  // Create session
  const { error: sessionError } = await supabase.from('sessions').insert({
    id: sessionId,
    project_id: projectId,
    source: 'intercom',
    status: 'closed', // Historical data is always closed
    name: generateSessionName(conversation),
    user_id: userId,
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

  // Handle sync mode
  const syncMode = options.syncMode ?? 'incremental'

  if (syncMode === 'full') {
    console.log('[intercom.sync] Full sync: scanning from configured start date')
  }

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

  // In incremental mode, use lastSyncAt as fromDate floor if it's more recent
  if (syncMode === 'incremental' && credentials.lastSyncAt) {
    const lastSyncDate = new Date(credentials.lastSyncAt)
    if (!fromDate || lastSyncDate > fromDate) {
      fromDate = lastSyncDate
      console.log(`[intercom.sync] Incremental sync: using lastSyncAt ${credentials.lastSyncAt} as fromDate`)
    }
  }

  const CONCURRENCY = 5
  let conversationsFound = 0
  let conversationsSynced = 0
  let conversationsSkipped = 0

  try {
    // Process a single conversation: check dedup, fetch full details, create session
    const processConversation = async (conversation: IntercomConversationListItem) => {
      // Check if already synced
      const alreadySynced = await isConversationSynced(
        client,
        credentials.connectionId,
        conversation.id
      )

      if (alreadySynced) {
        conversationsSkipped++
        console.log(`[intercom.sync] Skipped conversation ${conversation.id} (already synced)`)
        return
      }

      try {
        // Fetch full conversation with parts
        const fullConversation = await intercom.getConversation(conversation.id)

        // Create session and messages
        const result = await createSessionFromConversation(
          client,
          intercom,
          projectId,
          credentials.connectionId,
          fullConversation
        )

        if (result) {
          conversationsSynced++
          console.log(`[intercom.sync] Synced conversation ${fullConversation.id} → session ${result.sessionId} (${result.messageCount} messages)`)
        } else {
          conversationsSkipped++
          console.warn(`[intercom.sync] Failed to create session for: ${fullConversation.id}`)
        }
      } catch (convError) {
        console.error(`[intercom.sync] Error processing conversation ${conversation.id}:`, convError)
        conversationsSkipped++
      }
    }

    // Single pass: iterate conversations, process in parallel batches
    let batch: IntercomConversationListItem[] = []

    for await (const conversation of intercom.searchConversations({
      fromDate,
      toDate,
      onProgress: (_fetched, total) => {
        conversationsFound = total
      },
    })) {
      if (options.signal?.aborted) break

      batch.push(conversation)

      if (batch.length >= CONCURRENCY) {
        await Promise.all(batch.map(processConversation))
        batch = []

        options.onProgress?.({
          type: 'progress',
          message: `Syncing... ${conversationsSynced} synced, ${conversationsSkipped} skipped of ${conversationsFound}`,
          current: conversationsSynced + conversationsSkipped,
          total: conversationsFound,
        })
      }
    }

    // Process remaining partial batch
    if (batch.length > 0 && !options.signal?.aborted) {
      await Promise.all(batch.map(processConversation))

      options.onProgress?.({
        type: 'progress',
        message: `Syncing... ${conversationsSynced} synced, ${conversationsSkipped} skipped of ${conversationsFound}`,
        current: conversationsSynced + conversationsSkipped,
        total: conversationsFound,
      })
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
