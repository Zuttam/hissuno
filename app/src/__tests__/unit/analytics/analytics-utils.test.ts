import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getPeriodStartDate,
  getComparisonPeriod,
  calculateChange,
  buildTimeSeries,
  buildDistribution,
  buildTagDistribution,
} from '@/lib/db/queries/analytics/utils'

describe('getPeriodStartDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for "all"', () => {
    expect(getPeriodStartDate('all')).toBeNull()
  })

  it('returns date 7 days ago for "7d"', () => {
    const result = getPeriodStartDate('7d')!
    // Build expected using same local-time logic as source
    const expected = new Date()
    expected.setDate(expected.getDate() - 7)
    expected.setHours(0, 0, 0, 0)
    expect(result.getTime()).toBe(expected.getTime())
  })

  it('returns date 30 days ago for "30d"', () => {
    const result = getPeriodStartDate('30d')!
    const expected = new Date()
    expected.setDate(expected.getDate() - 30)
    expected.setHours(0, 0, 0, 0)
    expect(result.getTime()).toBe(expected.getTime())
  })

  it('returns date 90 days ago for "90d"', () => {
    const result = getPeriodStartDate('90d')!
    const expected = new Date()
    expected.setDate(expected.getDate() - 90)
    expected.setHours(0, 0, 0, 0)
    expect(result.getTime()).toBe(expected.getTime())
  })
})

describe('getComparisonPeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for "all"', () => {
    expect(getComparisonPeriod('all')).toBeNull()
  })

  it('returns previous 7-day window for "7d"', () => {
    const result = getComparisonPeriod('7d')!
    expect(result).not.toBeNull()
    // End = 7 days ago at 23:59:59.999
    const expectedEnd = new Date()
    expectedEnd.setDate(expectedEnd.getDate() - 7)
    expectedEnd.setHours(23, 59, 59, 999)
    // Start = 14 days ago at 00:00:00.000
    const expectedStart = new Date(expectedEnd)
    expectedStart.setDate(expectedStart.getDate() - 7)
    expectedStart.setHours(0, 0, 0, 0)
    expect(result.end.getTime()).toBe(expectedEnd.getTime())
    expect(result.start.getTime()).toBe(expectedStart.getTime())
  })

  it('returns previous 30-day window for "30d"', () => {
    const result = getComparisonPeriod('30d')!
    expect(result).not.toBeNull()
    expect(result.start).toBeInstanceOf(Date)
    expect(result.end).toBeInstanceOf(Date)
    expect(result.start.getTime()).toBeLessThan(result.end.getTime())
  })
})

describe('calculateChange', () => {
  it('calculates positive change', () => {
    expect(calculateChange(10, 5)).toBe(100)
  })

  it('calculates negative change', () => {
    expect(calculateChange(5, 10)).toBe(-50)
  })

  it('returns 100 when previous is 0 and current > 0', () => {
    expect(calculateChange(5, 0)).toBe(100)
  })

  it('returns undefined when both are 0', () => {
    expect(calculateChange(0, 0)).toBeUndefined()
  })

  it('returns 0 when values are equal', () => {
    expect(calculateChange(5, 5)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    expect(calculateChange(10, 3)).toBe(233) // 233.33... -> 233
  })
})

describe('buildTimeSeries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates correct date range for 7d period', () => {
    const result = buildTimeSeries([], '7d')
    expect(result).toHaveLength(7)
    expect(result[0].date).toBe('2025-06-09')
    expect(result[6].date).toBe('2025-06-15')
  })

  it('populates counts from records', () => {
    const records = [
      { created_at: new Date('2025-06-15T10:00:00Z') },
      { created_at: new Date('2025-06-15T14:00:00Z') },
      { created_at: new Date('2025-06-14T10:00:00Z') },
    ]
    const result = buildTimeSeries(records, '7d')
    const june15 = result.find((p) => p.date === '2025-06-15')
    const june14 = result.find((p) => p.date === '2025-06-14')
    expect(june15?.count).toBe(2)
    expect(june14?.count).toBe(1)
  })

  it('ignores records with null created_at', () => {
    const records = [
      { created_at: null },
      { created_at: new Date('2025-06-15T10:00:00Z') },
    ]
    const result = buildTimeSeries(records, '7d')
    const june15 = result.find((p) => p.date === '2025-06-15')
    expect(june15?.count).toBe(1)
  })

  it('ignores records outside the window', () => {
    const records = [
      { created_at: new Date('2025-01-01T10:00:00Z') }, // way outside
    ]
    const result = buildTimeSeries(records, '7d')
    expect(result.every((p) => p.count === 0)).toBe(true)
  })

  it('uses 30 days for "all" period', () => {
    const result = buildTimeSeries([], 'all')
    expect(result).toHaveLength(30)
  })
})

describe('buildDistribution', () => {
  it('groups records by key', () => {
    const records = [
      { status: 'open' },
      { status: 'open' },
      { status: 'closed' },
    ]
    const result = buildDistribution(records, 'status')
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('open')
    expect(result[0].value).toBe(2)
  })

  it('sorts descending by value', () => {
    const records = [
      { type: 'bug' },
      { type: 'feature' },
      { type: 'feature' },
      { type: 'feature' },
    ]
    const result = buildDistribution(records, 'type')
    expect(result[0].label).toBe('feature')
    expect(result[0].value).toBe(3)
  })

  it('calculates percentages', () => {
    const records = [
      { type: 'bug' },
      { type: 'feature' },
      { type: 'feature' },
      { type: 'feature' },
    ]
    const result = buildDistribution(records, 'type')
    expect(result[0].percentage).toBe(75)
    expect(result[1].percentage).toBe(25)
  })

  it('handles empty array', () => {
    const result = buildDistribution([], 'status')
    expect(result).toHaveLength(0)
  })

  it('handles null/undefined values as "unknown"', () => {
    const records = [{ status: null }, { status: undefined }] as unknown as { status: string }[]
    const result = buildDistribution(records, 'status')
    expect(result[0].label).toBe('unknown')
    expect(result[0].value).toBe(2)
  })
})

describe('buildTagDistribution', () => {
  it('counts tags across records', () => {
    const records = [
      { tags: ['bug', 'urgent'] },
      { tags: ['bug', 'ui'] },
      { tags: ['urgent'] },
    ]
    const result = buildTagDistribution(records)
    const bugTag = result.find((d) => d.label === 'bug')
    const urgentTag = result.find((d) => d.label === 'urgent')
    expect(bugTag?.value).toBe(2)
    expect(urgentTag?.value).toBe(2)
  })

  it('handles null tags', () => {
    const records = [
      { tags: null },
      { tags: ['bug'] },
    ]
    const result = buildTagDistribution(records)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('bug')
  })

  it('calculates percentages vs total records (not total tags)', () => {
    const records = [
      { tags: ['bug'] },
      { tags: ['bug'] },
      { tags: null },
    ]
    const result = buildTagDistribution(records)
    // 2 out of 3 records -> 67%
    expect(result[0].percentage).toBe(67)
  })

  it('handles empty array', () => {
    const result = buildTagDistribution([])
    expect(result).toHaveLength(0)
  })

  it('sorts descending by value', () => {
    const records = [
      { tags: ['a', 'b'] },
      { tags: ['b', 'c'] },
      { tags: ['b'] },
    ]
    const result = buildTagDistribution(records)
    expect(result[0].label).toBe('b')
    expect(result[0].value).toBe(3)
  })
})
