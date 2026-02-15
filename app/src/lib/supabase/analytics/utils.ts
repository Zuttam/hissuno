import { createClient } from '../server'
import type { AnalyticsPeriod, DistributionDataPoint, TimeSeriesPoint } from './types'

/**
 * Supabase .in() has a URI length limit. Batch large ID arrays into chunks
 * and merge results. 80 UUIDs per batch keeps the URL well under limits.
 */
const IN_BATCH_SIZE = 80

export async function batchedIn<T>(
  queryFn: (ids: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  allIds: string[],
): Promise<{ data: T[]; error: { message: string } | null }> {
  if (allIds.length === 0) return { data: [], error: null }

  const batches: string[][] = []
  for (let i = 0; i < allIds.length; i += IN_BATCH_SIZE) {
    batches.push(allIds.slice(i, i + IN_BATCH_SIZE))
  }

  const batchResults = await Promise.all(
    batches.map(async (batch, idx) => {
      const result = await queryFn(batch)
      if (result.error) {
        throw new Error(`[batchedIn] query failed on batch ${idx + 1}: ${result.error.message}`)
      }
      return result.data ?? []
    })
  )

  return { data: batchResults.flat(), error: null }
}

/**
 * Get period start date based on period string
 */
export function getPeriodStartDate(period: AnalyticsPeriod): Date | null {
  if (period === 'all') return null

  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * Get comparison period start/end dates (previous period of same length)
 */
export function getComparisonPeriod(period: AnalyticsPeriod): { start: Date; end: Date } | null {
  if (period === 'all') return null

  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90

  const end = new Date(now)
  end.setDate(end.getDate() - days)
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)

  return { start, end }
}

/**
 * Calculate percentage change between two values
 */
export function calculateChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * Get user's project IDs for filtering
 */
export async function getUserProjectIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
  const { data: userProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)

  return userProjects?.map(p => p.id) ?? []
}

/**
 * Get user's projects with IDs and names
 */
export async function getUserProjects(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Array<{ id: string; name: string }>> {
  const { data: userProjects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId)

  return (userProjects ?? []) as Array<{ id: string; name: string }>
}

/**
 * Build time series from records with created_at
 */
export function buildTimeSeries<T extends { created_at: string }>(
  records: T[],
  period: AnalyticsPeriod
): TimeSeriesPoint[] {
  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30

  // Create map of date -> count
  const countsByDate = new Map<string, number>()

  // Initialize all dates in range
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    countsByDate.set(dateStr, 0)
  }

  // Count records by date
  records.forEach(record => {
    const dateStr = record.created_at.split('T')[0]
    if (countsByDate.has(dateStr)) {
      countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1)
    }
  })

  // Convert to array
  return Array.from(countsByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))
}

/**
 * Build distribution from records by a key
 */
export function buildDistribution<T extends Record<string, unknown>>(
  records: T[],
  key: keyof T
): DistributionDataPoint[] {
  const counts = new Map<string, number>()

  records.forEach(record => {
    const value = String(record[key] ?? 'unknown')
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })

  const total = records.length
  return Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Build tag distribution from sessions
 */
export function buildTagDistribution<T extends { tags: string[] | null }>(
  records: T[]
): DistributionDataPoint[] {
  const counts = new Map<string, number>()

  records.forEach(record => {
    (record.tags ?? []).forEach((tag: string) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    })
  })

  const total = records.length
  return Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Issue status to CSS variable color mapping
 */
export const ISSUE_STATUS_COLORS: Record<string, string> = {
  open: 'var(--accent-warning)',
  ready: 'var(--accent-info)',
  in_progress: 'var(--accent-selected)',
  resolved: 'var(--accent-success)',
  closed: 'var(--accent-primary)',
}
