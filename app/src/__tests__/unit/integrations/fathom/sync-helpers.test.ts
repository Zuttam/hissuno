/**
 * Fathom Sync Helpers Unit Tests
 *
 * Tests the pure helper functions extracted from sync.ts:
 * - Invitee type mapping
 * - Transcript entry speaker extraction
 * - Summary text extraction
 * - Session ID/name generation
 * - Duration calculation
 * - User metadata building
 */

import { describe, it, expect } from 'vitest'
import {
  mapInviteeToSenderType,
  getEntrySpeakerName,
  getEntrySpeakerEmail,
  getSpeakerName,
  getSenderType,
  extractSummaryText,
  generateSessionId,
  generateSessionName,
  calculateDuration,
  buildUserMetadata,
} from '@/lib/integrations/fathom/sync-helpers'
import type { FathomMeeting, FathomTranscriptEntry, FathomInvitee } from '@/lib/integrations/fathom/client'

// ============================================================================
// mapInviteeToSenderType
// ============================================================================

describe('mapInviteeToSenderType', () => {
  it('returns user for external invitee', () => {
    const invitee: FathomInvitee = { name: 'Customer', email: 'customer@example.com', is_external: true }
    expect(mapInviteeToSenderType(invitee)).toBe('user')
  })

  it('returns human_agent for internal invitee', () => {
    const invitee: FathomInvitee = { name: 'Team Member', email: 'member@company.com', is_external: false }
    expect(mapInviteeToSenderType(invitee)).toBe('human_agent')
  })
})

// ============================================================================
// getEntrySpeakerName
// ============================================================================

describe('getEntrySpeakerName', () => {
  it('returns speaker_name when present', () => {
    const entry: FathomTranscriptEntry = { speaker_name: 'Alice', text: 'Hello' }
    expect(getEntrySpeakerName(entry)).toBe('Alice')
  })

  it('returns speakerName when speaker_name is absent', () => {
    const entry: FathomTranscriptEntry = { speakerName: 'Bob', text: 'Hi' }
    expect(getEntrySpeakerName(entry)).toBe('Bob')
  })

  it('returns speaker.name when flat fields are absent', () => {
    const entry: FathomTranscriptEntry = { speaker: { name: 'Charlie' }, text: 'Hey' }
    expect(getEntrySpeakerName(entry)).toBe('Charlie')
  })

  it('returns undefined when no speaker name exists', () => {
    const entry: FathomTranscriptEntry = { text: 'Some text' }
    expect(getEntrySpeakerName(entry)).toBeUndefined()
  })
})

// ============================================================================
// getEntrySpeakerEmail
// ============================================================================

describe('getEntrySpeakerEmail', () => {
  it('returns speaker_email when present', () => {
    const entry: FathomTranscriptEntry = { speaker_email: 'alice@example.com', text: 'Hello' }
    expect(getEntrySpeakerEmail(entry)).toBe('alice@example.com')
  })

  it('returns speakerEmail when speaker_email is absent', () => {
    const entry: FathomTranscriptEntry = { speakerEmail: 'bob@example.com', text: 'Hi' }
    expect(getEntrySpeakerEmail(entry)).toBe('bob@example.com')
  })

  it('returns speaker.email when flat fields are absent', () => {
    const entry: FathomTranscriptEntry = { speaker: { email: 'charlie@example.com' }, text: 'Hey' }
    expect(getEntrySpeakerEmail(entry)).toBe('charlie@example.com')
  })

  it('returns undefined when no speaker email exists', () => {
    const entry: FathomTranscriptEntry = { text: 'Some text' }
    expect(getEntrySpeakerEmail(entry)).toBeUndefined()
  })
})

// ============================================================================
// getSpeakerName
// ============================================================================

describe('getSpeakerName', () => {
  it('returns name when speaker has a name', () => {
    const entry: FathomTranscriptEntry = { speaker_name: 'Alice', text: 'Hello' }
    expect(getSpeakerName(entry)).toBe('Alice')
  })

  it('returns email when speaker has no name but has email', () => {
    const entry: FathomTranscriptEntry = { speaker_email: 'alice@example.com', text: 'Hello' }
    expect(getSpeakerName(entry)).toBe('alice@example.com')
  })

  it('returns Unknown Speaker as fallback', () => {
    const entry: FathomTranscriptEntry = { text: 'Hello' }
    expect(getSpeakerName(entry)).toBe('Unknown Speaker')
  })
})

// ============================================================================
// getSenderType
// ============================================================================

describe('getSenderType', () => {
  it('returns user when email matches an external invitee', () => {
    const entry: FathomTranscriptEntry = { speaker_email: 'customer@example.com', text: 'Hi' }
    const invitees: FathomInvitee[] = [
      { name: 'Customer', email: 'customer@example.com', is_external: true },
    ]
    expect(getSenderType(entry, invitees)).toBe('user')
  })

  it('returns human_agent when name matches an internal invitee', () => {
    const entry: FathomTranscriptEntry = { speaker_name: 'Team Member', text: 'Hi' }
    const invitees: FathomInvitee[] = [
      { name: 'Team Member', email: 'member@company.com', is_external: false },
    ]
    expect(getSenderType(entry, invitees)).toBe('human_agent')
  })

  it('returns human_agent when no match is found', () => {
    const entry: FathomTranscriptEntry = { speaker_name: 'Unknown Person', text: 'Hi' }
    const invitees: FathomInvitee[] = [
      { name: 'Team Member', email: 'member@company.com', is_external: false },
    ]
    expect(getSenderType(entry, invitees)).toBe('human_agent')
  })

  it('returns human_agent when invitees list is empty', () => {
    const entry: FathomTranscriptEntry = { speaker_name: 'Alice', text: 'Hi' }
    expect(getSenderType(entry, [])).toBe('human_agent')
  })
})

