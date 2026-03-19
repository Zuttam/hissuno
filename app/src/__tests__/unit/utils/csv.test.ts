import { describe, it, expect } from 'vitest'
import { generateCSV, formatDateForCSV, formatArrayForCSV } from '@/lib/utils/csv'

describe('generateCSV', () => {
  const columns = [
    { key: 'name' as const, header: 'Name' },
    { key: 'email' as const, header: 'Email' },
  ]

  it('returns header row only for empty data', () => {
    const result = generateCSV([], columns)
    expect(result).toBe('Name,Email')
  })

  it('generates correct CSV rows', () => {
    const data = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ]
    const result = generateCSV(data, columns)
    const lines = result.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('Name,Email')
    expect(lines[1]).toBe('Alice,alice@example.com')
    expect(lines[2]).toBe('Bob,bob@example.com')
  })

  it('escapes values with commas', () => {
    const data = [{ name: 'Doe, John', email: 'john@example.com' }]
    const result = generateCSV(data, columns)
    expect(result).toContain('"Doe, John"')
  })

  it('escapes values with quotes', () => {
    const data = [{ name: 'He said "hello"', email: 'test@example.com' }]
    const result = generateCSV(data, columns)
    expect(result).toContain('"He said ""hello"""')
  })

  it('escapes values with newlines', () => {
    const data = [{ name: 'line1\nline2', email: 'test@example.com' }]
    const result = generateCSV(data, columns)
    expect(result).toContain('"line1\nline2"')
  })

  it('handles null/undefined values as empty strings', () => {
    const data = [{ name: null, email: undefined }]
    const result = generateCSV(data as unknown as { name: string; email: string }[], columns)
    const lines = result.split('\n')
    expect(lines[1]).toBe(',')
  })

  it('applies transform function', () => {
    const cols = [
      {
        key: 'value' as const,
        header: 'Value',
        transform: (v: unknown) => `$${v}`,
      },
    ]
    const data = [{ value: 100 }]
    const result = generateCSV(data, cols)
    expect(result).toContain('$100')
  })

  it('handles dot-notation nested keys', () => {
    const cols = [
      { key: 'project.name', header: 'Project' },
    ]
    const data = [{ project: { name: 'My Project' } }]
    const result = generateCSV(data, cols)
    expect(result).toContain('My Project')
  })
})

describe('formatDateForCSV', () => {
  it('formats valid date string to ISO', () => {
    const result = formatDateForCSV('2025-06-15T12:00:00Z')
    expect(result).toBe('2025-06-15T12:00:00.000Z')
  })

  it('returns empty string for null', () => {
    expect(formatDateForCSV(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatDateForCSV(undefined)).toBe('')
  })

  it('returns empty string for invalid date', () => {
    expect(formatDateForCSV('not-a-date')).toBe('')
  })
})

describe('formatArrayForCSV', () => {
  it('joins array with "; "', () => {
    expect(formatArrayForCSV(['a', 'b', 'c'])).toBe('a; b; c')
  })

  it('returns empty string for null', () => {
    expect(formatArrayForCSV(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatArrayForCSV(undefined)).toBe('')
  })

  it('returns empty string for empty array', () => {
    expect(formatArrayForCSV([])).toBe('')
  })
})
