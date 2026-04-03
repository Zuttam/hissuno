import { describe, it, expect } from 'vitest'
import {
  mapAuthorToSenderType,
  generateSessionId,
  buildUserMetadata,
} from '@/lib/integrations/zendesk/sync-helpers'
import type { ZendeskTicket, ZendeskUser, ZendeskOrganization } from '@/lib/integrations/zendesk/client'

function makeTicket(overrides: Partial<ZendeskTicket> = {}): ZendeskTicket {
  return {
    id: 100,
    subject: 'Test ticket',
    description: 'A test ticket',
    status: 'closed',
    priority: null,
    requester_id: 1,
    tags: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    ...overrides,
  }
}

function makeUser(overrides: Partial<ZendeskUser> = {}): ZendeskUser {
  return {
    id: 1,
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'end-user',
    ...overrides,
  }
}

function makeOrganization(overrides: Partial<ZendeskOrganization> = {}): ZendeskOrganization {
  return {
    id: 10,
    name: 'Acme Inc',
    ...overrides,
  }
}

describe('mapAuthorToSenderType', () => {
  it('returns user when author is the requester', () => {
    expect(mapAuthorToSenderType(42, 42)).toBe('user')
  })

  it('returns human_agent when author is not the requester', () => {
    expect(mapAuthorToSenderType(42, 99)).toBe('human_agent')
  })
})

describe('generateSessionId', () => {
  it('returns expected format with ticket id and project id', () => {
    expect(generateSessionId(123, 'proj_abc')).toBe('zendesk-123-proj_abc')
  })

  it('handles numeric edge cases', () => {
    expect(generateSessionId(0, 'p')).toBe('zendesk-0-p')
  })
})

describe('buildUserMetadata', () => {
  it('returns ticket id when user is null', () => {
    const ticket = makeTicket({ id: 555 })
    const result = buildUserMetadata(ticket, null, null)
    expect(result).toEqual({ zendesk_ticket_id: 555 })
  })

  it('returns minimal fields for a user with only name and email', () => {
    const ticket = makeTicket({ id: 1 })
    const user = makeUser({ name: 'Bob', email: 'bob@example.com' })
    const result = buildUserMetadata(ticket, user, null)
    expect(result).toMatchObject({
      zendesk_ticket_id: 1,
      name: 'Bob',
      email: 'bob@example.com',
    })
    expect(result).not.toHaveProperty('company')
  })

  it('includes organization data when provided', () => {
    const ticket = makeTicket()
    const user = makeUser()
    const org = makeOrganization({ name: 'Acme', domain_names: ['acme.com'] })
    const result = buildUserMetadata(ticket, user, org)
    expect(result.company).toBe('Acme')
    expect(result.company_domain).toBe('acme.com')
  })

  it('includes tags from ticket and user', () => {
    const ticket = makeTicket({ tags: ['vip', 'enterprise'] })
    const user = makeUser({ tags: ['beta'] })
    const result = buildUserMetadata(ticket, user, null)
    expect(result.zendesk_tags).toBe('vip, enterprise')
    expect(result.zendesk_user_tags).toBe('beta')
  })

  it('includes priority and group_id from ticket', () => {
    const ticket = makeTicket({ priority: 'high', group_id: 7 })
    const result = buildUserMetadata(ticket, null, null)
    expect(result.zendesk_priority).toBe('high')
    expect(result.zendesk_group_id).toBe('7')
  })

  it('includes phone and timezone from user', () => {
    const user = makeUser({ phone: '+1555123', time_zone: 'America/New_York' })
    const result = buildUserMetadata(makeTicket(), user, null)
    expect(result.phone).toBe('+1555123')
    expect(result.timezone).toBe('America/New_York')
  })

  it('handles organization without domain_names', () => {
    const org = makeOrganization({ name: 'NoDomain Corp' })
    const result = buildUserMetadata(makeTicket(), null, org)
    expect(result.company).toBe('NoDomain Corp')
    expect(result).not.toHaveProperty('company_domain')
  })
})
