/**
 * Security-focused tests for batch validation.
 *
 * Extends the existing validation.test.ts with adversarial input patterns:
 * SQL injection strings, prototype pollution keys, duplicate IDs, whitespace,
 * and boundary conditions around maxSize.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BatchValidationError } from '@/lib/batch/validation'

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

// Mock schema to provide table references with id/project_id columns
vi.mock('@/lib/db/schema/app', () => ({
  sessions: { id: 'sessions.id', project_id: 'sessions.project_id' },
  issues: { id: 'issues.id', project_id: 'issues.project_id' },
  contacts: { id: 'contacts.id', project_id: 'contacts.project_id' },
}))

vi.mock('drizzle-orm', () => ({
  inArray: vi.fn(),
}))

describe('validateBatchIds - security edge cases', () => {
  let validateBatchIds: typeof import('@/lib/batch/validation').validateBatchIds
  let mockDb: { select: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.resetAllMocks()

    const dbModule = await import('@/lib/db')
    mockDb = dbModule.db as unknown as { select: ReturnType<typeof vi.fn> }

    const mod = await import('@/lib/batch/validation')
    validateBatchIds = mod.validateBatchIds
  })

  function setupDbReturn(rows: Array<{ id: string; project_id: string }>) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(rows),
    }
    mockDb.select.mockReturnValue(chain)
    return chain
  }

  // ===========================================================================
  // SQL Injection Attempts
  // ===========================================================================

  describe('SQL injection in IDs', () => {
    it('accepts SQL injection strings as valid string IDs (parameterized query prevents execution)', () => {
      // SQL injection strings are valid "strings" and pass the type check.
      // The DB layer (Drizzle) uses parameterized queries, so these are safe.
      // But they will not match any DB rows, so validation throws.
      setupDbReturn([]) // No rows found

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ["'; DROP TABLE sessions; --"],
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('rejects UNION SELECT injection string (not found in DB)', () => {
      setupDbReturn([])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ["' UNION SELECT * FROM users--"],
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })
  })

  // ===========================================================================
  // Prototype Pollution Keys
  // ===========================================================================

  describe('prototype pollution keys as IDs', () => {
    it('treats __proto__ as a regular string ID', () => {
      setupDbReturn([{ id: '__proto__', project_id: 'proj-1' }])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['__proto__'],
          maxSize: 100,
        })
      ).resolves.toEqual(['__proto__'])
    })

    it('treats constructor as a regular string ID', () => {
      setupDbReturn([{ id: 'constructor', project_id: 'proj-1' }])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['constructor'],
          maxSize: 100,
        })
      ).resolves.toEqual(['constructor'])
    })

    it('treats toString as a regular string ID', () => {
      setupDbReturn([{ id: 'toString', project_id: 'proj-1' }])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['toString'],
          maxSize: 100,
        })
      ).resolves.toEqual(['toString'])
    })
  })

  // ===========================================================================
  // Duplicate IDs
  // ===========================================================================

  describe('duplicate IDs', () => {
    it('throws when duplicate IDs cause DB count mismatch', () => {
      // Sending ['id1', 'id1'] means validatedIds.length = 2,
      // but DB will return only 1 unique row
      setupDbReturn([{ id: 'id1', project_id: 'proj-1' }])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['id1', 'id1'],
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('throws when many duplicates cause count mismatch', () => {
      setupDbReturn([{ id: 'only-one', project_id: 'proj-1' }])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['only-one', 'only-one', 'only-one'],
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })
  })

  // ===========================================================================
  // Whitespace and Special Character IDs
  // ===========================================================================

  describe('whitespace and special character IDs', () => {
    it('rejects whitespace-only string as ID (empty after conceptual trim)', () => {
      // The validation only checks typeof === 'string' and length > 0.
      // A whitespace string passes the check and gets sent to DB which won't match.
      setupDbReturn([])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['   '],
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('rejects tab-only string ID', () => {
      setupDbReturn([])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['\t'],
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('rejects newline-only string ID', () => {
      setupDbReturn([])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['\n'],
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('accepts string with null byte as a string (DB handles it)', () => {
      // The null byte is part of the string, passes type check
      setupDbReturn([])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['id\x00'],
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })
  })

  // ===========================================================================
  // Boundary Conditions
  // ===========================================================================

  describe('maxSize boundary', () => {
    it('accepts exactly maxSize IDs', () => {
      const ids = ['id1', 'id2', 'id3']
      setupDbReturn(
        ids.map((id) => ({ id, project_id: 'proj-1' }))
      )

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids,
          maxSize: 3,
        })
      ).resolves.toEqual(ids)
    })

    it('rejects maxSize + 1 IDs', () => {
      const ids = ['id1', 'id2', 'id3', 'id4']

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids,
          maxSize: 3,
        })
      ).rejects.toThrow('Maximum 3 items per batch operation.')
    })

    it('accepts single ID with maxSize 1', () => {
      setupDbReturn([{ id: 'id1', project_id: 'proj-1' }])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['id1'],
          maxSize: 1,
        })
      ).resolves.toEqual(['id1'])
    })
  })

  // ===========================================================================
  // Non-Array Input Types
  // ===========================================================================

  describe('non-array input types', () => {
    it('throws for object input', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: { 0: 'id1' },
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('throws for string input', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: 'id1',
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('throws for number input', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: 42,
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('throws for null input', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: null,
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })

    it('throws for undefined input', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: undefined,
          maxSize: 100,
        })
      ).rejects.toThrow(BatchValidationError)
    })
  })

  // ===========================================================================
  // Mixed Valid/Invalid ID Types
  // ===========================================================================

  describe('mixed valid/invalid ID types in array', () => {
    it('throws for array containing a number among strings', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['valid-id', 123, 'another-valid'],
          maxSize: 100,
        })
      ).rejects.toThrow('Invalid IDs provided.')
    })

    it('throws for array containing null among strings', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['valid-id', null],
          maxSize: 100,
        })
      ).rejects.toThrow('Invalid IDs provided.')
    })

    it('throws for array containing boolean among strings', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['valid-id', true],
          maxSize: 100,
        })
      ).rejects.toThrow('Invalid IDs provided.')
    })

    it('throws for array containing an empty string among valid strings', () => {
      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: ['valid-id', ''],
          maxSize: 100,
        })
      ).rejects.toThrow('Invalid IDs provided.')
    })
  })

  // ===========================================================================
  // Very Long String IDs
  // ===========================================================================

  describe('very long IDs', () => {
    it('accepts very long string IDs (DB handles length limits)', () => {
      const longId = 'x'.repeat(10000)
      setupDbReturn([{ id: longId, project_id: 'proj-1' }])

      return expect(
        validateBatchIds({
          projectId: 'proj-1',
          table: 'sessions',
          ids: [longId],
          maxSize: 100,
        })
      ).resolves.toEqual([longId])
    })
  })
})
