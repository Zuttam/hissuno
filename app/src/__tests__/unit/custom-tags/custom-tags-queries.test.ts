/**
 * Unit Tests for Custom Tags Database Queries
 *
 * Tests the custom tags operations in lib/db/queries/custom-tags.ts
 * using mocked Drizzle db and auth modules.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnauthorizedError } from '@/lib/auth/server'

// Mock auth modules
const mockResolveRequestContext = vi.fn()
const mockHasProjectAccess = vi.fn()
const mockIsDatabaseConfigured = vi.fn()

vi.mock('@/lib/db/config', () => ({
  isDatabaseConfigured: () => mockIsDatabaseConfigured(),
}))

vi.mock('@/lib/db/server', () => ({
  resolveRequestContext: () => mockResolveRequestContext(),
}))

vi.mock('@/lib/auth/project-members', () => ({
  hasProjectAccess: (...args: unknown[]) => mockHasProjectAccess(...args),
}))

// Mock Drizzle db with chainable query builder
let mockSelectResult: unknown[] = []
let mockInsertResult: unknown[] = []
let mockUpdateResult: unknown[] = []
let mockDeleteError: Error | null = null
let mockInsertError: Error | null = null
let mockUpdateError: Error | null = null

// Helper: creates a thenable object that also has .orderBy() for optional chaining.
// This lets `await db.select().from().where()` resolve to the array directly,
// while `await db.select().from().where().orderBy()` also works.
function createSelectWhereResult() {
  const promise = Promise.resolve(mockSelectResult)
  return {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      promise.then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => promise.catch(reject),
    orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockSelectResult)),
  }
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => createSelectWhereResult()),
        orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockSelectResult)),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockImplementation(() => {
          if (mockInsertError) throw mockInsertError
          return Promise.resolve(mockInsertResult)
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockImplementation(() => {
            if (mockUpdateError) throw mockUpdateError
            return Promise.resolve(mockUpdateResult)
          }),
        })),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        if (mockDeleteError) return Promise.reject(mockDeleteError)
        return Promise.resolve(undefined)
      }),
    })),
  },
}))

// Import after mocks are set up
import {
  getProjectCustomTags,
  syncCustomTags,
  type SyncTagInput,
} from '@/lib/db/queries/custom-tags'

// Helper to create mock custom tag record
function createMockTagRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tag-123',
    project_id: 'project-123',
    name: 'Test Tag',
    slug: 'test_tag',
    description: 'Test description',
    color: 'info',
    position: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// Helper to create mock sync tag input
function createMockSyncTagInput(overrides: Partial<SyncTagInput> = {}): SyncTagInput {
  return {
    id: 'tag-123',
    name: 'Test Tag',
    slug: 'test_tag',
    description: 'Test description',
    color: 'info',
    position: 0,
    ...overrides,
  }
}

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  mockSelectResult = []
  mockInsertResult = []
  mockUpdateResult = []
  mockDeleteError = null
  mockInsertError = null
  mockUpdateError = null
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Setup helper for auth context
function setupAuthContext() {
  mockResolveRequestContext.mockResolvedValue({ userId: 'user-123', db: {}, apiKeyProjectId: null })
  mockHasProjectAccess.mockResolvedValue(true)
}

// getProjectCustomTags (admin — no auth required)

describe('getProjectCustomTags', () => {
  it('returns tags from database', async () => {
    const mockTags = [createMockTagRecord(), createMockTagRecord({ id: 'tag-456', position: 1 })]
    mockSelectResult = mockTags

    const result = await getProjectCustomTags('project-123')
    expect(result).toEqual(mockTags)
  })

  it('returns empty array on query error', async () => {
    // When db throws, getProjectCustomTags catches and returns []
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockImplementationOnce(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          then: (resolve: unknown, reject: (e: unknown) => unknown) =>
            Promise.reject(new Error('Query failed')).then(resolve as (v: unknown) => unknown, reject),
          catch: (reject: (e: unknown) => unknown) =>
            Promise.reject(new Error('Query failed')).catch(reject),
          orderBy: vi.fn().mockRejectedValue(new Error('Query failed')),
        })),
      })),
    }) as unknown as ReturnType<typeof db.select>)

    const result = await getProjectCustomTags('project-123')
    expect(result).toEqual([])
  })
})

// syncCustomTags

describe('syncCustomTags', () => {
  describe('authorization', () => {
    it('throws UnauthorizedError when user cannot be resolved', async () => {
      mockResolveRequestContext.mockRejectedValue(new UnauthorizedError())

      await expect(syncCustomTags('project-123', [])).rejects.toThrow(UnauthorizedError)
    })

    it('throws UnauthorizedError when project access denied', async () => {
      mockResolveRequestContext.mockResolvedValue({ userId: 'user-123', db: {}, apiKeyProjectId: null })
      mockHasProjectAccess.mockResolvedValue(false)

      await expect(syncCustomTags('project-123', [])).rejects.toThrow(UnauthorizedError)
    })
  })

  describe('creating new tags', () => {
    it('creates tags with temp_ prefix IDs', async () => {
      setupAuthContext()
      mockSelectResult = [] // no existing tags

      const newTagRecord = createMockTagRecord({ id: 'new-uuid-123' })
      mockInsertResult = [newTagRecord]

      const result = await syncCustomTags('project-123', [
        createMockSyncTagInput({ id: 'temp_123456789', name: 'New Tag', slug: 'new_tag' }),
      ])

      expect(result.created).toHaveLength(1)
      expect(result.created[0]).toEqual(newTagRecord)
      expect(result.updated).toHaveLength(0)
      expect(result.deleted).toHaveLength(0)
    })

    it('throws error on duplicate slug when creating', async () => {
      setupAuthContext()
      mockSelectResult = [] // no existing tags

      const dupError = new Error('Duplicate') as Error & { code: string }
      dupError.code = '23505'
      mockInsertError = dupError

      await expect(
        syncCustomTags('project-123', [
          createMockSyncTagInput({ id: 'temp_123', slug: 'duplicate_slug' }),
        ])
      ).rejects.toThrow('A tag with slug "duplicate_slug" already exists in this project.')
    })
  })

  describe('updating existing tags', () => {
    it('updates tags that have changes', async () => {
      setupAuthContext()

      const existingTag = createMockTagRecord({ id: 'existing-tag-123', name: 'Old Name' })
      mockSelectResult = [existingTag]

      const updatedTag = createMockTagRecord({ id: 'existing-tag-123', name: 'New Name' })
      mockUpdateResult = [updatedTag]

      const result = await syncCustomTags('project-123', [
        createMockSyncTagInput({ id: 'existing-tag-123', name: 'New Name' }),
      ])

      expect(result.updated).toHaveLength(1)
      expect(result.updated[0].name).toBe('New Name')
      expect(result.created).toHaveLength(0)
      expect(result.deleted).toHaveLength(0)
    })

    it('skips tags with no changes', async () => {
      setupAuthContext()

      const existingTag = createMockTagRecord({
        id: 'existing-tag-123',
        name: 'Test Tag',
        slug: 'test_tag',
        description: 'Test description',
        color: 'info',
        position: 0,
      })
      mockSelectResult = [existingTag]

      const result = await syncCustomTags('project-123', [
        createMockSyncTagInput({
          id: 'existing-tag-123',
          name: 'Test Tag',
          slug: 'test_tag',
          description: 'Test description',
          color: 'info',
          position: 0,
        }),
      ])

      expect(result.updated).toHaveLength(0)
      expect(result.created).toHaveLength(0)
      expect(result.deleted).toHaveLength(0)
    })

    it('throws error on duplicate slug when updating', async () => {
      setupAuthContext()

      const existingTag = createMockTagRecord({ id: 'tag-1' })
      mockSelectResult = [existingTag]

      const dupError = new Error('Duplicate') as Error & { code: string }
      dupError.code = '23505'
      mockUpdateError = dupError

      await expect(
        syncCustomTags('project-123', [
          createMockSyncTagInput({ id: 'tag-1', slug: 'conflicting_slug', name: 'Changed' }),
        ])
      ).rejects.toThrow('A tag with slug "conflicting_slug" already exists in this project.')
    })
  })

  describe('deleting tags', () => {
    it('deletes tags that are no longer in the list', async () => {
      setupAuthContext()

      const existingTag = createMockTagRecord({ id: 'tag-to-delete' })
      mockSelectResult = [existingTag]

      const result = await syncCustomTags('project-123', [])

      expect(result.deleted).toHaveLength(1)
      expect(result.deleted[0]).toBe('tag-to-delete')
      expect(result.created).toHaveLength(0)
      expect(result.updated).toHaveLength(0)
    })

    it('throws error when delete fails', async () => {
      setupAuthContext()

      const existingTag = createMockTagRecord({ id: 'tag-to-delete' })
      mockSelectResult = [existingTag]
      mockDeleteError = new Error('Delete failed')

      await expect(syncCustomTags('project-123', [])).rejects.toThrow()
    })
  })

  describe('tag limit enforcement', () => {
    it('throws error when exceeding maximum tags', async () => {
      setupAuthContext()

      // Create 10 existing tags (max)
      const existingTags = Array.from({ length: 10 }, (_, i) =>
        createMockTagRecord({ id: `tag-${i}`, position: i })
      )
      mockSelectResult = existingTags

      // Try to add one more
      const incomingTags: SyncTagInput[] = [
        ...existingTags.map((t) => createMockSyncTagInput({ id: t.id as string, position: t.position as number })),
        createMockSyncTagInput({ id: 'temp_new', name: 'New Tag', slug: 'new_tag', position: 10 }),
      ]

      await expect(syncCustomTags('project-123', incomingTags)).rejects.toThrow(
        'Maximum of 10 custom tags per project.'
      )
    })

    it('allows adding when deleting keeps total under limit', async () => {
      setupAuthContext()

      // 10 existing tags
      const existingTags = Array.from({ length: 10 }, (_, i) =>
        createMockTagRecord({ id: `tag-${i}`, position: i })
      )
      mockSelectResult = existingTags

      const newTagRecord = createMockTagRecord({ id: 'new-uuid' })
      mockInsertResult = [newTagRecord]

      // Delete one, add one (keeps it at 10)
      const incomingTags: SyncTagInput[] = [
        ...existingTags.slice(1).map((t) => createMockSyncTagInput({ id: t.id as string, position: t.position as number })),
        createMockSyncTagInput({ id: 'temp_new', name: 'New Tag', slug: 'new_tag', position: 9 }),
      ]

      const result = await syncCustomTags('project-123', incomingTags)

      expect(result.deleted).toHaveLength(1)
      expect(result.created).toHaveLength(1)
    })
  })

  describe('combined operations', () => {
    it('handles create, update, and delete in single sync', async () => {
      setupAuthContext()

      const existingTags = [
        createMockTagRecord({ id: 'keep-unchanged', name: 'Keep', position: 0 }),
        createMockTagRecord({ id: 'to-update', name: 'Old Name', position: 1 }),
        createMockTagRecord({ id: 'to-delete', name: 'Delete Me', position: 2 }),
      ]
      mockSelectResult = existingTags

      const updatedTag = createMockTagRecord({ id: 'to-update', name: 'New Name' })
      mockUpdateResult = [updatedTag]
      const createdTag = createMockTagRecord({ id: 'new-uuid', name: 'New Tag' })
      mockInsertResult = [createdTag]

      const incomingTags: SyncTagInput[] = [
        // Keep unchanged
        createMockSyncTagInput({ id: 'keep-unchanged', name: 'Keep', position: 0 }),
        // Update
        createMockSyncTagInput({ id: 'to-update', name: 'New Name', position: 1 }),
        // Create new
        createMockSyncTagInput({ id: 'temp_123', name: 'New Tag', slug: 'new_tag', position: 2 }),
        // 'to-delete' is omitted = delete
      ]

      const result = await syncCustomTags('project-123', incomingTags)

      expect(result.deleted).toContain('to-delete')
      expect(result.created).toHaveLength(1)
      expect(result.updated).toHaveLength(1)
    })
  })

  describe('error handling', () => {
    it('handles non-existent tag ID gracefully (logs warning)', async () => {
      setupAuthContext()

      // No existing tags in DB
      mockSelectResult = []

      // Try to update a tag that doesn't exist (non-temp ID)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await syncCustomTags('project-123', [
        createMockSyncTagInput({ id: 'nonexistent-uuid', name: 'Ghost Tag' }),
      ])

      expect(warnSpy).toHaveBeenCalledWith(
        '[db.custom-tags] tag ID not found in DB',
        'nonexistent-uuid'
      )
      expect(result.updated).toHaveLength(0)
      expect(result.created).toHaveLength(0)

      warnSpy.mockRestore()
    })
  })
})
