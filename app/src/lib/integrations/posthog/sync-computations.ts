/**
 * Pure computation functions for PostHog sync metrics.
 * Extracted from sync.ts for testability.
 */

import type { PosthogEvent } from './client'

export interface PosthogEventConfig {
  feature_mapping?: Record<string, string[]>
  signal_events?: string[]
  person_properties?: string[]
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Compute engagement score (0-100) based on event recency and frequency.
 * Events in last 7d weighted 3x, 8-14d weighted 2x, 15-30d weighted 1x.
 * Normalized to 0-100.
 */
export function computeEngagementScore(events: PosthogEvent[]): number {
  if (events.length === 0) return 0

  const now = Date.now()
  let weightedSum = 0
  for (const event of events) {
    const daysAgo = (now - new Date(event.timestamp).getTime()) / MS_PER_DAY
    if (daysAgo <= 7) {
      weightedSum += 3
    } else if (daysAgo <= 14) {
      weightedSum += 2
    } else if (daysAgo <= 30) {
      weightedSum += 1
    }
  }

  // Normalize: max expected weighted sum for a very active user (~50 events/day * 3 weight * 7 days = 1050)
  // Use 200 as a reasonable high-water mark for normalization
  const normalized = Math.min(100, Math.round((weightedSum / 200) * 100))
  return normalized
}

/**
 * Compute engagement trend by comparing last 15 days vs prior 15 days.
 * >15% increase = growing, >15% decrease = declining, else stable.
 */
export function computeEngagementTrend(events: PosthogEvent[]): string {
  if (events.length === 0) return 'stable'

  const now = Date.now()
  let recentCount = 0 // last 15 days
  let priorCount = 0 // 15-30 days ago

  for (const event of events) {
    const daysAgo = (now - new Date(event.timestamp).getTime()) / MS_PER_DAY
    if (daysAgo <= 15) {
      recentCount++
    } else if (daysAgo <= 30) {
      priorCount++
    }
  }

  if (priorCount === 0 && recentCount > 0) return 'growing'
  if (priorCount === 0 && recentCount === 0) return 'stable'

  const changeRate = (recentCount - priorCount) / priorCount
  if (changeRate > 0.15) return 'growing'
  if (changeRate < -0.15) return 'declining'
  return 'stable'
}

/**
 * Bucket events into feature areas based on event_config.feature_mapping.
 * Returns { "Feature Name": count, ... }
 */
export function computeFeatureUsage(
  events: PosthogEvent[],
  eventConfig: PosthogEventConfig
): Record<string, number> {
  const featureMapping = eventConfig.feature_mapping
  if (!featureMapping || Object.keys(featureMapping).length === 0) {
    return {}
  }

  const usage: Record<string, number> = {}

  for (const event of events) {
    for (const [featureName, eventNames] of Object.entries(featureMapping)) {
      if (eventNames.includes(event.event)) {
        usage[featureName] = (usage[featureName] || 0) + 1
      }
    }
  }

  return usage
}

/**
 * Extract recent signals from events based on signal_events config.
 * Groups by event name, returns count and last seen time.
 */
export function computeRecentSignals(
  events: PosthogEvent[],
  eventConfig: PosthogEventConfig
): Array<{ event: string; page?: string; count: number; last_seen: string }> {
  const signalEventNames = eventConfig.signal_events ?? ['$exception', '$rageclick']

  const signalMap = new Map<string, { count: number; lastSeen: Date; page?: string }>()

  for (const event of events) {
    const isSignal = signalEventNames.some((s) => {
      if (event.event === s) return true
      // Match events containing "error" or "fail" if those are in signal patterns
      if (s === '*error*' && event.event.toLowerCase().includes('error')) return true
      if (s === '*fail*' && event.event.toLowerCase().includes('fail')) return true
      return false
    })

    if (!isSignal) continue

    const existing = signalMap.get(event.event)
    const eventTime = new Date(event.timestamp)
    const page = (event.properties as Record<string, unknown>)?.$current_url as string | undefined

    if (existing) {
      existing.count++
      if (eventTime > existing.lastSeen) {
        existing.lastSeen = eventTime
        if (page) existing.page = page
      }
    } else {
      signalMap.set(event.event, { count: 1, lastSeen: eventTime, page })
    }
  }

  return Array.from(signalMap.entries())
    .map(([event, data]) => ({
      event,
      page: data.page,
      count: data.count,
      last_seen: data.lastSeen.toISOString(),
    }))
    .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
    .slice(0, 10)
}
