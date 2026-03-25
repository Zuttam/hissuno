/**
 * Gong call sync logic.
 * Handles fetching calls from Gong and creating Hissuno sessions.
 */

import { createSessionWithMessagesAdmin } from '@/lib/sessions/sessions-service'
import {
  GongClient,
  type GongCallListItem,
  type GongCallTranscript,
  type GongParticipant,
  GongApiError,
  GongRateLimitError,
} from './client'
import {
  getGongCredentials,
  getSyncedCallIds,
  recordSyncedCall,
  updateSyncState,
  createSyncRun,
  completeSyncRun,
  type GongFilterConfig,
} from './index'

/**
 * Progress event during sync
 */
export interface SyncProgressEvent {
  type: 'progress' | 'synced' | 'skipped' | 'error'
  callId?: string
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
  callsFound: number
  callsSynced: number
  callsSkipped: number
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
  filterConfig?: GongFilterConfig
  syncMode?: SyncMode
  onProgress?: (event: SyncProgressEvent) => void
  signal?: AbortSignal
}

/**
 * Map Gong participant affiliation to Hissuno sender type
 */
function mapParticipantToSenderType(participant: GongParticipant): 'user' | 'human_agent' {
  // External participants are customers, internal are team members
  if (participant.affiliation === 'external') {
    return 'user'
  }
  return 'human_agent'
}

/**
 * Get display name for a participant
 */
function getParticipantName(participant: GongParticipant): string {
  return participant.name || participant.emailAddress || participant.speakerId || 'Unknown Speaker'
}

/**
 * Build a speaker ID to participant map from call parties
 */
function buildSpeakerMap(parties?: GongParticipant[]): Map<string, GongParticipant> {
  const map = new Map<string, GongParticipant>()
  if (!parties) return map
  for (const party of parties) {
    if (party.speakerId) {
      map.set(party.speakerId, party)
    }
  }
  return map
}

/**
 * Generate a session ID from Gong call
 */
function generateSessionId(callId: string): string {
  return `gong-${callId}-${Date.now()}`
}

/**
 * Generate session name from call data
 */
