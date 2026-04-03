/**
 * Pure helper functions for Fathom meeting sync.
 * Extracted from sync.ts for testability.
 */

import crypto from 'crypto'
import type { FathomMeeting, FathomTranscriptEntry, FathomInvitee } from './client'

/**
 * Map Fathom invitee to Hissuno sender type
 */
export function mapInviteeToSenderType(invitee: FathomInvitee): 'user' | 'human_agent' {
  // External participants are customers, internal are team members
  if (invitee.is_external) {
    return 'user'
  }
  return 'human_agent'
}

/**
 * Extract speaker name from a transcript entry, handling various Fathom API formats
 */
export function getEntrySpeakerName(entry: FathomTranscriptEntry): string | undefined {
  return entry.speaker_name || entry.speakerName || entry.speaker?.name || undefined
}

/**
 * Extract speaker email from a transcript entry, handling various Fathom API formats
 */
export function getEntrySpeakerEmail(entry: FathomTranscriptEntry): string | undefined {
  return entry.speaker_email || entry.speakerEmail || entry.speaker?.email || undefined
}

/**
 * Get display name for a transcript speaker
 */
export function getSpeakerName(entry: FathomTranscriptEntry): string {
  return getEntrySpeakerName(entry) || getEntrySpeakerEmail(entry) || 'Unknown Speaker'
}

/**
 * Determine sender type for a transcript entry by matching against invitees
 */
export function getSenderType(entry: FathomTranscriptEntry, invitees: FathomInvitee[]): 'user' | 'human_agent' {
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
export function extractSummaryText(summary: unknown): string | null {
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
export function generateSessionId(): string {
  return crypto.randomUUID()
}

/**
 * Generate session name from meeting data
 */
export function generateSessionName(meeting: FathomMeeting): string {
  if (meeting.title) {
    return meeting.title
  }

  const date = new Date(meeting.created_at)
  return `Fathom Meeting - ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

/**
 * Calculate meeting duration in seconds
 */
export function calculateDuration(meeting: FathomMeeting): number | undefined {
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
export function buildUserMetadata(
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
