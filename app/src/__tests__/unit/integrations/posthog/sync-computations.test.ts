import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeEngagementScore,
  computeEngagementTrend,
  computeFeatureUsage,
  computeRecentSignals,
} from '@/lib/integrations/posthog/sync-computations'
import type { PosthogEvent } from '@/lib/integrations/posthog/client'
import type { PosthogEventConfig } from '@/lib/integrations/posthog/index'

// ============================================================================
// Helpers
// ============================================================================

const NOW = new Date('2026-04-03T12:00:00Z').getTime()

function makeEvent(overrides: Partial<PosthogEvent> & { daysAgo?: number } = {}): PosthogEvent {
  const { daysAgo, ...rest } = overrides
  const timestamp =
    rest.timestamp ?? new Date(NOW - (daysAgo ?? 0) * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: crypto.randomUUID(),
    event: 'page_view',
    properties: {},
    timestamp,
    distinct_id: 'user-1',
    ...rest,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('computeEngagementScore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 for empty events array', () => {
    expect(computeEngagementScore([])).toBe(0)
  })

  it('returns high score for all recent events (within 7 days)', () => {
    // 10 events * weight 3 = 30, normalized: round(30/200*100) = 15
    const events = Array.from({ length: 10 }, () => makeEvent({ daysAgo: 2 }))
    const score = computeEngagementScore(events)
    expect(score).toBe(15)
  })

  it('returns lower score for all old events (15-30 days)', () => {
    // 10 events * weight 1 = 10, normalized: round(10/200*100) = 5
    const events = Array.from({ length: 10 }, () => makeEvent({ daysAgo: 20 }))
    const score = computeEngagementScore(events)
    expect(score).toBe(5)
  })

  it('returns weighted score for mixed-age events', () => {
    const events = [
      ...Array.from({ length: 5 }, () => makeEvent({ daysAgo: 3 })),   // 5*3 = 15
      ...Array.from({ length: 5 }, () => makeEvent({ daysAgo: 10 })),  // 5*2 = 10
      ...Array.from({ length: 5 }, () => makeEvent({ daysAgo: 25 })),  // 5*1 = 5
    ]
    // total = 30, normalized: round(30/200*100) = 15
    const score = computeEngagementScore(events)
    expect(score).toBe(15)
  })

  it('caps score at 100', () => {
    // 300 recent events * weight 3 = 900, normalized: min(100, round(900/200*100)) = 100
    const events = Array.from({ length: 300 }, () => makeEvent({ daysAgo: 1 }))
    const score = computeEngagementScore(events)
    expect(score).toBe(100)
  })
})

describe('computeEngagementTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns stable for empty events', () => {
    expect(computeEngagementTrend([])).toBe('stable')
  })

  it('returns growing when recent events outnumber prior by >15%', () => {
    const events = [
      ...Array.from({ length: 20 }, () => makeEvent({ daysAgo: 5 })),  // recent (0-15d)
      ...Array.from({ length: 10 }, () => makeEvent({ daysAgo: 20 })), // prior (15-30d)
    ]
    // changeRate = (20-10)/10 = 1.0 > 0.15
    expect(computeEngagementTrend(events)).toBe('growing')
  })

  it('returns declining when prior events outnumber recent by >15%', () => {
    const events = [
      ...Array.from({ length: 5 }, () => makeEvent({ daysAgo: 5 })),   // recent
      ...Array.from({ length: 20 }, () => makeEvent({ daysAgo: 20 })), // prior
    ]
    // changeRate = (5-20)/20 = -0.75 < -0.15
    expect(computeEngagementTrend(events)).toBe('declining')
  })

  it('returns stable when change rate is within 15%', () => {
    const events = [
      ...Array.from({ length: 10 }, () => makeEvent({ daysAgo: 5 })),  // recent
      ...Array.from({ length: 10 }, () => makeEvent({ daysAgo: 20 })), // prior
    ]
    // changeRate = (10-10)/10 = 0
    expect(computeEngagementTrend(events)).toBe('stable')
  })

  it('returns growing when only recent events exist', () => {
    const events = Array.from({ length: 5 }, () => makeEvent({ daysAgo: 3 }))
    // priorCount = 0, recentCount > 0
    expect(computeEngagementTrend(events)).toBe('growing')
  })
})

