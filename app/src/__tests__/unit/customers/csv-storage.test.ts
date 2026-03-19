/**
 * Tests for CSV storage filename validation and path sanitization.
 *
 * Focuses on path traversal prevention, filename injection, and
 * boundary conditions. Pure function tests - no storage mocking needed.
 */

import { describe, it, expect } from 'vitest'
import {
  validateCSVFileName,
  getCSVImportPath,
  MAX_CSV_FILE_SIZE,
} from '@/lib/customers/csv-storage'

// =============================================================================
// validateCSVFileName
// =============================================================================

describe('validateCSVFileName', () => {
  describe('valid filenames', () => {
    it('accepts simple filename', () => {
      expect(validateCSVFileName('data.csv')).toBeNull()
    })

    it('accepts filename with spaces', () => {
      expect(validateCSVFileName('my data file.csv')).toBeNull()
    })

    it('accepts filename with hyphens and underscores', () => {
      expect(validateCSVFileName('my-data_2025.csv')).toBeNull()
    })

    it('accepts uppercase .CSV extension', () => {
      expect(validateCSVFileName('DATA.CSV')).toBeNull()
    })

    it('accepts mixed case .Csv extension', () => {
      expect(validateCSVFileName('data.Csv')).toBeNull()
    })
  })

  describe('empty/missing input', () => {
    it('rejects empty string', () => {
      expect(validateCSVFileName('')).toBe('Filename is required.')
    })

    it('rejects null', () => {
      expect(
        validateCSVFileName(null as unknown as string)
      ).toBe('Filename is required.')
    })

    it('rejects undefined', () => {
      expect(
        validateCSVFileName(undefined as unknown as string)
      ).toBe('Filename is required.')
    })
  })

  describe('length limits', () => {
    it('accepts filename at exactly 255 characters', () => {
      const name = 'a'.repeat(251) + '.csv'
      expect(name.length).toBe(255)
      expect(validateCSVFileName(name)).toBeNull()
    })

    it('rejects filename over 255 characters', () => {
      const name = 'a'.repeat(252) + '.csv'
      expect(name.length).toBe(256)
      expect(validateCSVFileName(name)).toBe(
        'Filename is too long (max 255 characters).'
      )
    })
  })

  describe('extension validation', () => {
    it('rejects .txt extension', () => {
      expect(validateCSVFileName('data.txt')).toBe(
        'File must have a .csv extension.'
      )
    })

    it('rejects .xlsx extension', () => {
      expect(validateCSVFileName('data.xlsx')).toBe(
        'File must have a .csv extension.'
      )
    })

    it('rejects no extension', () => {
      expect(validateCSVFileName('data')).toBe(
        'File must have a .csv extension.'
      )
    })

    it('rejects .csv in the middle of filename', () => {
      expect(validateCSVFileName('data.csv.txt')).toBe(
        'File must have a .csv extension.'
      )
    })

    it('rejects .csvx extension', () => {
      expect(validateCSVFileName('data.csvx')).toBe(
        'File must have a .csv extension.'
      )
    })
  })

  describe('path traversal prevention', () => {
    it('rejects double dots (..)', () => {
      expect(validateCSVFileName('../etc/passwd.csv')).toBe('Invalid filename.')
    })

    it('rejects forward slash', () => {
      expect(validateCSVFileName('path/to/file.csv')).toBe('Invalid filename.')
    })

    it('rejects backslash', () => {
      expect(validateCSVFileName('path\\to\\file.csv')).toBe(
        'Invalid filename.'
      )
    })

    it('rejects .. without slashes', () => {
      expect(validateCSVFileName('..file.csv')).toBe('Invalid filename.')
    })

    it('rejects encoded path traversal (literal dots)', () => {
      expect(validateCSVFileName('a..b.csv')).toBe('Invalid filename.')
    })

    it('rejects just double dot with extension', () => {
      expect(validateCSVFileName('...csv')).toBe('Invalid filename.')
    })
  })
})

// =============================================================================
// getCSVImportPath
// =============================================================================

describe('getCSVImportPath', () => {
  it('returns path in correct format', () => {
    const path = getCSVImportPath('proj-123', 'data.csv')
    expect(path).toMatch(/^proj-123\/csv-imports\/\d+-data\.csv$/)
  })

  it('sanitizes special characters in filename', () => {
    const path = getCSVImportPath('proj-123', 'my file (1).csv')
    // Non-alphanumeric/non-dot/non-dash chars are replaced with _
    expect(path).not.toContain(' ')
    expect(path).not.toContain('(')
    expect(path).not.toContain(')')
  })

  it('sanitizes path traversal attempts in filename', () => {
    const path = getCSVImportPath('proj-123', '../../../etc/passwd')
    expect(path).not.toContain('../')
    // Slashes get replaced with _
    expect(path).toMatch(/^proj-123\/csv-imports\/\d+-/)
  })

  it('sanitizes unicode characters in filename', () => {
    const path = getCSVImportPath('proj-123', 'dat\u00e4.csv')
    expect(path).not.toContain('\u00e4')
    expect(path).toMatch(/^proj-123\/csv-imports\/\d+-/)
  })

  it('handles empty filename', () => {
    const path = getCSVImportPath('proj-123', '')
    expect(path).toMatch(/^proj-123\/csv-imports\/\d+-$/)
  })

  it('preserves projectId in path', () => {
    const path = getCSVImportPath('my-project-id', 'test.csv')
    expect(path.startsWith('my-project-id/')).toBe(true)
  })

  it('includes timestamp for uniqueness', () => {
    const path1 = getCSVImportPath('proj', 'a.csv')
    const path2 = getCSVImportPath('proj', 'a.csv')
    // Timestamps may be the same if called fast enough, but format is correct
    expect(path1).toMatch(/\/\d+-/)
    expect(path2).toMatch(/\/\d+-/)
  })
})

// =============================================================================
// MAX_CSV_FILE_SIZE constant
// =============================================================================

describe('MAX_CSV_FILE_SIZE', () => {
  it('is 5MB', () => {
    expect(MAX_CSV_FILE_SIZE).toBe(5 * 1024 * 1024)
  })
})
