/**
 * Notification Preferences Tests
 *
 * Tests getDefaultPreferences and resolvePreferences pure functions.
 * No mocking needed - these are pure utility functions.
 */

import { describe, it, expect } from 'vitest'

import {
  getDefaultPreferences,
  resolvePreferences,
  NOTIFICATION_TYPES,
} from '@/types/notification-preferences'

// ============================================================================
// getDefaultPreferences
// ============================================================================

describe('getDefaultPreferences', () => {
  it('returns object with all NOTIFICATION_TYPES as keys', () => {
    const prefs = getDefaultPreferences()

    for (const type of NOTIFICATION_TYPES) {
      expect(prefs).toHaveProperty(type)
    }
  })

  it('returns email=true and slack=false for each type', () => {
    const prefs = getDefaultPreferences()

    for (const type of NOTIFICATION_TYPES) {
      expect(prefs[type]).toEqual({ email: true, slack: false })
    }
  })

  it('returns a fresh object on each call', () => {
    const a = getDefaultPreferences()
    const b = getDefaultPreferences()

    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })
})

// ============================================================================
// resolvePreferences
// ============================================================================

describe('resolvePreferences', () => {
  it('returns defaults for null stored preferences', () => {
    const result = resolvePreferences(null)

    expect(result).toEqual(getDefaultPreferences())
  })

  it('returns defaults for undefined stored preferences', () => {
    const result = resolvePreferences(undefined)

    expect(result).toEqual(getDefaultPreferences())
  })

  it('merges partial stored preferences with defaults', () => {
    const stored = {
      human_needed: { email: false, slack: true },
    }

    const result = resolvePreferences(stored)

    expect(result.human_needed).toEqual({ email: false, slack: true })
    expect(result.weekly_digest).toEqual({ email: true, slack: false })
    expect(result.new_issue_created).toEqual({ email: true, slack: false })
  })

  it('preserves full stored preferences', () => {
    const stored = {
      human_needed: { email: false, slack: true },
      new_issue_created: { email: false, slack: false },
      session_reviewed: { email: true, slack: true },
      ready_for_dev: { email: false, slack: true },
      weekly_digest: { email: false, slack: false },
    }

    const result = resolvePreferences(stored)

    expect(result.human_needed).toEqual({ email: false, slack: true })
    expect(result.new_issue_created).toEqual({ email: false, slack: false })
    expect(result.session_reviewed).toEqual({ email: true, slack: true })
    expect(result.ready_for_dev).toEqual({ email: false, slack: true })
    expect(result.weekly_digest).toEqual({ email: false, slack: false })
  })

  it('fills in defaults for types missing from stored preferences', () => {
    const stored = {
      human_needed: { email: false, slack: true },
    }

    const result = resolvePreferences(stored)

    for (const type of NOTIFICATION_TYPES) {
      expect(result).toHaveProperty(type)
      expect(result[type]).toBeDefined()
    }
  })
})