describe('computeFeatureUsage', () => {
  it('returns empty object when feature_mapping is undefined', () => {
    const config: PosthogEventConfig = {}
    expect(computeFeatureUsage([], config)).toEqual({})
  })

  it('returns empty object for empty events', () => {
    const config: PosthogEventConfig = {
      feature_mapping: { Export: ['export_csv', 'export_pdf'] },
    }
    expect(computeFeatureUsage([], config)).toEqual({})
  })

  it('maps events to feature names correctly', () => {
    const config: PosthogEventConfig = {
      feature_mapping: {
        Export: ['export_csv', 'export_pdf'],
        Search: ['search_query'],
      },
    }
    const events = [
      makeEvent({ event: 'export_csv' }),
      makeEvent({ event: 'export_pdf' }),
      makeEvent({ event: 'search_query' }),
      makeEvent({ event: 'unrelated_event' }),
    ]
    expect(computeFeatureUsage(events, config)).toEqual({
      Export: 2,
      Search: 1,
    })
  })

  it('handles events that match multiple features', () => {
    const config: PosthogEventConfig = {
      feature_mapping: {
        Analytics: ['page_view'],
        Tracking: ['page_view', 'click'],
      },
    }
    const events = [
      makeEvent({ event: 'page_view' }),
      makeEvent({ event: 'click' }),
    ]
    expect(computeFeatureUsage(events, config)).toEqual({
      Analytics: 1,
      Tracking: 2,
    })
  })
})

describe('computeRecentSignals', () => {
  it('returns empty array when no events match signal patterns', () => {
    const config: PosthogEventConfig = { signal_events: ['$exception'] }
    const events = [makeEvent({ event: 'page_view' })]
    expect(computeRecentSignals(events, config)).toEqual([])
  })

  it('matches exact signal event names', () => {
    const config: PosthogEventConfig = { signal_events: ['$exception', '$rageclick'] }
    const events = [
      makeEvent({ event: '$exception', timestamp: '2026-04-02T10:00:00Z' }),
      makeEvent({ event: '$rageclick', timestamp: '2026-04-01T10:00:00Z' }),
    ]
    const signals = computeRecentSignals(events, config)
    expect(signals).toHaveLength(2)
    expect(signals[0].event).toBe('$exception')
    expect(signals[1].event).toBe('$rageclick')
  })

  it('matches wildcard *error* patterns', () => {
    const config: PosthogEventConfig = { signal_events: ['*error*'] }
    const events = [
      makeEvent({ event: 'api_error_500', timestamp: '2026-04-02T10:00:00Z' }),
      makeEvent({ event: 'ValidationError', timestamp: '2026-04-01T10:00:00Z' }),
      makeEvent({ event: 'page_view', timestamp: '2026-04-01T09:00:00Z' }),
    ]
    const signals = computeRecentSignals(events, config)
    expect(signals).toHaveLength(2)
    expect(signals.map((s) => s.event).sort()).toEqual(['ValidationError', 'api_error_500'])
  })

  it('aggregates count for repeated signal events', () => {
    const config: PosthogEventConfig = { signal_events: ['$exception'] }
    const events = [
      makeEvent({ event: '$exception', timestamp: '2026-04-03T10:00:00Z' }),
      makeEvent({ event: '$exception', timestamp: '2026-04-02T10:00:00Z' }),
      makeEvent({ event: '$exception', timestamp: '2026-04-01T10:00:00Z' }),
    ]
    const signals = computeRecentSignals(events, config)
    expect(signals).toHaveLength(1)
    expect(signals[0].count).toBe(3)
    expect(signals[0].last_seen).toBe('2026-04-03T10:00:00.000Z')
  })
})
