/**
 * Intercom conversation sync logic.
 * Handles fetching conversations from Intercom and creating Hissuno sessions.
 */

import { createSessionWithMessagesAdmin } from '@/lib/sessions/sessions-service'
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
  getSyncedConversationIds,
  recordSyncedConversation,
  updateSyncState,
  createSyncRun,
  completeSyncRun,
  type IntercomFilterConfig,
} from './index'
import {
  mapAuthorTypeToSenderType,
  generateSessionId,
  buildUserMetadata,
  generateSessionName,
} from './sync-helpers'

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
 * Create a session and messages from an Intercom conversation
 */
async function createSessionFromConversation(
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

  // Collect all messages (source + parts)
  const messages: Array<{ sender_type: string; content: string; created_at?: Date }> = []

  // Add source message (first message in conversation)
  if (conversation.source?.body) {
    messages.push({
      sender_type: mapAuthorTypeToSenderType(conversation.source.author.type),
      content: conversation.source.body,
      created_at: new Date(conversation.created_at * 1000),
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
      sender_type: mapAuthorTypeToSenderType(part.author.type),
      content: part.body,
      created_at: new Date(part.created_at * 1000),
    })
  }

  // Create session with messages via service
  const result = await createSessionWithMessagesAdmin({
    id: sessionId,
    projectId,
    source: 'intercom',
    status: 'closed',
    name: generateSessionName(conversation),
    userMetadata: { ...userMetadata, ...(userId ? { userId } : {}) },
    firstMessageAt: new Date(conversation.created_at * 1000),
    lastActivityAt: new Date(conversation.updated_at * 1000),
    createdAt: new Date(conversation.created_at * 1000),
    messages,
  })

  if (!result) return null

  // Record the sync
  await recordSyncedConversation({
    connectionId,
    intercomConversationId: conversation.id,
    sessionId: result.sessionId,
    conversationCreatedAt: new Date(conversation.created_at * 1000).toISOString(),
    conversationUpdatedAt: new Date(conversation.updated_at * 1000).toISOString(),
    partsCount: result.messageCount,
  })

  return { sessionId: result.sessionId, messageCount: result.messageCount }
}

/**
 * Sync Intercom conversations for a project.
 * This is the main sync function called by API routes.
 */
export async function syncIntercomConversations(
  projectId: string,
  options: SyncOptions
): Promise<SyncResult> {
  // Get credentials
  const credentials = await getIntercomCredentials(projectId)
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
  const runResult = await createSyncRun(credentials.connectionId, options.triggeredBy)
  const runId = runResult?.runId

  // Mark sync as in progress
  await updateSyncState(projectId, { status: 'in_progress' })

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
    // Pre-fetch all synced conversation IDs to avoid N+1 queries
    const syncedConversationIds = await getSyncedConversationIds(credentials.connectionId)

    // Process a single conversation: check dedup, fetch full details, create session
    const processConversation = async (conversation: IntercomConversationListItem) => {
      // Check if already synced
      const alreadySynced = syncedConversationIds.has(conversation.id)

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
          intercom,
          projectId,
          credentials.connectionId,
          fullConversation
        )

        if (result) {
          conversationsSynced++
          console.log(`[intercom.sync] Synced conversation ${fullConversation.id} -> session ${result.sessionId} (${result.messageCount} messages)`)
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
    await updateSyncState(projectId, {
      status: 'success',
      conversationsCount: conversationsSynced,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(runId, {
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
    await updateSyncState(projectId, {
      status: 'error',
      error: errorMessage,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(runId, {
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
