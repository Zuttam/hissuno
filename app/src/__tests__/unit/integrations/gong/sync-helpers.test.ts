import { describe, it, expect, vi } from 'vitest'
import {
  mapParticipantToSenderType,
  getParticipantName,
  buildSpeakerMap,
  generateSessionId,
  generateSessionName,
  buildUserMetadata,
} from '@/lib/integrations/gong/sync-helpers'
import type { GongParticipant, GongCallListItem } from '@/lib/integrations/gong/client'

describe('mapParticipantToSenderType', () => {
  it('returns user for external participants', () => {
    const participant: GongParticipant = { id: '1', affiliation: 'external' }
    expect(mapParticipantToSenderType(participant)).toBe('user')
  })

  it('returns human_agent for internal participants', () => {
    const participant: GongParticipant = { id: '1', affiliation: 'internal' }
    expect(mapParticipantToSenderType(participant)).toBe('human_agent')
  })

  it('returns human_agent for unknown affiliation', () => {
    const participant: GongParticipant = { id: '1', affiliation: 'unknown' }
    expect(mapParticipantToSenderType(participant)).toBe('human_agent')
  })

  it('returns human_agent when affiliation is undefined', () => {
    const participant: GongParticipant = { id: '1' }
    expect(mapParticipantToSenderType(participant)).toBe('human_agent')
  })
})

describe('getParticipantName', () => {
  it('returns name when available', () => {
    const participant: GongParticipant = { id: '1', name: 'Alice', emailAddress: 'alice@test.com', speakerId: 's1' }
    expect(getParticipantName(participant)).toBe('Alice')
  })

  it('returns email when name is missing', () => {
    const participant: GongParticipant = { id: '1', emailAddress: 'alice@test.com', speakerId: 's1' }
    expect(getParticipantName(participant)).toBe('alice@test.com')
  })

  it('returns speakerId when name and email are missing', () => {
    const participant: GongParticipant = { id: '1', speakerId: 's1' }
    expect(getParticipantName(participant)).toBe('s1')
  })

  it('returns Unknown Speaker when all identifiers are missing', () => {
    const participant: GongParticipant = { id: '1' }
    expect(getParticipantName(participant)).toBe('Unknown Speaker')
  })
})

describe('buildSpeakerMap', () => {
  it('returns empty map for empty array', () => {
    const map = buildSpeakerMap([])
    expect(map.size).toBe(0)
  })

  it('returns empty map for undefined parties', () => {
    const map = buildSpeakerMap(undefined)
    expect(map.size).toBe(0)
  })

  it('skips participants without speakerId', () => {
    const parties: GongParticipant[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob', speakerId: 's2' },
    ]
    const map = buildSpeakerMap(parties)
    expect(map.size).toBe(1)
    expect(map.get('s2')?.name).toBe('Bob')
  })

  it('handles valid mapping with multiple speakers', () => {
    const parties: GongParticipant[] = [
      { id: '1', name: 'Alice', speakerId: 's1' },
      { id: '2', name: 'Bob', speakerId: 's2' },
    ]
    const map = buildSpeakerMap(parties)
    expect(map.size).toBe(2)
    expect(map.get('s1')?.name).toBe('Alice')
    expect(map.get('s2')?.name).toBe('Bob')
  })
})

describe('generateSessionId', () => {
  it('returns expected format with gong prefix and call ID', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const result = generateSessionId('call-123')
    expect(result).toBe('gong-call-123-1700000000000')
    vi.restoreAllMocks()
  })
})

describe('generateSessionName', () => {
  it('returns title when available', () => {
    const call: GongCallListItem = { id: '1', title: 'Discovery Call', started: '2024-01-15T10:00:00Z', duration: 1800 }
    expect(generateSessionName(call)).toBe('Discovery Call')
  })

  it('returns formatted date fallback when title is missing', () => {
    const call: GongCallListItem = { id: '1', started: '2024-01-15T10:00:00Z', duration: 1800 }
    const result = generateSessionName(call)
    expect(result).toMatch(/^Gong Call - Jan 15, 2024$/)
  })
})

describe('buildUserMetadata', () => {
  const baseCall: GongCallListItem = {
    id: 'call-1',
    url: 'https://gong.io/call-1',
    started: '2024-01-15T10:00:00Z',
    duration: 1800,
    direction: 'Inbound',
    scope: 'external',
    parties: [
      { id: 'p1', name: 'Alice', emailAddress: 'alice@test.com', affiliation: 'external', title: 'CEO' },
      { id: 'p2', name: 'Bob', affiliation: 'internal' },
    ],
  }

  it('returns metadata with external participant details', () => {
    const external: GongParticipant = { id: 'p1', name: 'Alice', emailAddress: 'alice@test.com', title: 'CEO' }
    const metadata = buildUserMetadata(baseCall, external)

    expect(metadata.gong_call_id).toBe('call-1')
    expect(metadata.gong_url).toBe('https://gong.io/call-1')
    expect(metadata.gong_duration_seconds).toBe(1800)
    expect(metadata.gong_direction).toBe('Inbound')
    expect(metadata.gong_scope).toBe('external')
    expect(metadata.gong_participants_count).toBe(2)
    expect(metadata.name).toBe('Alice')
    expect(metadata.email).toBe('alice@test.com')
    expect(metadata.title).toBe('CEO')
    expect(metadata.gong_participants).toHaveLength(2)
  })

  it('returns metadata without participant details when null', () => {
    const callNoParties: GongCallListItem = {
      id: 'call-2',
      started: '2024-01-15T10:00:00Z',
      duration: 600,
    }
    const metadata = buildUserMetadata(callNoParties, null)

    expect(metadata.gong_call_id).toBe('call-2')
    expect(metadata.gong_participants_count).toBe(0)
    expect(metadata.name).toBeUndefined()
    expect(metadata.email).toBeUndefined()
    expect(metadata.title).toBeUndefined()
    expect(metadata.gong_participants).toBeUndefined()
  })
})
