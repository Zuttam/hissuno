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

describe('BatchValidationError', () => {
  it('has status 400', () => {
    const error = new BatchValidationError('test')
    expect(error.status).toBe(400)
  })

  it('has name "BatchValidationError"', () => {
    const error = new BatchValidationError('test')
    expect(error.name).toBe('BatchValidationError')
  })

  it('preserves the message', () => {
    const error = new BatchValidationError('Invalid IDs')
    expect(error.message).toBe('Invalid IDs')
  })

  it('is an instance of Error', () => {
    const error = new BatchValidationError('test')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('validateBatchIds', () => {
  let validateBatchIds: typeof import('@/lib/batch/validation').validateBatchIds
  let mockDb: { select: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.resetAllMocks()

    // Re-import to get fresh module with mocks
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

  it('throws for non-array input', async () => {
    await expect(
      validateBatchIds({ projectId: 'proj-1', table: 'sessions', ids: 'not-array', maxSize: 100 })
    ).rejects.toThrow(BatchValidationError)
  })

  it('throws for empty array', async () => {
    await expect(
      validateBatchIds({ projectId: 'proj-1', table: 'sessions', ids: [], maxSize: 100 })
    ).rejects.toThrow('IDs array is required and must not be empty.')
  })

  it('throws when array exceeds maxSize', async () => {
    const ids = ['id1', 'id2', 'id3']
    await expect(
      validateBatchIds({ projectId: 'proj-1', table: 'sessions', ids, maxSize: 2 })
    ).rejects.toThrow('Maximum 2 items per batch operation.')
  })

  it('throws for non-string ID', async () => {
    await expect(
      validateBatchIds({ projectId: 'proj-1', table: 'sessions', ids: [123], maxSize: 100 })
    ).rejects.toThrow('Invalid IDs provided.')
  })

  it('throws for empty string ID', async () => {
    await expect(
      validateBatchIds({ projectId: 'proj-1', table: 'sessions', ids: [''], maxSize: 100 })
    ).rejects.toThrow('Invalid IDs provided.')
  })

  it('throws when DB returns fewer rows than requested (IDs not found)', async () => {
    setupDbReturn([{ id: 'id1', project_id: 'proj-1' }])

    await expect(
      validateBatchIds({ projectId: 'proj-1', table: 'sessions', ids: ['id1', 'id2'], maxSize: 100 })
    ).rejects.toThrow(BatchValidationError)
  })

  it('throws when a row has wrong project_id (IDOR prevention)', async () => {
    setupDbReturn([
      { id: 'id1', project_id: 'proj-1' },
      { id: 'id2', project_id: 'proj-other' },
    ])

    await expect(
      validateBatchIds({ projectId: 'proj-1', table: 'sessions', ids: ['id1', 'id2'], maxSize: 100 })
    ).rejects.toThrow(BatchValidationError)
  })

  it('works with contacts table', async () => {
    setupDbReturn([
      { id: 'id1', project_id: 'proj-1' },
    ])

    const result = await validateBatchIds({
      projectId: 'proj-1',
      table: 'contacts',
      ids: ['id1'],
      maxSize: 100,
    })
    expect(result).toEqual(['id1'])
  })

  it('returns string array for valid IDs with matching DB results', async () => {
    setupDbReturn([
      { id: 'id1', project_id: 'proj-1' },
      { id: 'id2', project_id: 'proj-1' },
    ])

    const result = await validateBatchIds({
      projectId: 'proj-1',
      table: 'sessions',
      ids: ['id1', 'id2'],
      maxSize: 100,
    })
    expect(result).toEqual(['id1', 'id2'])
  })
})
