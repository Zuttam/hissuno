/**
 * Unit tests for session type pure functions and constants.
 */

import { describe, it, expect } from 'vitest'
import {
  getDefaultSessionType,
  isNativeTag,
  getTagInfo,
  getSessionUserDisplay,
  SESSION_TAGS,
  SESSION_TAG_INFO,
  SESSION_TYPE_INFO,
  SESSION_SOURCE_INFO,
} from '@/types/session'
import type { SessionSource, SessionWithProject } from '@/types/session'

// ---------------------------------------------------------------------------
// getDefaultSessionType
// ---------------------------------------------------------------------------

describe('getDefaultSessionType', () => {
  it('returns "meeting" for gong source', () => {
    expect(getDefaultSessionType('gong')).toBe('meeting')
  })

  it('returns "behavioral" for posthog source', () => {
    expect(getDefaultSessionType('posthog')).toBe('behavioral')
  })

  const chatSources: SessionSource[] = ['widget', 'slack', 'intercom', 'zendesk', 'api', 'manual']
  for (const source of chatSources) {
    it(`returns "chat" for ${source} source`, () => {
      expect(getDefaultSessionType(source)).toBe('chat')
    })
  }
})

// ---------------------------------------------------------------------------
// isNativeTag
// ---------------------------------------------------------------------------

describe('isNativeTag', () => {
  for (const tag of SESSION_TAGS) {
    it(`returns true for native tag "${tag}"`, () => {
      expect(isNativeTag(tag)).toBe(true)
    })
  }

  it('returns false for a custom tag slug', () => {
    expect(isNativeTag('custom_tag_slug')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isNativeTag('')).toBe(false)
  })

  it('returns false for a close-but-wrong tag', () => {
    expect(isNativeTag('Bug')).toBe(false) // case-sensitive
    expect(isNativeTag('feature-request')).toBe(false) // hyphen vs underscore
  })
})

// ---------------------------------------------------------------------------
// getTagInfo
// ---------------------------------------------------------------------------

describe('getTagInfo', () => {
  it('returns native tag info for a built-in tag', () => {
    const result = getTagInfo('bug')
    expect(result).toEqual({
      label: 'Bug',
      variant: 'danger',
    })
  })

  it('returns native tag info for feature_request', () => {
    const result = getTagInfo('feature_request')
    expect(result).toEqual({
      label: 'Feature Request',
      variant: 'warning',
    })
  })

  it('falls back to default for unknown tags', () => {
    const result = getTagInfo('totally_unknown')
    expect(result).toEqual({
      label: 'totally_unknown',
      variant: 'default',
    })
  })
})

// ---------------------------------------------------------------------------
// getSessionUserDisplay
// ---------------------------------------------------------------------------

describe('getSessionUserDisplay', () => {
  function makeSession(overrides: Partial<SessionWithProject> = {}): SessionWithProject {
    return {
      id: 's-1',
      project_id: 'p-1',
      user_metadata: null,
      page_url: null,
      page_title: null,
      name: null,
      description: null,
      source: 'widget',
      session_type: 'chat',
      message_count: 0,
      status: 'active',
      tags: [],
      custom_fields: {},
      first_message_at: null,
      last_activity_at: '2025-01-01T00:00:00Z',
      goodbye_detected_at: null,
      idle_prompt_sent_at: null,
      scheduled_close_at: null,
      is_archived: false,
      is_human_takeover: false,
      human_takeover_at: null,
      human_takeover_user_id: null,
      human_takeover_slack_channel_id: null,
      human_takeover_slack_thread_ts: null,
      base_processed_at: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      project: null,
      ...overrides,
    }
  }

  it('returns contact name and company when session has linked contact', () => {
    const session = makeSession({
      contact: {
        id: 'c-1',
        name: 'Jane Doe',
        email: 'jane@acme.com',
        company: { id: 'co-1', name: 'Acme Corp', domain: 'acme.com', arr: 100000, stage: 'customer' },
      },
    })
    const result = getSessionUserDisplay(session)
    expect(result).toEqual({
      name: 'Jane Doe',
      isHissuno: false,
      contactId: 'c-1',
      companyName: 'Acme Corp',
    })
  })

  it('returns contact name without company when contact has no company', () => {
    const session = makeSession({
      contact: {
        id: 'c-1',
        name: 'Solo User',
        email: 'solo@test.com',
        company: null,
      },
    })
    const result = getSessionUserDisplay(session)
    expect(result.name).toBe('Solo User')
    expect(result.companyName).toBeUndefined()
  })

  it('falls back to metadata name when no contact', () => {
    const session = makeSession({
      user_metadata: { name: 'Meta Name', email: 'meta@test.com' },
    })
    const result = getSessionUserDisplay(session)
    expect(result.name).toBe('Meta Name')
    expect(result.isHissuno).toBe(false)
  })

  it('falls back to metadata email when no contact or name', () => {
    const session = makeSession({
      user_metadata: { email: 'fallback@test.com' },
    })
    const result = getSessionUserDisplay(session)
    expect(result.name).toBe('fallback@test.com')
  })

  it('falls back to metadata userId as last resort', () => {
    const session = makeSession({
      user_metadata: { userId: 'uid-123' },
    })
    const result = getSessionUserDisplay(session)
    expect(result.name).toBe('uid-123')
  })

  it('returns null name when no identifying info exists', () => {
    const session = makeSession()
    const result = getSessionUserDisplay(session)
    expect(result.name).toBeNull()
    expect(result.isHissuno).toBe(false)
  })

  it('prefers contact over metadata when both exist', () => {
    const session = makeSession({
      contact: {
        id: 'c-1',
        name: 'Contact Name',
        email: 'contact@test.com',
        company: null,
      },
      user_metadata: { name: 'Metadata Name' },
    })
    const result = getSessionUserDisplay(session)
    expect(result.name).toBe('Contact Name')
  })
})

// ---------------------------------------------------------------------------
// Constants completeness
// ---------------------------------------------------------------------------

describe('session constants', () => {
  it('SESSION_TAG_INFO has info for every SESSION_TAGS entry', () => {
    for (const tag of SESSION_TAGS) {
      expect(SESSION_TAG_INFO[tag]).toBeDefined()
      expect(SESSION_TAG_INFO[tag].label).toBeTruthy()
      expect(SESSION_TAG_INFO[tag].variant).toBeTruthy()
    }
  })

  it('SESSION_TYPE_INFO has entries for chat, meeting, behavioral', () => {
    expect(SESSION_TYPE_INFO.chat).toBeDefined()
    expect(SESSION_TYPE_INFO.meeting).toBeDefined()
    expect(SESSION_TYPE_INFO.behavioral).toBeDefined()
  })

  it('SESSION_SOURCE_INFO has entries for all sources', () => {
    const sources: SessionSource[] = ['widget', 'slack', 'intercom', 'zendesk', 'gong', 'posthog', 'api', 'manual']
    for (const source of sources) {
      expect(SESSION_SOURCE_INFO[source]).toBeDefined()
      expect(SESSION_SOURCE_INFO[source].label).toBeTruthy()
    }
  })
})
