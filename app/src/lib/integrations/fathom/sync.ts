/**
 * Fathom meeting sync logic.
 * Handles fetching meetings from Fathom and creating Hissuno sessions.
 */

import crypto from 'crypto'
import { db } from '@/lib/db'
import { eq, and, sql } from 'drizzle-orm'
import { sessions } from '@/lib/db/schema/app'
import { createSessionWithMessagesAdmin } from '@/lib/sessions/sessions-service'
import {
  FathomClient,
  type FathomMeeting,
  type FathomTranscriptEntry,
  type FathomInvitee,
  FathomApiError,
  FathomRateLimitError,
} from './client'
import {
  getFathomCredentials,
  recordSyncedMeeting,
  updateSyncState,
  createSyncRun,
  completeSyncRun,
  type FathomFilterConfig,
} from './index'

/**
 * Progress event during sync
 */
export interface SyncProgressEvent {
  type: 'progress' | 'synced' | 'skipped' | 'error'
  meetingId?: string
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
  meetingsFound: number
  meetingsSynced: number
  meetingsSkipped: number
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
  filterConfig?: FathomFilterConfig
  syncMode?: SyncMode
  onProgress?: (event: SyncProgressEvent) => void
  signal?: AbortSignal
}

/**
 * Map Fathom invitee to Hissuno sender type
 */
function mapInviteeToSenderType(invitee: FathomInvitee): 'user' | 'human_agent' {
  // External participants are customers, internal are team members
  if (invitee.is_external) {
    return 'user'
  }
  return 'human_agent'
}

/**
 * Extract speaker name from a transcript entry, handling various Fathom API formats
 */
function getEntrySpeakerName(entry: FathomTranscriptEntry): string | undefined {
  return entry.speaker_name || entry.speakerName || entry.speaker?.name || undefined
}

/**
 * Extract speaker email from a transcript entry, handling various Fathom API formats
 */
function getEntrySpeakerEmail(entry: FathomTranscriptEntry): string | undefined {
  return entry.speaker_email || entry.speakerEmail || entry.speaker?.email || undefined
}

/**
 * Get display name for a transcript speaker
 */
function getSpeakerName(entry: FathomTranscriptEntry): string {
  return getEntrySpeakerName(entry) || getEntrySpeakerEmail(entry) || 'Unknown Speaker'
}

/**
 * Determine sender type for a transcript entry by matching against invitees
 */
function getSenderType(entry: FathomTranscriptEntry, invitees: FathomInvitee[]): 'user' | 'human_agent' {
  if (!invitees.length) return 'human_agent'

  const email = getEntrySpeakerEmail(entry)
  const name = getEntrySpeakerName(entry)

  // Try to match by email
  if (email) {
    const match = invitees.find((i) => i.email === email)
    if (match) return mapInviteeToSenderType(match)
  }

  // Try to match by name
  if (name) {
    const match = invitees.find((i) => i.name === name)
    if (match) return mapInviteeToSenderType(match)
  }

  return 'human_agent'
}

/**
 * Extract summary text from a Fathom meeting summary field.
 * The default_summary can be a string or an object with markdown/text fields.
 */
function extractSummaryText(summary: unknown): string | null {
  if (!summary) return null
  if (typeof summary === 'string') return summary
  if (typeof summary === 'object') {
    const obj = summary as Record<string, unknown>
    if (typeof obj.markdown_formatted === 'string') return obj.markdown_formatted
    if (typeof obj.markdown === 'string') return obj.markdown
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.summary === 'string') return obj.summary
    // Last resort: stringify the object
    try { return JSON.stringify(summary) } catch { return null }
  }
  return null
}

/**
 * Generate a session ID from Fathom meeting.
 * Must be a valid UUID since the sessions table uses uuid primary key.
 */
function generateSessionId(): string {
  return crypto.randomUUID()
}

/**
 * Generate session name from meeting data
 */
