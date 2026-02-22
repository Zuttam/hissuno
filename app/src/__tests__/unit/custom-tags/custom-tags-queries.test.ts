/**
 * Unit Tests for Custom Tags Database Queries
 *
 * Tests the custom tags operations in lib/supabase/custom-tags.ts
 * using mocked Supabase clients.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnauthorizedError } from '@/lib/auth/server'

// Mock Supabase server module before imports
const mockCreateAdminClient = vi.fn()
const mockCreateRequestScopedClient = vi.fn()
const mockIsSupabaseConfigured = vi.fn()
const mockIsServiceRoleConfigured = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockCreateAdminClient(),
  createRequestScopedClient: () => mockCreateRequestScopedClient(),
  isSupabaseConfigured: () => mockIsSupabaseConfigured(),
  isServiceRoleConfigured: () => mockIsServiceRoleConfigured(),
}))

// Import after mocks are set up
import {
  getProjectCustomTags,
  syncCustomTags,
  type SyncTagInput,
} from '@/lib/supabase/custom-tags'

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
})

afterEach(() => {
  vi.restoreAllMocks()
})

// getProjectCustomTags (admin client - no auth)

describe('getProjectCustomTags', () => {
  it('returns tags when service role is configured', async () => {
    mockIsServiceRoleConfigured.mockReturnValue(true)
    const mockTags = [createMockTagRecord(), createMockTagRecord({ id: 'tag-456', position: 1 })]

    mockCreateAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({ data: mockTags, error: null }),
          }),
        }),
      }),
    })

    const result = await getProjectCustomTags('project-123')
    expect(result).toEqual(mockTags)
  })

  it('returns empty array when service role is not configured', async () => {
    mockIsServiceRoleConfigured.mockReturnValue(false)

    const result = await getProjectCustomTags('project-123')
    expect(result).toEqual([])
  })

  it('returns empty array on query error', async () => {
    mockIsServiceRoleConfigured.mockReturnValue(true)

    mockCreateAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({ data: null, error: { message: 'Query failed' } }),
          }),
        }),
      }),
    })

    const result = await getProjectCustomTags('project-123')
    expect(result).toEqual([])
  })
})

// syncCustomTags

describe('syncCustomTags', () => {
  // Helper to set up mockCreateRequestScopedClient to resolve with a mock supabase client
  function setupMockRequestScopedClient(supabaseClient: Record<string, unknown>) {
    mockCreateRequestScopedClient.mockResolvedValue({
      supabase: supabaseClient,
      userId: 'user-123',
      apiKeyProjectId: null,
    })
  }

  // Helper to create a mock Supabase client with chainable methods
  function createMockSupabaseClient(options: {
    project?: { id: string } | null
    existingTags?: Array<ReturnType<typeof createMockTagRecord>>
    fetchError?: { message: string; code?: string } | null
    insertResult?: { data: unknown; error: { message: string; code?: string } | null }
    updateResult?: { data: unknown; error: { message: string; code?: string } | null }
    deleteError?: { message: string } | null
  }) {
    const {
      project = { id: 'project-123' },
      existingTags = [],
      fetchError = null,
      insertResult = { data: createMockTagRecord(), error: null },
      updateResult = { data: createMockTagRecord(), error: null },
      deleteError = null,
    } = options

    return {
      from: vi.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: project, error: null }),
              }),
            }),
          }
        }
        if (table === 'custom_tags') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: existingTags, error: fetchError }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve(insertResult),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve(updateResult),
                }),
              }),
            }),
            delete: () => ({
              eq: () => Promise.resolve({ error: deleteError }),
            }),
          }
        }
        return {}
      }),
    }
  }

  describe('authorization', () => {
    it('throws UnauthorizedError when Supabase is not configured', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false)

      await expect(syncCustomTags('project-123', [])).rejects.toThrow('Supabase must be configured.')
    })

    it('throws UnauthorizedError when user cannot be resolved', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)
      mockCreateRequestScopedClient.mockRejectedValue(new UnauthorizedError())

      await expect(syncCustomTags('project-123', [])).rejects.toThrow(UnauthorizedError)
    })

    it('throws UnauthorizedError when project not found', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)
      setupMockRequestScopedClient(createMockSupabaseClient({ project: null }))

      await expect(syncCustomTags('project-123', [])).rejects.toThrow(
        'Project not found or access denied.'
      )
    })
  })

  describe('creating new tags', () => {
    it('creates tags with temp_ prefix IDs', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      const newTagRecord = createMockTagRecord({ id: 'new-uuid-123' })
      const mockClient = createMockSupabaseClient({
        existingTags: [],
        insertResult: { data: newTagRecord, error: null },
      })
      setupMockRequestScopedClient(mockClient)

      const result = await syncCustomTags('project-123', [
        createMockSyncTagInput({ id: 'temp_123456789', name: 'New Tag', slug: 'new_tag' }),
      ])

      expect(result.created).toHaveLength(1)
      expect(result.created[0]).toEqual(newTagRecord)
      expect(result.updated).toHaveLength(0)
      expect(result.deleted).toHaveLength(0)
    })

    it('throws error on duplicate slug when creating', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      const mockClient = createMockSupabaseClient({
        existingTags: [],
        insertResult: { data: null, error: { message: 'Duplicate', code: '23505' } },
      })
      setupMockRequestScopedClient(mockClient)

      await expect(
        syncCustomTags('project-123', [
          createMockSyncTagInput({ id: 'temp_123', slug: 'duplicate_slug' }),
        ])
      ).rejects.toThrow('A tag with slug "duplicate_slug" already exists in this project.')
    })
  })

  describe('updating existing tags', () => {
    it('updates tags that have changes', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      const existingTag = createMockTagRecord({ id: 'existing-tag-123', name: 'Old Name' })
      const updatedTag = createMockTagRecord({ id: 'existing-tag-123', name: 'New Name' })

      const mockClient = createMockSupabaseClient({
        existingTags: [existingTag],
        updateResult: { data: updatedTag, error: null },
      })
      setupMockRequestScopedClient(mockClient)

      const result = await syncCustomTags('project-123', [
        createMockSyncTagInput({ id: 'existing-tag-123', name: 'New Name' }),
      ])

      expect(result.updated).toHaveLength(1)
      expect(result.updated[0].name).toBe('New Name')
      expect(result.created).toHaveLength(0)
      expect(result.deleted).toHaveLength(0)
    })

    it('skips tags with no changes', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      const existingTag = createMockTagRecord({
        id: 'existing-tag-123',
        name: 'Test Tag',
        slug: 'test_tag',
        description: 'Test description',
        color: 'info',
        position: 0,
      })

      const mockClient = createMockSupabaseClient({
        existingTags: [existingTag],
      })
      setupMockRequestScopedClient(mockClient)

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
      mockIsSupabaseConfigured.mockReturnValue(true)

      const existingTag = createMockTagRecord({ id: 'tag-1' })

      const mockClient = createMockSupabaseClient({
        existingTags: [existingTag],
        updateResult: { data: null, error: { message: 'Duplicate', code: '23505' } },
      })
      setupMockRequestScopedClient(mockClient)

      await expect(
        syncCustomTags('project-123', [
          createMockSyncTagInput({ id: 'tag-1', slug: 'conflicting_slug', name: 'Changed' }),
        ])
      ).rejects.toThrow('A tag with slug "conflicting_slug" already exists in this project.')
    })
  })

  describe('deleting tags', () => {
    it('deletes tags that are no longer in the list', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      const existingTag = createMockTagRecord({ id: 'tag-to-delete' })

      const mockClient = createMockSupabaseClient({
        existingTags: [existingTag],
      })
      setupMockRequestScopedClient(mockClient)

      const result = await syncCustomTags('project-123', [])

      expect(result.deleted).toHaveLength(1)
      expect(result.deleted[0]).toBe('tag-to-delete')
      expect(result.created).toHaveLength(0)
      expect(result.updated).toHaveLength(0)
    })

    it('throws error when delete fails', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      const existingTag = createMockTagRecord({ id: 'tag-to-delete' })

      const mockClient = createMockSupabaseClient({
        existingTags: [existingTag],
        deleteError: { message: 'Delete failed' },
      })
      setupMockRequestScopedClient(mockClient)

      await expect(syncCustomTags('project-123', [])).rejects.toThrow('Unable to delete tag.')
    })
  })

  describe('tag limit enforcement', () => {
    it('throws error when exceeding maximum tags', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      // Create 10 existing tags (max)
      const existingTags = Array.from({ length: 10 }, (_, i) =>
        createMockTagRecord({ id: `tag-${i}`, position: i })
      )

      const mockClient = createMockSupabaseClient({
        existingTags,
      })
      setupMockRequestScopedClient(mockClient)

      // Try to add one more
      const incomingTags: SyncTagInput[] = [
        ...existingTags.map((t) => createMockSyncTagInput({ id: t.id, position: t.position })),
        createMockSyncTagInput({ id: 'temp_new', name: 'New Tag', slug: 'new_tag', position: 10 }),
      ]

      await expect(syncCustomTags('project-123', incomingTags)).rejects.toThrow(
        'Maximum of 10 custom tags per project.'
      )
    })

    it('allows adding when deleting keeps total under limit', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      // 10 existing tags
      const existingTags = Array.from({ length: 10 }, (_, i) =>
        createMockTagRecord({ id: `tag-${i}`, position: i })
      )

      const newTagRecord = createMockTagRecord({ id: 'new-uuid' })
      const mockClient = createMockSupabaseClient({
        existingTags,
        insertResult: { data: newTagRecord, error: null },
      })
      setupMockRequestScopedClient(mockClient)

      // Delete one, add one (keeps it at 10)
      const incomingTags: SyncTagInput[] = [
        ...existingTags.slice(1).map((t) => createMockSyncTagInput({ id: t.id, position: t.position })),
        createMockSyncTagInput({ id: 'temp_new', name: 'New Tag', slug: 'new_tag', position: 9 }),
      ]

      const result = await syncCustomTags('project-123', incomingTags)

      expect(result.deleted).toHaveLength(1)
      expect(result.created).toHaveLength(1)
    })
  })

  describe('combined operations', () => {
    it('handles create, update, and delete in single sync', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      const existingTags = [
        createMockTagRecord({ id: 'keep-unchanged', name: 'Keep', position: 0 }),
        createMockTagRecord({ id: 'to-update', name: 'Old Name', position: 1 }),
        createMockTagRecord({ id: 'to-delete', name: 'Delete Me', position: 2 }),
      ]

      const updatedTag = createMockTagRecord({ id: 'to-update', name: 'New Name' })
      const createdTag = createMockTagRecord({ id: 'new-uuid', name: 'New Tag' })

      const mockClient = createMockSupabaseClient({
        existingTags,
        updateResult: { data: updatedTag, error: null },
        insertResult: { data: createdTag, error: null },
      })
      setupMockRequestScopedClient(mockClient)

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
    it('throws error when fetching existing tags fails', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      const mockClient = createMockSupabaseClient({
        fetchError: { message: 'Database error' },
      })
      setupMockRequestScopedClient(mockClient)

      await expect(syncCustomTags('project-123', [])).rejects.toThrow('Unable to load existing tags.')
    })

    it('handles non-existent tag ID gracefully (logs warning)', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true)

      // No existing tags in DB
      const mockClient = createMockSupabaseClient({
        existingTags: [],
      })
      setupMockRequestScopedClient(mockClient)

      // Try to update a tag that doesn't exist (non-temp ID)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await syncCustomTags('project-123', [
        createMockSyncTagInput({ id: 'nonexistent-uuid', name: 'Ghost Tag' }),
      ])

      expect(warnSpy).toHaveBeenCalledWith(
        '[supabase.custom-tags] tag ID not found in DB',
        'nonexistent-uuid'
      )
      expect(result.updated).toHaveLength(0)
      expect(result.created).toHaveLength(0)

      warnSpy.mockRestore()
    })
  })
})