// ============================================================================
// extractSummaryText
// ============================================================================

describe('extractSummaryText', () => {
  it('returns the string directly for string input', () => {
    expect(extractSummaryText('This is a summary')).toBe('This is a summary')
  })

  it('returns markdown_formatted from object input', () => {
    expect(extractSummaryText({ markdown_formatted: '# Summary' })).toBe('# Summary')
  })

  it('returns text field from object input', () => {
    expect(extractSummaryText({ text: 'Plain text summary' })).toBe('Plain text summary')
  })

  it('returns null for null input', () => {
    expect(extractSummaryText(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(extractSummaryText(undefined)).toBeNull()
  })

  it('returns stringified JSON for object without known fields', () => {
    const obj = { custom_field: 'value' }
    expect(extractSummaryText(obj)).toBe(JSON.stringify(obj))
  })
})

// ============================================================================
// generateSessionId
// ============================================================================

describe('generateSessionId', () => {
  it('returns a valid UUID format', () => {
    const id = generateSessionId()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    expect(id).toMatch(uuidRegex)
  })
})

// ============================================================================
// generateSessionName
// ============================================================================

describe('generateSessionName', () => {
  it('returns meeting title when present', () => {
    const meeting = { id: 'm1', title: 'Q4 Planning', created_at: '2024-06-15T10:00:00Z' } as FathomMeeting
    expect(generateSessionName(meeting)).toBe('Q4 Planning')
  })

  it('returns formatted fallback when title is absent', () => {
    const meeting = { id: 'm1', created_at: '2024-06-15T10:00:00Z' } as FathomMeeting
    const name = generateSessionName(meeting)
    expect(name).toContain('Fathom Meeting')
    expect(name).toContain('Jun')
    expect(name).toContain('15')
    expect(name).toContain('2024')
  })
})

// ============================================================================
// calculateDuration
// ============================================================================

describe('calculateDuration', () => {
  it('returns duration in seconds for valid start and end times', () => {
    const meeting = {
      id: 'm1',
      created_at: '2024-06-15T10:00:00Z',
      recording_start_time: '2024-06-15T10:00:00Z',
      recording_end_time: '2024-06-15T10:30:00Z',
    } as FathomMeeting
    expect(calculateDuration(meeting)).toBe(1800) // 30 minutes
  })

  it('returns undefined when start time is missing', () => {
    const meeting = {
      id: 'm1',
      created_at: '2024-06-15T10:00:00Z',
      recording_end_time: '2024-06-15T10:30:00Z',
    } as FathomMeeting
    expect(calculateDuration(meeting)).toBeUndefined()
  })

  it('returns undefined when end time is missing', () => {
    const meeting = {
      id: 'm1',
      created_at: '2024-06-15T10:00:00Z',
      recording_start_time: '2024-06-15T10:00:00Z',
    } as FathomMeeting
    expect(calculateDuration(meeting)).toBeUndefined()
  })
})

// ============================================================================
// buildUserMetadata
// ============================================================================

describe('buildUserMetadata', () => {
  it('returns metadata with invitee data when provided', () => {
    const meeting: FathomMeeting = {
      id: 'm1',
      created_at: '2024-06-15T10:00:00Z',
      url: 'https://fathom.video/m1',
      meeting_type: 'external',
      recorded_by: 'recorder@company.com',
      calendar_invitees: [
        { name: 'Customer', email: 'customer@example.com', is_external: true },
        { name: 'Agent', email: 'agent@company.com', is_external: false },
      ],
    }
    const invitee: FathomInvitee = { name: 'Customer', email: 'customer@example.com', is_external: true }

    const metadata = buildUserMetadata(meeting, invitee)
    expect(metadata.fathom_meeting_id).toBe('m1')
    expect(metadata.fathom_url).toBe('https://fathom.video/m1')
    expect(metadata.name).toBe('Customer')
    expect(metadata.email).toBe('customer@example.com')
    expect(metadata.fathom_participants_count).toBe(2)
    expect(metadata.fathom_participants).toHaveLength(2)
  })

  it('returns metadata without invitee fields when invitee is null', () => {
    const meeting: FathomMeeting = {
      id: 'm2',
      created_at: '2024-06-15T10:00:00Z',
      share_url: 'https://fathom.video/share/m2',
      recorded_by: 'recorder@company.com',
    }

    const metadata = buildUserMetadata(meeting, null)
    expect(metadata.fathom_meeting_id).toBe('m2')
    expect(metadata.fathom_url).toBe('https://fathom.video/share/m2')
    expect(metadata.name).toBeUndefined()
    expect(metadata.email).toBeUndefined()
    expect(metadata.fathom_participants_count).toBe(0)
  })
})