function generateSessionName(meeting: FathomMeeting): string {
  if (meeting.title) {
    return meeting.title
  }

  const date = new Date(meeting.created_at)
  return `Fathom Meeting - ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

/**
 * Calculate meeting duration in seconds
 */
function calculateDuration(meeting: FathomMeeting): number | undefined {
  if (meeting.recording_start_time && meeting.recording_end_time) {
    const start = new Date(meeting.recording_start_time).getTime()
    const end = new Date(meeting.recording_end_time).getTime()
    return Math.round((end - start) / 1000)
  }
  return undefined
}

/**
 * Build user metadata from Fathom meeting
 */
function buildUserMetadata(
  meeting: FathomMeeting,
  externalInvitee: FathomInvitee | null
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    fathom_meeting_id: meeting.id,
    fathom_url: meeting.url || meeting.share_url,
    fathom_meeting_type: meeting.meeting_type,
    fathom_recorded_by: meeting.recorded_by,
    fathom_participants_count: meeting.calendar_invitees?.length || 0,
  }

  const duration = calculateDuration(meeting)
  if (duration !== undefined) {
    metadata.fathom_duration_seconds = duration
  }

  if (externalInvitee) {
    if (externalInvitee.name) metadata.name = externalInvitee.name
    if (externalInvitee.email) metadata.email = externalInvitee.email
  }

  // Store participant details for display in session details
  if (meeting.calendar_invitees && meeting.calendar_invitees.length > 0) {
    metadata.fathom_participants = meeting.calendar_invitees.map((p) => ({
      name: p.name || p.email || 'Unknown',
      email: p.email || null,
      is_external: p.is_external ?? false,
    }))
  }

  return metadata
}

/**
 * Create a session and messages from a Fathom meeting
 */
async function createSessionFromFathomMeeting(
  projectId: string,
  connectionId: string,
  meeting: FathomMeeting,
  transcript: FathomTranscriptEntry[] | null,
  summary: string | null
): Promise<{ sessionId: string; messageCount: number } | null> {
  const sessionId = generateSessionId()
  const invitees = meeting.calendar_invitees || []
  const duration = calculateDuration(meeting)

  // Find the first external invitee for user metadata
  const externalInvitee = invitees.find((p) => p.is_external) || null
  const userId = externalInvitee?.email || externalInvitee?.name || null
  const userMetadata = buildUserMetadata(meeting, externalInvitee)

  const meetingStartTime = meeting.recording_start_time || meeting.scheduled_start_time || meeting.created_at
  const meetingEndTime = meeting.recording_end_time || meeting.scheduled_end_time

  // Build messages from transcript
  const messages: Array<{ sender_type: string; content: string; created_at?: Date }> = []

  // Add summary as first system message if available
  if (summary) {
    messages.push({
      sender_type: 'system',
      content: `[Meeting Summary]\n${summary}`,
      created_at: new Date(meetingStartTime),
    })
  }

  if (transcript) {
    for (const entry of transcript) {
      const text = entry.text?.trim()
      if (!text) continue

      const speakerName = getSpeakerName(entry)
      const senderType = getSenderType(entry, invitees)

      // Use entry start time for message timestamp (handle both snake_case and camelCase)
      const entryStartTime = entry.start_time ?? entry.startTime
      const messageTime = entryStartTime
        ? new Date(new Date(meetingStartTime).getTime() + entryStartTime * 1000)
        : new Date(meetingStartTime)

      messages.push({
        sender_type: senderType,
        content: `[${speakerName}]: ${text}`,
        created_at: messageTime,
      })
    }
  }

  // Add action items as a final system message if available
  if (meeting.action_items && meeting.action_items.length > 0) {
    const actionItemsText = meeting.action_items
      .map((item) => `- ${item.text}${item.assignee ? ` (${item.assignee})` : ''}`)
      .join('\n')
    messages.push({
      sender_type: 'system',
      content: `[Action Items]\n${actionItemsText}`,
      created_at: meetingEndTime ? new Date(meetingEndTime) : new Date(meetingStartTime),
    })
  }

  // Create session with messages via service
  const result = await createSessionWithMessagesAdmin({
    id: sessionId,
    projectId,
    source: 'fathom',
    sessionType: 'meeting',
    status: 'closed',
    name: generateSessionName(meeting),
    userMetadata: { ...userMetadata, ...(userId ? { userId } : {}) },
    firstMessageAt: new Date(meetingStartTime),
    lastActivityAt: meetingEndTime
      ? new Date(meetingEndTime)
      : duration
        ? new Date(new Date(meetingStartTime).getTime() + duration * 1000)
        : new Date(meetingStartTime),
    createdAt: new Date(meeting.created_at),
    messages,
  })

  if (!result) return null

  // Record the sync
  await recordSyncedMeeting({
    connectionId,
    fathomMeetingId: meeting.id,
    sessionId: result.sessionId,
    meetingCreatedAt: meeting.created_at,
    meetingDurationSeconds: duration,
    messagesCount: result.messageCount,
  })

  return { sessionId: result.sessionId, messageCount: result.messageCount }
}

/**
 * Sync Fathom meetings for a project.
 * This is the main sync function called by API routes.
 */
export async function syncFathomMeetings(
  projectId: string,
  options: SyncOptions
): Promise<SyncResult> {
  // Get credentials
  const credentials = await getFathomCredentials(projectId)
  if (!credentials) {
    return {
      success: false,
      meetingsFound: 0,
      meetingsSynced: 0,
      meetingsSkipped: 0,
      error: 'Fathom is not connected.',
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
    console.log('[fathom.sync] Full sync: scanning from configured start date')
  }

  // Initialize API client
  const fathom = new FathomClient(credentials.apiKey)

  // Parse date filters (use options override, fall back to stored config)
  const filterConfig = options.filterConfig || credentials.filterConfig || {}
  let createdAfter: string | undefined
  let createdBefore: string | undefined
  if (filterConfig.fromDate) {
    createdAfter = new Date(filterConfig.fromDate).toISOString()
  }
  if (filterConfig.toDate) {
    createdBefore = new Date(filterConfig.toDate).toISOString()
  }

  // In incremental mode, use lastSyncAt as createdAfter floor if it's more recent
  if (syncMode === 'incremental' && credentials.lastSyncAt) {
    const lastSyncDate = new Date(credentials.lastSyncAt)
    if (!createdAfter || lastSyncDate > new Date(createdAfter)) {
      createdAfter = lastSyncDate.toISOString()
      console.log(`[fathom.sync] Incremental sync: using lastSyncAt ${credentials.lastSyncAt} as createdAfter`)
    }
  }

  let meetingsFound = 0
  let meetingsSynced = 0
  let meetingsSkipped = 0

  try {
    // Pre-fetch all synced fathom meeting IDs from actual sessions (not tracking table)
    // This ensures dedup works even after disconnect/reconnect cycles
    const syncedRows = await db
      .select({ fathom_id: sql<string>`user_metadata->>'fathom_meeting_id'` })
      .from(sessions)
      .where(and(eq(sessions.project_id, projectId), eq(sessions.source, 'fathom')))
    const syncedMeetingIds = new Set(syncedRows.map((r) => r.fathom_id).filter(Boolean))

    // Collect meetings to sync
    const meetingsToSync: FathomMeeting[] = []

    for await (const meeting of fathom.listAllMeetings({
      createdAfter,
      createdBefore,
      includeTranscript: true,
      includeSummary: true,
      onProgress: (fetched) => {
        meetingsFound = fetched
        options.onProgress?.({
          type: 'progress',
          message: `Scanning meetings... ${fetched} found`,
          current: fetched,
          total: fetched,
        })
      },
    })) {
      if (options.signal?.aborted) break

      // Check if already synced (in-memory lookup instead of DB query per meeting)
      if (syncedMeetingIds.has(meeting.id)) {
        meetingsSkipped++
        options.onProgress?.({
          type: 'skipped',
          meetingId: meeting.id,
          message: `Skipped (already synced): ${meeting.title || meeting.id}`,
          current: meetingsSkipped + meetingsSynced,
          total: meetingsFound,
        })
        continue
      }

      meetingsToSync.push(meeting)
    }

    // Process each meeting
    for (let i = 0; i < meetingsToSync.length; i++) {
      if (options.signal?.aborted) break

      const meeting = meetingsToSync[i]

      try {
        // Check if listing transcript has speaker info; if not, fetch separately
        let transcript = meeting.transcript || null
        let summary = extractSummaryText(meeting.default_summary)

        // The listing API's include_transcript often omits speaker attribution.
        // Fetch individually if transcript lacks speaker info.
        const listingTranscriptHasSpeakers = transcript?.some(
          (e) => e.speaker_name || e.speakerName || e.speaker?.name || e.speaker_email || e.speakerEmail || e.speaker?.email
        )
        if (!transcript || !listingTranscriptHasSpeakers) {
          try {
            const fetched = await fathom.getMeetingTranscript(meeting.id)
            if (fetched && fetched.length > 0) transcript = fetched
          } catch (err) {
            console.warn(`[fathom.sync] Failed to fetch transcript for ${meeting.id}:`, err)
          }
        }

        if (!summary) {
          try {
            const summaryData = await fathom.getMeetingSummary(meeting.id)
            summary = summaryData.markdown || null
          } catch (err) {
            console.warn(`[fathom.sync] Failed to fetch summary for ${meeting.id}:`, err)
          }
        }

        // Create session and messages
        const result = await createSessionFromFathomMeeting(
          projectId,
          credentials.connectionId,
          meeting,
          transcript,
          summary
        )

        if (result) {
          meetingsSynced++
          options.onProgress?.({
            type: 'synced',
            meetingId: meeting.id,
            sessionId: result.sessionId,
            message: `Synced: ${meeting.title || meeting.id} (${result.messageCount} messages)`,
            current: meetingsSynced + meetingsSkipped,
            total: meetingsToSync.length + meetingsSkipped,
          })
        } else {
          meetingsSkipped++
          options.onProgress?.({
            type: 'error',
            meetingId: meeting.id,
            message: `Failed to create session for: ${meeting.id}`,
            current: meetingsSynced + meetingsSkipped,
            total: meetingsToSync.length + meetingsSkipped,
          })
        }
      } catch (meetingError) {
        console.error(`[fathom.sync] Error processing meeting ${meeting.id}:`, meetingError)
        meetingsSkipped++
        options.onProgress?.({
          type: 'error',
          meetingId: meeting.id,
          message: `Error: ${meetingError instanceof Error ? meetingError.message : 'Unknown error'}`,
          current: meetingsSynced + meetingsSkipped,
          total: meetingsToSync.length + meetingsSkipped,
        })
      }
    }

    // Update sync state
    await updateSyncState(projectId, {
      status: 'success',
      meetingsCount: meetingsSynced,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(runId, {
        status: 'success',
        meetingsFound,
        meetingsSynced,
        meetingsSkipped,
      })
    }

    return {
      success: true,
      meetingsFound,
      meetingsSynced,
      meetingsSkipped,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    console.error('[fathom.sync] Sync failed:', error)

    // Update sync state
    await updateSyncState(projectId, {
      status: 'error',
      error: errorMessage,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(runId, {
        status: 'error',
        meetingsFound,
        meetingsSynced,
        meetingsSkipped,
        errorMessage,
      })
    }

    // Handle specific error types
    if (error instanceof FathomRateLimitError) {
      return {
        success: false,
        meetingsFound,
        meetingsSynced,
        meetingsSkipped,
        error: `Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`,
      }
    }

    if (error instanceof FathomApiError) {
      return {
        success: false,
        meetingsFound,
        meetingsSynced,
        meetingsSkipped,
        error: `Fathom API error: ${error.message}`,
      }
    }

    return {
      success: false,
      meetingsFound,
      meetingsSynced,
      meetingsSkipped,
      error: errorMessage,
    }
  }
}
