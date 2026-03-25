import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '@/lib/utils/format-time'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('null/undefined/empty handling', () => {
    it('returns "-" for null', () => {
      expect(formatRelativeTime(null)).toBe('-')
    })

    it('returns "-" for undefined', () => {
      expect(formatRelativeTime(undefined)).toBe('-')
    })

    it('returns "-" for empty string', () => {
      expect(formatRelativeTime('')).toBe('-')
    })
  })

  describe('"just now" threshold (<= 1 minute)', () => {
    it('returns "just now" for current time', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('just now')
    })

    it('returns "just now" for date 1 minute ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:01:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('just now')
    })

    it('returns "just now" for date 30 seconds ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:00:30Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('just now')
    })
  })

  describe('minutes threshold (2-59 minutes)', () => {
    it('returns "2m ago" for date 2 minutes ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:02:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('2m ago')
    })

    it('returns "30m ago" for date 30 minutes ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:30:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('30m ago')
    })

    it('returns "59m ago" for date 59 minutes ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:59:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('59m ago')
    })
  })

  describe('hours threshold (1-23 hours)', () => {
    it('returns "1h ago" for date exactly 1 hour ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T13:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('1h ago')
    })

    it('returns "5h ago" for date 5 hours ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T17:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('5h ago')
    })

    it('returns "23h ago" for date 23 hours ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-16T11:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('23h ago')
    })
  })

  describe('yesterday threshold (1 day)', () => {
    it('returns "yesterday" for date exactly 24 hours ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-16T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('yesterday')
    })
  })

  describe('days threshold (2-6 days)', () => {
    it('returns "3d ago" for date 3 days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-18T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('3d ago')
    })

    it('returns "6d ago" for date 6 days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-21T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('6d ago')
    })
  })

  describe('weeks threshold (7-29 days)', () => {
    it('returns "1w ago" for date 7 days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-22T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('1w ago')
    })

    it('returns "3w ago" for date 21 days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-07-06T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('3w ago')
    })
  })

  describe('months threshold (>= 30 days)', () => {
    it('returns "1mo ago" for date 30 days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-07-15T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('1mo ago')
    })

    it('returns "6mo ago" for date ~180 days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-12-15T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('6mo ago')
    })
  })

  describe('Date object input', () => {
    it('accepts Date object', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T14:00:00Z'))

      const date = new Date('2025-06-15T12:00:00Z')
      expect(formatRelativeTime(date)).toBe('2h ago')
    })
  })

  describe('edge cases', () => {
    it('handles invalid date string gracefully', () => {
      const result = formatRelativeTime('not-a-date')
      expect(typeof result).toBe('string')
    })

    it('handles future dates', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

      // Future date: diffMs is negative, diffDays is negative (< 0)
      // diffDays === 0 is false for large future diffs, falls through
      const result = formatRelativeTime('2025-06-20T12:00:00Z')
      expect(typeof result).toBe('string')
    })

    it('handles epoch zero date', () => {
      const result = formatRelativeTime('1970-01-01T00:00:00Z')
      expect(result).not.toBe('-')
      expect(typeof result).toBe('string')
    })
  })
})
