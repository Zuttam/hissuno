import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeReach } from '@/lib/issues/reach'

describe('computeReach', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('edge cases', () => {
    it('returns score 1 with "No session data available" for empty timestamps', () => {
      const result = computeReach({ sessionTimestamps: [], sessionCount: 0 })
      expect(result.score).toBe(1)
      expect(result.reasoning).toBe('No session data available')
    })

    it('returns score 1 with "No recent activity" when all timestamps are older than window', () => {
      const oldDate = new Date('2025-01-01T12:00:00Z') // well outside 14-day window
      const result = computeReach({ sessionTimestamps: [oldDate], sessionCount: 0 })
      expect(result.score).toBe(1)
      expect(result.reasoning).toBe('No recent activity')
    })

    it('returns score 1 with "Single mention in window" for a single session', () => {
      const recent = new Date('2025-06-14T12:00:00Z') // 1 day ago
      const result = computeReach({ sessionTimestamps: [recent], sessionCount: 0 })
      expect(result.score).toBe(1)
      expect(result.reasoning).toContain('Single mention in window')
    })
  })

  describe('score 2: low activity', () => {
    it('scores 2 for 2+ sessions in window with low density', () => {
      const timestamps = [
        new Date('2025-06-14T12:00:00Z'),
        new Date('2025-06-13T12:00:00Z'),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 0 })
      expect(result.score).toBe(2)
      expect(result.reasoning).toContain('sessions in 14-day window')
    })
  })

  describe('score 3: moderate activity', () => {
    it('scores 3 for density >= 0.25/day', () => {
      // Need 4+ sessions in 14 days for density >= 0.25
      const timestamps = [
        new Date('2025-06-15T10:00:00Z'),
        new Date('2025-06-14T10:00:00Z'),
        new Date('2025-06-13T10:00:00Z'),
        new Date('2025-06-12T10:00:00Z'),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 0 })
      expect(result.score).toBe(3)
      expect(result.reasoning).toContain('Moderate density')
    })

    it('scores 3 for 3-4 linked sessions', () => {
      const timestamps = [
        new Date('2025-06-14T12:00:00Z'),
        new Date('2025-06-13T12:00:00Z'),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 3 })
      expect(result.score).toBe(3)
      expect(result.reasoning).toContain('3 linked sessions')
    })

    it('scores 3 for 4 linked sessions', () => {
      const timestamps = [
        new Date('2025-06-14T12:00:00Z'),
        new Date('2025-06-13T12:00:00Z'),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 4 })
      expect(result.score).toBe(3)
      expect(result.reasoning).toContain('4 linked sessions')
    })
  })

  describe('score 4: high activity', () => {
    it('scores 4 for density >= 0.5/day', () => {
      // Need 7+ sessions in 14 days for density >= 0.5
      const timestamps = Array.from({ length: 7 }, (_, i) =>
        new Date(`2025-06-${String(15 - i).padStart(2, '0')}T10:00:00Z`)
      )
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 0 })
      expect(result.score).toBe(4)
      expect(result.reasoning).toContain('Moderate-high density')
    })

    it('scores 4 for 5+ linked sessions', () => {
      const timestamps = [
        new Date('2025-06-14T12:00:00Z'),
        new Date('2025-06-13T12:00:00Z'),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 5 })
      expect(result.score).toBe(4)
      expect(result.reasoning).toContain('5 linked sessions')
    })
  })

  describe('score 5: very high activity with acceleration', () => {
    it('scores 5 for density >= 1.0/day with positive acceleration', () => {
      // Need 14+ sessions in 14 days with more in recent half
      // Recent half (last 7 days): many sessions
      // Older half: fewer sessions
      const timestamps = [
        // Recent half (June 9-15): 12 sessions
        ...Array.from({ length: 12 }, (_, i) =>
          new Date(`2025-06-${String(15 - Math.floor(i / 2)).padStart(2, '0')}T${String(10 + (i % 2) * 3).padStart(2, '0')}:00:00Z`)
        ),
        // Older half (June 1-8): 3 sessions
        new Date('2025-06-05T10:00:00Z'),
        new Date('2025-06-04T10:00:00Z'),
        new Date('2025-06-03T10:00:00Z'),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 0 })
      expect(result.score).toBe(5)
      expect(result.reasoning).toContain('High density')
      expect(result.reasoning).toContain('positive acceleration')
    })

    it('scores 4 (not 5) for density >= 1.0/day with negative acceleration', () => {
      // More sessions in older half than recent half
      const timestamps = [
        // Recent half: 2 sessions
        new Date('2025-06-15T10:00:00Z'),
        new Date('2025-06-14T10:00:00Z'),
        // Older half: 13 sessions (spread across June 2-8)
        ...Array.from({ length: 13 }, (_, i) =>
          new Date(`2025-06-${String(8 - Math.floor(i / 2)).padStart(2, '0')}T${String(10 + (i % 3)).padStart(2, '0')}:00:00Z`)
        ),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 0 })
      // density = 15/14 > 1.0 but acceleration < 0 -> not score 5
      // Falls to score 4 (density >= 0.5)
      expect(result.score).toBe(4)
      expect(result.reasoning).toContain('decelerating')
    })
  })

  describe('acceleration annotations', () => {
    it('appends "accelerating" when acceleration > 0 and score < 5', () => {
      // Score 4 but with positive acceleration
      const timestamps = [
        // Recent half: 6 sessions
        ...Array.from({ length: 6 }, (_, i) =>
          new Date(`2025-06-${String(15 - i).padStart(2, '0')}T10:00:00Z`)
        ),
        // Older half: 1 session
        new Date('2025-06-03T10:00:00Z'),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 0 })
      expect(result.score).toBe(4)
      expect(result.reasoning).toContain('accelerating')
    })

    it('appends "decelerating" when acceleration < 0', () => {
      const timestamps = [
        // Recent half: 1 session
        new Date('2025-06-15T10:00:00Z'),
        // Older half: 3 sessions
        new Date('2025-06-05T10:00:00Z'),
        new Date('2025-06-04T10:00:00Z'),
        new Date('2025-06-03T10:00:00Z'),
      ]
      const result = computeReach({ sessionTimestamps: timestamps, sessionCount: 0 })
      expect(result.reasoning).toContain('decelerating')
    })
  })

  describe('custom windowDays', () => {
    it('uses custom window when provided', () => {
      // With a 7-day window, 2 sessions = density 2/7 ~ 0.29 -> score 3
      const timestamps = [
        new Date('2025-06-14T12:00:00Z'),
        new Date('2025-06-13T12:00:00Z'),
      ]
      const result7 = computeReach({ sessionTimestamps: timestamps, sessionCount: 0, windowDays: 7 })
      const result28 = computeReach({ sessionTimestamps: timestamps, sessionCount: 0, windowDays: 28 })
      // density 2/7 ~ 0.29 vs 2/28 ~ 0.07
      expect(result7.score).toBeGreaterThanOrEqual(result28.score)
    })
  })
})
