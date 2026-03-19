import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '@/lib/utils/format-time'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('null/undefined/empty handling', () => {
    it('returns "Never" for null', () => {
      expect(formatRelativeTime(null)).toBe('Never')
    })

    it('returns "Never" for undefined', () => {
      expect(formatRelativeTime(undefined)).toBe('Never')
    })

    it('returns "Never" for empty string', () => {
      expect(formatRelativeTime('')).toBe('Never')
    })
  })

  describe('"Just now" threshold (< 1 hour)', () => {
    it('returns "Just now" for date 30 minutes ago', () => {
      vi.useFakeTimers()
      const now = new Date('2025-06-15T12:00:00Z')
      vi.setSystemTime(now)

      const thirtyMinAgo = '2025-06-15T11:30:00Z'
      expect(formatRelativeTime(thirtyMinAgo)).toBe('Just now')
    })

    it('returns "Just now" for date 1 second ago', () => {
      vi.useFakeTimers()
      const now = new Date('2025-06-15T12:00:00Z')
      vi.setSystemTime(now)

      const justNow = '2025-06-15T11:59:59Z'
      expect(formatRelativeTime(justNow)).toBe('Just now')
    })

    it('returns "Just now" for current time', () => {
      vi.useFakeTimers()
      const now = new Date('2025-06-15T12:00:00Z')
      vi.setSystemTime(now)

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('Just now')
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

  describe('days threshold (1-6 days)', () => {
    it('returns "1d ago" for date exactly 24 hours ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-16T12:00:00Z'))

      expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('1d ago')
    })

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

  describe('date display threshold (>= 7 days)', () => {
    it('returns locale date string for date 7 days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-22T12:00:00Z'))

      const result = formatRelativeTime('2025-06-15T12:00:00Z')
      // Should be a locale date string, not "Xd ago"
      expect(result).not.toContain('d ago')
      expect(result).not.toContain('h ago')
      expect(result).not.toBe('Just now')
      expect(result).not.toBe('Never')
    })

    it('returns locale date string for date 30 days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-07-15T12:00:00Z'))

      const result = formatRelativeTime('2025-06-15T12:00:00Z')
      expect(result).not.toContain('d ago')
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
      // new Date('not-a-date') produces NaN time, so diff will be NaN
      // Math.floor(NaN) = NaN, NaN < 1 is false, NaN < 24 is false,
      // NaN < 7 is false, so it falls through to toLocaleDateString()
      // which returns "Invalid Date"
      const result = formatRelativeTime('not-a-date')
      expect(typeof result).toBe('string')
      // It should not crash
    })

    it('handles future dates', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

      // Future date: diff is negative, hours is negative
      // negative < 1 is true, so returns "Just now"
      const result = formatRelativeTime('2025-06-20T12:00:00Z')
      expect(result).toBe('Just now')
    })

    it('handles epoch zero date', () => {
      const result = formatRelativeTime('1970-01-01T00:00:00Z')
      // Very old date - should return locale date string
      expect(result).not.toBe('Never')
      expect(typeof result).toBe('string')
    })
  })
})
