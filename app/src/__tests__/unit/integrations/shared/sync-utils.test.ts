/**
 * Unit tests for shared sync utilities and constants.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}))

import { calculateNextSyncTime, stripHtml, getConnectionsDueForSync } from '@/lib/integrations/shared/sync-utils'
import { formatSyncDate } from '@/lib/integrations/shared/sync-constants'
import { db } from '@/lib/db'

const FIXED_NOW = new Date('2025-06-15T12:00:00.000Z')

describe('calculateNextSyncTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for manual frequency', () => {
    expect(calculateNextSyncTime('manual')).toBeNull()
  })

  it('returns 1 hour ahead for 1h frequency', () => {
    const result = calculateNextSyncTime('1h')
    expect(result).toBe('2025-06-15T13:00:00.000Z')
  })

  it('returns 6 hours ahead for 6h frequency', () => {
    const result = calculateNextSyncTime('6h')
    expect(result).toBe('2025-06-15T18:00:00.000Z')
  })

  it('returns 24 hours ahead for 24h frequency', () => {
    const result = calculateNextSyncTime('24h')
    expect(result).toBe('2025-06-16T12:00:00.000Z')
  })

  it('returns a valid ISO string for non-manual frequencies', () => {
    const result = calculateNextSyncTime('1h')!
    expect(() => new Date(result)).not.toThrow()
    expect(new Date(result).toISOString()).toBe(result)
  })
})

describe('stripHtml', () => {
  it('strips basic HTML tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello')
  })

  it('strips nested HTML tags', () => {
    expect(stripHtml('<div><span>Nested</span></div>')).toBe('Nested')
  })

  it('strips self-closing tags', () => {
    expect(stripHtml('Line one<br/>Line two')).toBe('Line oneLine two')
  })

  it('handles empty input', () => {
    expect(stripHtml('')).toBe('')
  })

  it('preserves non-HTML text', () => {
    expect(stripHtml('Just plain text')).toBe('Just plain text')
  })

  it('strips tags with attributes', () => {
    expect(stripHtml('<a href="https://example.com">Link</a>')).toBe('Link')
  })

  it('trims surrounding whitespace', () => {
    expect(stripHtml('  <b>trimmed</b>  ')).toBe('trimmed')
  })
})

describe('formatSyncDate', () => {
  it('returns Never for null', () => {
    expect(formatSyncDate(null)).toBe('Never')
  })

  it('returns Never for undefined', () => {
    expect(formatSyncDate(undefined)).toBe('Never')
  })

  it('returns Never for empty string', () => {
    expect(formatSyncDate('')).toBe('Never')
  })

  it('returns a locale string for a valid ISO date', () => {
    const iso = '2025-06-15T12:00:00.000Z'
    const result = formatSyncDate(iso)
    expect(result).toBe(new Date(iso).toLocaleString())
  })
})

describe('getConnectionsDueForSync', () => {
  const mockTable = {} as Parameters<typeof getConnectionsDueForSync>[0]
  const mockColumns = {
    id: {} as any,
    project_id: {} as any,
    sync_enabled: {} as any,
    sync_frequency: {} as any,
    next_sync_at: {} as any,
    last_sync_status: {} as any,
  } as Parameters<typeof getConnectionsDueForSync>[1]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped rows with id and projectId', async () => {
    const mockRows = [
      { id: 'conn-1', project_id: 'proj-1' },
      { id: 'conn-2', project_id: 'proj-2' },
    ]
    vi.mocked(db.select().from({} as any).where).mockResolvedValueOnce(mockRows)

    const result = await getConnectionsDueForSync(mockTable, mockColumns)

    expect(result).toEqual([
      { id: 'conn-1', projectId: 'proj-1' },
      { id: 'conn-2', projectId: 'proj-2' },
    ])
  })

  it('returns empty array when no connections are due', async () => {
    vi.mocked(db.select().from({} as any).where).mockResolvedValueOnce([])

    const result = await getConnectionsDueForSync(mockTable, mockColumns)
    expect(result).toEqual([])
  })

  it('calls db.select and chains from and where', async () => {
    vi.mocked(db.select().from({} as any).where).mockResolvedValueOnce([])

    await getConnectionsDueForSync(mockTable, mockColumns)

    expect(db.select).toHaveBeenCalled()
  })
})
