/**
 * Pure utility function tests for lib/db/server.ts
 *
 * Tests sanitizeSearchInput, dateToIso, and UUID_REGEX - no DB or Next.js mocks needed.
 */

import { describe, it, expect } from 'vitest'
import { sanitizeSearchInput, dateToIso, UUID_REGEX } from '@/lib/db/server'

// ============================================================================
// sanitizeSearchInput
// ============================================================================

describe('sanitizeSearchInput', () => {
  it('passes through normal text unchanged', () => {
    expect(sanitizeSearchInput('hello world')).toBe('hello world')
  })

  it('passes through alphanumeric and common safe characters', () => {
    expect(sanitizeSearchInput('order-123')).toBe('order-123')
    expect(sanitizeSearchInput('foo bar baz')).toBe('foo bar baz')
    expect(sanitizeSearchInput('CamelCase')).toBe('CamelCase')
  })

  it('escapes percent sign', () => {
    expect(sanitizeSearchInput('100%')).toBe('100\\%')
    expect(sanitizeSearchInput('%wildcard%')).toBe('\\%wildcard\\%')
  })

  it('escapes underscore', () => {
    expect(sanitizeSearchInput('snake_case')).toBe('snake\\_case')
    expect(sanitizeSearchInput('__double__')).toBe('\\_\\_double\\_\\_')
  })

  it('escapes period', () => {
    expect(sanitizeSearchInput('file.txt')).toBe('file\\.txt')
    expect(sanitizeSearchInput('v1.2.3')).toBe('v1\\.2\\.3')
  })

  it('escapes comma', () => {
    expect(sanitizeSearchInput('a,b,c')).toBe('a\\,b\\,c')
  })

  it('escapes parentheses', () => {
    expect(sanitizeSearchInput('foo(bar)')).toBe('foo\\(bar\\)')
  })

  it('escapes multiple different metacharacters in one string', () => {
    expect(sanitizeSearchInput('test_%.val,(x)')).toBe('test\\_\\%\\.val\\,\\(x\\)')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeSearchInput('')).toBe('')
  })
})

// ============================================================================
// dateToIso
// ============================================================================

describe('dateToIso', () => {
  it('converts a Date to an ISO string', () => {
    const date = new Date('2024-06-15T10:30:00.000Z')
    expect(dateToIso(date)).toBe('2024-06-15T10:30:00.000Z')
  })

  it('handles epoch date', () => {
    const epoch = new Date(0)
    expect(dateToIso(epoch)).toBe('1970-01-01T00:00:00.000Z')
  })

  it('returns null for null input', () => {
    expect(dateToIso(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(dateToIso(undefined)).toBeNull()
  })
})

// ============================================================================
// UUID_REGEX
// ============================================================================

describe('UUID_REGEX', () => {
  it('matches a valid lowercase UUID', () => {
    expect(UUID_REGEX.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
  })

  it('matches a valid uppercase UUID', () => {
    expect(UUID_REGEX.test('123E4567-E89B-12D3-A456-426614174000')).toBe(true)
  })

  it('matches a valid mixed-case UUID', () => {
    expect(UUID_REGEX.test('123e4567-E89B-12d3-A456-426614174000')).toBe(true)
  })

  it('does not match a non-UUID string', () => {
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false)
  })

  it('does not match an empty string', () => {
    expect(UUID_REGEX.test('')).toBe(false)
  })

  it('does not match an email address', () => {
    expect(UUID_REGEX.test('user@email.com')).toBe(false)
  })

  it('does not match a UUID with extra characters', () => {
    expect(UUID_REGEX.test(' 123e4567-e89b-12d3-a456-426614174000')).toBe(false)
    expect(UUID_REGEX.test('123e4567-e89b-12d3-a456-426614174000 ')).toBe(false)
  })

  it('does not match a UUID missing a segment', () => {
    expect(UUID_REGEX.test('123e4567-e89b-12d3-a456')).toBe(false)
  })

  it('does not match a UUID with wrong segment lengths', () => {
    expect(UUID_REGEX.test('123e456-e89b-12d3-a456-426614174000')).toBe(false)
  })

  // UUID_REGEX uses lastIndex state when used with .test() in a loop if it has the 'g' flag.
  // Verify it works correctly on consecutive calls (i.e., no global flag side-effects).
  it('works consistently across consecutive calls', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000'
    expect(UUID_REGEX.test(uuid)).toBe(true)
    expect(UUID_REGEX.test(uuid)).toBe(true)
    expect(UUID_REGEX.test(uuid)).toBe(true)
  })
})
