import { db } from '@/lib/db'
import { inArray } from 'drizzle-orm'
import { projects } from '@/lib/db/schema/app'
import { getUserProjectIds } from '@/lib/db/server'
import type { AnalyticsPeriod, DistributionDataPoint, TimeSeriesPoint } from './types'

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
 * Get accessible projects with IDs and names for a user (filtered by project_members membership)
 */
export async function getUserProjects(userId: string): Promise<Array<{ id: string; name: string }>> {
  const projectIds = await getUserProjectIds(userId)
  if (projectIds.length === 0) return []

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(inArray(projects.id, projectIds))

  return projectRows
}

/**
 * Build time series from records with created_at
 */
export function buildTimeSeries<T extends { created_at: Date | null }>(
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
    if (!record.created_at) return
    const dateStr = record.created_at.toISOString().split('T')[0]
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