function generateSessionName(call: GongCallListItem): string {
  if (call.title) {
    return call.title
  }

  // Generate from date
  const date = new Date(call.started)
  return `Gong Call - ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

/**
 * Build user metadata from Gong call
 */
function buildUserMetadata(
  call: GongCallListItem,
  externalParticipant: GongParticipant | null
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    gong_call_id: call.id,
    gong_url: call.url,
    gong_duration_seconds: call.duration,
    gong_direction: call.direction,
    gong_scope: call.scope,
    gong_participants_count: call.parties?.length || 0,
  }

  if (externalParticipant) {
    if (externalParticipant.name) metadata.name = externalParticipant.name
    if (externalParticipant.emailAddress) metadata.email = externalParticipant.emailAddress
    if (externalParticipant.title) metadata.title = externalParticipant.title
  }

  // Store participant details for display in session details
  if (call.parties && call.parties.length > 0) {
    metadata.gong_participants = call.parties.map((p) => ({
      name: p.name || p.emailAddress || 'Unknown',
      email: p.emailAddress || null,
      title: p.title || null,
      affiliation: p.affiliation || 'unknown',
    }))
  }

  return metadata
}

/**
 * Create a session and messages from a Gong call + transcript
 */
async function createSessionFromGongCall(
  projectId: string,
  connectionId: string,
  call: GongCallListItem,
  transcript: GongCallTranscript | null
): Promise<{ sessionId: string; messageCount: number } | null> {
  const sessionId = generateSessionId(call.id)
  const parties = call.parties || []
  const speakerMap = buildSpeakerMap(parties)

  // Find the first external participant for user metadata
  const externalParticipant = parties.find((p) => p.affiliation === 'external') || null
  const userId = externalParticipant?.emailAddress || externalParticipant?.name || null
  const userMetadata = buildUserMetadata(call, externalParticipant)

  // Build messages from transcript
  const messages: Array<{ sender_type: string; content: string; created_at?: Date }> = []

  if (transcript?.transcript) {
    for (const entry of transcript.transcript) {
      const participant = speakerMap.get(entry.speakerId)
      const speakerName = participant ? getParticipantName(participant) : 'Unknown Speaker'
      const senderType = participant ? mapParticipantToSenderType(participant) : 'human_agent'

      // Combine all sentences in this entry into one message
      const text = entry.sentences.map((s) => s.text).join(' ')
      if (!text.trim()) continue

      // Use the first sentence's start time for message timestamp
      const startMs = entry.sentences[0]?.start || 0
      const messageTime = new Date(new Date(call.started).getTime() + startMs)

      messages.push({
        sender_type: senderType,
        content: `[${speakerName}]: ${text}`,
        created_at: messageTime,
      })
    }
  }

  // Create session with messages via service
  const result = await createSessionWithMessagesAdmin({
    id: sessionId,
    projectId,
    source: 'gong',
    sessionType: 'meeting',
    status: 'closed',
    name: generateSessionName(call),
    userMetadata: { ...userMetadata, ...(userId ? { userId } : {}) },
    firstMessageAt: new Date(call.started),
    lastActivityAt: new Date(new Date(call.started).getTime() + call.duration * 1000),
    createdAt: new Date(call.started),
    messages,
  })

  if (!result) return null

  // Record the sync
  await recordSyncedCall({
    connectionId,
    gongCallId: call.id,
    sessionId: result.sessionId,
    callCreatedAt: new Date(call.started).toISOString(),
    callDurationSeconds: call.duration,
    messagesCount: result.messageCount,
  })

  return { sessionId: result.sessionId, messageCount: result.messageCount }
}

/**
 * Sync Gong calls for a project.
 * This is the main sync function called by API routes.
 */
export async function syncGongCalls(
  projectId: string,
  options: SyncOptions
): Promise<SyncResult> {
  // Get credentials
  const credentials = await getGongCredentials(projectId)
  if (!credentials) {
    return {
      success: false,
      callsFound: 0,
      callsSynced: 0,
      callsSkipped: 0,
      error: 'Gong is not connected.',
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
    console.log('[gong.sync] Full sync: scanning from configured start date')
  }

  // Initialize API client
  const gong = new GongClient(credentials.accessKey, credentials.accessKeySecret, credentials.baseUrl)

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
      console.log(`[gong.sync] Incremental sync: using lastSyncAt ${credentials.lastSyncAt} as fromDate`)
    }
  }

  let callsFound = 0
  let callsSynced = 0
  let callsSkipped = 0

  try {
    // Pre-fetch all synced call IDs to avoid N+1 queries
    const syncedCallIds = await getSyncedCallIds(credentials.connectionId)

    // First pass: collect all call IDs and check which are already synced
    const callsToSync: GongCallListItem[] = []

    for await (const call of gong.listAllCalls({
      fromDate,
      toDate,
      onProgress: (fetched, total) => {
        callsFound = total
        options.onProgress?.({
          type: 'progress',
          message: `Scanning calls... ${fetched}/${total}`,
          current: fetched,
          total,
        })
      },
    })) {
      if (options.signal?.aborted) break

      // Check if already synced
      const alreadySynced = syncedCallIds.has(call.id)

      if (alreadySynced) {
        callsSkipped++
        options.onProgress?.({
          type: 'skipped',
          callId: call.id,
          message: `Skipped (already synced): ${call.title || call.id}`,
          current: callsSkipped + callsSynced,
          total: callsFound,
        })
        continue
      }

      callsToSync.push(call)
    }

    // Enrichment pass: fetch detailed party data with speakerIds
    if (callsToSync.length > 0 && !options.signal?.aborted) {
      try {
        const callIds = callsToSync.map((c) => c.id)
        const partiesMap = await gong.getCallsWithParties(callIds)

        for (const call of callsToSync) {
          const enrichedParties = partiesMap.get(call.id)
          if (enrichedParties) {
            call.parties = enrichedParties
          }
        }

        console.log(`[gong.sync] Enriched ${partiesMap.size}/${callsToSync.length} calls with speaker data`)
      } catch (err) {
        console.warn('[gong.sync] Failed to enrich calls with speaker data, continuing with basic party info:', err)
        // Graceful degradation: speakers will show "Unknown Speaker" like before
      }
    }

    // Second pass: fetch transcripts and create sessions
    for (let i = 0; i < callsToSync.length; i++) {
      if (options.signal?.aborted) break

      const call = callsToSync[i]

      try {
        // Fetch transcript for this call
        let transcript: GongCallTranscript | null = null
        try {
          const transcripts = await gong.getTranscripts([call.id])
          transcript = transcripts[0] || null
        } catch (err) {
          console.warn(`[gong.sync] Failed to fetch transcript for ${call.id}:`, err)
          // Continue without transcript
        }

        // Create session and messages
        const result = await createSessionFromGongCall(
          projectId,
          credentials.connectionId,
          call,
          transcript
        )

        if (result) {
          callsSynced++
          options.onProgress?.({
            type: 'synced',
            callId: call.id,
            sessionId: result.sessionId,
            message: `Synced: ${call.title || call.id} (${result.messageCount} messages)`,
            current: callsSynced + callsSkipped,
            total: callsToSync.length + callsSkipped,
          })
        } else {
          callsSkipped++
          options.onProgress?.({
            type: 'error',
            callId: call.id,
            message: `Failed to create session for: ${call.id}`,
            current: callsSynced + callsSkipped,
            total: callsToSync.length + callsSkipped,
          })
        }
      } catch (callError) {
        console.error(`[gong.sync] Error processing call ${call.id}:`, callError)
        callsSkipped++
        options.onProgress?.({
          type: 'error',
          callId: call.id,
          message: `Error: ${callError instanceof Error ? callError.message : 'Unknown error'}`,
          current: callsSynced + callsSkipped,
          total: callsToSync.length + callsSkipped,
        })
      }
    }

    // Update sync state
    await updateSyncState(projectId, {
      status: 'success',
      callsCount: callsSynced,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(runId, {
        status: 'success',
        callsFound,
        callsSynced,
        callsSkipped,
      })
    }

    return {
      success: true,
      callsFound,
      callsSynced,
      callsSkipped,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    console.error('[gong.sync] Sync failed:', error)

    // Update sync state
    await updateSyncState(projectId, {
      status: 'error',
      error: errorMessage,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(runId, {
        status: 'error',
        callsFound,
        callsSynced,
        callsSkipped,
        errorMessage,
      })
    }

    // Handle specific error types
    if (error instanceof GongRateLimitError) {
      return {
        success: false,
        callsFound,
        callsSynced,
        callsSkipped,
        error: `Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`,
      }
    }

    if (error instanceof GongApiError) {
      return {
        success: false,
        callsFound,
        callsSynced,
        callsSkipped,
        error: `Gong API error: ${error.message}`,
      }
    }

    return {
      success: false,
      callsFound,
      callsSynced,
      callsSkipped,
      error: errorMessage,
    }
  }
}
