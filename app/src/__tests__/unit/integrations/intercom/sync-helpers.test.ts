import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  mapAuthorTypeToSenderType,
  generateSessionId,
  buildUserMetadata,
  generateSessionName,
} from '@/lib/integrations/intercom/sync-helpers'
import type { IntercomContact, IntercomConversation } from '@/lib/integrations/intercom/client'

describe('mapAuthorTypeToSenderType', () => {
  it('returns "user" for user author type', () => {
    expect(mapAuthorTypeToSenderType('user')).toBe('user')
  })

  it('returns "human_agent" for admin author type', () => {
    expect(mapAuthorTypeToSenderType('admin')).toBe('human_agent')
  })

  it('returns "ai" for bot author type', () => {
    expect(mapAuthorTypeToSenderType('bot')).toBe('ai')
  })

  it('returns "human_agent" for team author type', () => {
    expect(mapAuthorTypeToSenderType('team')).toBe('human_agent')
  })

  it('returns "human_agent" for unknown author type', () => {
    expect(mapAuthorTypeToSenderType('unknown')).toBe('human_agent')
    expect(mapAuthorTypeToSenderType('')).toBe('human_agent')
    expect(mapAuthorTypeToSenderType('lead')).toBe('human_agent')
  })
})

describe('generateSessionId', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns expected format with intercom prefix, conversation id, and timestamp', () => {
    const result = generateSessionId('conv-123')
    expect(result).toBe(`intercom-conv-123-${Date.now()}`)
  })

  it('handles numeric conversation IDs', () => {
    const result = generateSessionId('456789')
    expect(result).toMatch(/^intercom-456789-\d+$/)
  })
})

describe('buildUserMetadata', () => {
  it('returns only conversation ID for null contact', () => {
    const result = buildUserMetadata('conv-1', null)
    expect(result).toEqual({
      intercom_conversation_id: 'conv-1',
    })
  })

  it('handles minimal contact with only required fields', () => {
    const contact: IntercomContact = {
      type: 'contact',
      id: 'c-1',
      role: 'user',
    }
    const result = buildUserMetadata('conv-2', contact)
    expect(result).toEqual({
      intercom_conversation_id: 'conv-2',
      role: 'user',
    })
  })

  it('handles full contact with all fields populated', () => {
    const contact: IntercomContact = {
      type: 'contact',
      id: 'c-full',
      external_id: 'ext-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      role: 'user',
      location: {
        city: 'San Francisco',
        region: 'California',
        country: 'US',
      },
      companies: {
        companies: [{ id: 'comp-1', name: 'Acme Inc' }],
      },
      browser: 'Chrome',
      os: 'macOS',
      last_seen_at: 1700000000,
      signed_up_at: 1690000000,
      tags: {
        tags: [
          { id: 't1', name: 'VIP' },
          { id: 't2', name: 'Enterprise' },
        ],
      },
    }

    const result = buildUserMetadata('conv-3', contact)
    expect(result.intercom_conversation_id).toBe('conv-3')
    expect(result.name).toBe('Jane Doe')
    expect(result.email).toBe('jane@example.com')
    expect(result.phone).toBe('+1234567890')
    expect(result.role).toBe('user')
    expect(result.city).toBe('San Francisco')
    expect(result.region).toBe('California')
    expect(result.country).toBe('US')
    expect(result.company).toBe('Acme Inc')
    expect(result.browser).toBe('Chrome')
    expect(result.os).toBe('macOS')
    expect(result.last_seen_at).toBe(new Date(1700000000 * 1000).toISOString())
    expect(result.signed_up_at).toBe(new Date(1690000000 * 1000).toISOString())
    expect(result.tags).toBe('VIP, Enterprise')
  })

  it('handles contact with social profiles', () => {
    const contact: IntercomContact = {
      type: 'contact',
      id: 'c-social',
      role: 'lead',
      social_profiles: {
        data: [
          { type: 'social_profile', name: 'Twitter', url: 'https://twitter.com/jane' },
          { type: 'social_profile', name: 'LinkedIn', url: 'https://linkedin.com/in/jane' },
        ],
      },
    }
    const result = buildUserMetadata('conv-4', contact)
    expect(result.social_twitter).toBe('https://twitter.com/jane')
    expect(result.social_linkedin).toBe('https://linkedin.com/in/jane')
    expect(result.role).toBe('lead')
  })

  it('handles contact with custom attributes', () => {
    const contact: IntercomContact = {
      type: 'contact',
      id: 'c-custom',
      role: 'user',
      custom_attributes: {
        plan: 'enterprise',
        seats: 50,
        active: true,
        nested: { complex: 'value' },
      },
    }
    const result = buildUserMetadata('conv-5', contact)
    expect(result.custom_plan).toBe('enterprise')
    expect(result.custom_seats).toBe('50')
    expect(result.custom_active).toBe('true')
    // Complex values should be skipped
    expect(result).not.toHaveProperty('custom_nested')
  })
})

describe('generateSessionName', () => {
  const baseConversation: IntercomConversation = {
    type: 'conversation',
    id: 'conv-1',
    title: null,
    created_at: 1700000000,
    updated_at: 1700001000,
    state: 'closed',
    read: true,
    waiting_since: null,
    snoozed_until: null,
    source: {
      type: 'conversation',
      id: 'src-1',
      body: null,
      delivered_as: 'customer_initiated',
      author: { type: 'user', id: 'u-1' },
    },
    contacts: { contacts: [] },
    conversation_parts: {
      type: 'conversation_part.list',
      conversation_parts: [],
      total_count: 0,
    },
  }

  it('returns title when conversation has a title', () => {
    const conversation = { ...baseConversation, title: 'Billing Question' }
    expect(generateSessionName(conversation)).toBe('Billing Question')
  })

  it('returns truncated body when body exceeds 50 characters', () => {
    const longBody = 'This is a very long message body that definitely exceeds the fifty character limit we set'
    const conversation = {
      ...baseConversation,
      source: { ...baseConversation.source, body: longBody },
    }
    const result = generateSessionName(conversation)
    expect(result).toBe(longBody.substring(0, 47) + '...')
    expect(result.length).toBe(50)
  })

  it('returns full body when body is under 50 characters', () => {
    const shortBody = 'How do I reset my password?'
    const conversation = {
      ...baseConversation,
      source: { ...baseConversation.source, body: shortBody },
    }
    expect(generateSessionName(conversation)).toBe('How do I reset my password?')
  })

  it('returns "Intercom Conversation" for empty conversation', () => {
    expect(generateSessionName(baseConversation)).toBe('Intercom Conversation')
  })
})
