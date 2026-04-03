/**
 * Pure helper functions for Gong sync logic.
 * Extracted from sync.ts for testability.
 */

import type { GongParticipant, GongCallListItem } from './client'

/**
 * Map Gong participant affiliation to Hissuno sender type
 */
export function mapParticipantToSenderType(participant: GongParticipant): 'user' | 'human_agent' {
  // External participants are customers, internal are team members
  if (participant.affiliation === 'external') {
    return 'user'
  }
  return 'human_agent'
}

/**
 * Get display name for a participant
 */
export function getParticipantName(participant: GongParticipant): string {
  return participant.name || participant.emailAddress || participant.speakerId || 'Unknown Speaker'
}

/**
 * Build a speaker ID to participant map from call parties
 */
export function buildSpeakerMap(parties?: GongParticipant[]): Map<string, GongParticipant> {
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
export function generateSessionId(callId: string): string {
  return `gong-${callId}-${Date.now()}`
}

/**
 * Generate session name from call data
 */
export function generateSessionName(call: GongCallListItem): string {
  if (call.title) {
    return call.title
  }

  const date = new Date(call.started)
  return `Gong Call - ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

/**
 * Build user metadata from Gong call
 */
export function buildUserMetadata(
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
