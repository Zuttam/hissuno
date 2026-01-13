/**
 * Unit Tests for Custom Tags Database Queries
 *
 * Tests the custom tags CRUD operations in lib/supabase/custom-tags.ts
 * using mocked Supabase clients.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnauthorizedError } from '@/lib/auth/server'

// Mock Supabase server module before imports
const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockIsSupabaseConfigured = vi.fn()
const mockIsServiceRoleConfigured = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  createAdminClient: () => mockCreateAdminClient(),
  isSupabaseConfigured: () => mockIsSupabaseConfigured(),
  isServiceRoleConfigured: () => mockIsServiceRoleConfigured(),
}))

// Import after mocks are set up
import {
  getProjectCustomTags,
  createCustomTag,
  updateCustomTag,
  deleteCustomTag,
  canAddCustomTag,
  updateTagPositions,
} from '@/lib/supabase/custom-tags'

// Helper to create mock user
function createMockUser(id: string = 'user-123') {
  return { id, email: 'test@example.com' }
}

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

describe('Custom Tags Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: Supabase is configured
    mockIsSupabaseConfigured.mockReturnValue(true)
    mockIsServiceRoleConfigured.mockReturnValue(true)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  /**
   * Helper to create a mock Supabase client that handles multiple sequential queries.
   * Pass an array of query results in the order they will be called.
   */
  function createMockSupabaseClient(
    queryResults: Array<{ data?: unknown; error?: unknown; count?: number | null }>,
    authUser: { id: string; email: string } | null = createMockUser()
  ) {
    let callIndex = 0

    const getNextResult = () => {
      const result = queryResults[callIndex] ?? { data: null, error: null }
      callIndex++
      return result
    }

    // Create a recursive builder that always chains and resolves at terminal methods
    const createBuilder = () => {
      const builder: Record<string, unknown> = {}

      const chainMethods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']
      chainMethods.forEach(method => {
        builder[method] = vi.fn().mockImplementation(() => builder)
      })

      // Terminal method - resolves with the next result
      builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResult()))

      // Make builder thenable for non-.single() queries
      builder.then = (resolve: (value: unknown) => void) => {
        const result = getNextResult()
        resolve(result)
        return Promise.resolve(result)
      }

      return builder
    }

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: authUser },
          error: authUser ? null : { message: 'Not authenticated' },
        }),
      },
      from: vi.fn().mockImplementation(() => createBuilder()),
    }

    return supabase
  }

  // ==========================================================================
  // getProjectCustomTags (admin client)
  // ==========================================================================
  describe('getProjectCustomTags', () => {
    it('should return tags without auth check', async () => {
      const mockTags = [
        createMockTagRecord({ position: 0 }),
        createMockTagRecord({ id: 'tag-456', slug: 'tag_two', position: 1 }),
      ]

      const mockAdminClient = createMockSupabaseClient([
        { data: mockTags, error: null },
      ])
      mockCreateAdminClient.mockReturnValue(mockAdminClient)

      const result = await getProjectCustomTags('project-123')

      expect(mockAdminClient.from).toHaveBeenCalledWith('custom_tags')
      expect(result).toEqual(mockTags)
    })

    it('should return empty array when service role not configured', async () => {
      mockIsServiceRoleConfigured.mockReturnValue(false)

      const result = await getProjectCustomTags('project-123')

      expect(result).toEqual([])
    })

    it('should return empty array on database error', async () => {
      const mockAdminClient = createMockSupabaseClient([
        { data: null, error: { message: 'Database error', code: '500' } },
      ])
      mockCreateAdminClient.mockReturnValue(mockAdminClient)

      const result = await getProjectCustomTags('project-123')

      expect(result).toEqual([])
    })

    it('should handle null data gracefully', async () => {
      const mockAdminClient = createMockSupabaseClient([
        { data: null, error: null },
      ])
      mockCreateAdminClient.mockReturnValue(mockAdminClient)

      const result = await getProjectCustomTags('project-123')

      expect(result).toEqual([])
    })
  })

  // ==========================================================================
  // createCustomTag
  // ==========================================================================
  describe('createCustomTag', () => {
    it('should create tag with correct position', async () => {
      const newTag = createMockTagRecord()

      // Query sequence:
      // 1. Project ownership check (.single())
      // 2. Tag count check (thenable with count)
      // 3. Position lookup (thenable with data array)
      // 4. Insert new tag (.single())
      const mockClient = createMockSupabaseClient([
        { data: { id: 'project-123' }, error: null }, // project ownership
        { count: 0, error: null }, // tag count
        { data: [], error: null }, // position lookup
        { data: newTag, error: null }, // insert result
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await createCustomTag('project-123', {
        name: 'Test Tag',
        slug: 'test_tag',
        description: 'Test description',
      })

      expect(mockClient.from).toHaveBeenCalledWith('projects')
      expect(mockClient.from).toHaveBeenCalledWith('custom_tags')
      expect(result).toEqual(newTag)
    })

    it('should throw error when max tags reached (10)', async () => {
      const mockClient = createMockSupabaseClient([
        { data: { id: 'project-123' }, error: null }, // project ownership
        { count: 10, error: null }, // at limit
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(createCustomTag('project-123', {
        name: 'Test Tag',
        slug: 'test_tag',
        description: 'Test description',
      })).rejects.toThrow('Maximum of 10 custom tags per project')
    })

    it('should throw error on duplicate slug', async () => {
      const mockClient = createMockSupabaseClient([
        { data: { id: 'project-123' }, error: null }, // project ownership
        { count: 0, error: null }, // tag count
        { data: [], error: null }, // position lookup
        { data: null, error: { code: '23505', message: 'Unique constraint violation' } }, // duplicate
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(createCustomTag('project-123', {
        name: 'Test Tag',
        slug: 'test_tag',
        description: 'Test description',
      })).rejects.toThrow('A tag with this slug already exists')
    })

    it('should throw UnauthorizedError for unauthorized user', async () => {
      const mockClient = createMockSupabaseClient([], null) // null user
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(createCustomTag('project-123', {
        name: 'Test Tag',
        slug: 'test_tag',
        description: 'Test description',
      })).rejects.toThrow(UnauthorizedError)
    })

    it('should throw UnauthorizedError for non-owned project', async () => {
      const mockClient = createMockSupabaseClient([
        { data: null, error: { code: 'PGRST116', message: 'Not found' } }, // project not found
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(createCustomTag('project-123', {
        name: 'Test Tag',
        slug: 'test_tag',
        description: 'Test description',
      })).rejects.toThrow(UnauthorizedError)
    })

    it('should auto-increment position for new tags', async () => {
      const existingTag = createMockTagRecord({ position: 2 })
      const newTag = createMockTagRecord({ position: 3 })

      const mockClient = createMockSupabaseClient([
        { data: { id: 'project-123' }, error: null }, // project ownership
        { count: 2, error: null }, // tag count
        { data: [existingTag], error: null }, // position lookup returns highest
        { data: newTag, error: null }, // insert result
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await createCustomTag('project-123', {
        name: 'Test Tag',
        slug: 'test_tag',
        description: 'Test description',
      })

      expect(result.position).toBe(3)
    })
  })

  // ==========================================================================
  // updateCustomTag
  // ==========================================================================
  describe('updateCustomTag', () => {
    it('should update only provided fields', async () => {
      const updatedTag = createMockTagRecord({ name: 'Updated Name' })

      const mockClient = createMockSupabaseClient([
        { data: updatedTag, error: null }, // update result
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await updateCustomTag('tag-123', { name: 'Updated Name' })

      expect(mockClient.from).toHaveBeenCalledWith('custom_tags')
      expect(result).toEqual(updatedTag)
    })

    it('should throw error on duplicate slug', async () => {
      const mockClient = createMockSupabaseClient([
        { data: null, error: { code: '23505', message: 'Unique constraint violation' } },
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(updateCustomTag('tag-123', {
        slug: 'existing_slug'
      })).rejects.toThrow('A tag with this slug already exists')
    })

    it('should throw error for non-existent tag', async () => {
      const mockClient = createMockSupabaseClient([
        { data: null, error: { code: 'PGRST116', message: 'Not found' } },
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(updateCustomTag('nonexistent-tag', {
        name: 'New Name'
      })).rejects.toThrow('Custom tag not found')
    })

    it('should return existing tag when no updates provided', async () => {
      const existingTag = createMockTagRecord()

      // Query sequence for getCustomTagById call:
      // 1. Get tag by ID
      // 2. Verify project ownership
      const mockClient = createMockSupabaseClient([
        { data: existingTag, error: null }, // get tag by id
        { data: { id: 'project-123' }, error: null }, // project ownership
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await updateCustomTag('tag-123', {})

      expect(result).toEqual(existingTag)
    })

    it('should throw UnauthorizedError for unauthorized user', async () => {
      const mockClient = createMockSupabaseClient([], null) // null user
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(updateCustomTag('tag-123', {
        name: 'New Name'
      })).rejects.toThrow(UnauthorizedError)
    })
  })

  // ==========================================================================
  // deleteCustomTag
  // ==========================================================================
  describe('deleteCustomTag', () => {
    it('should delete tag successfully', async () => {
      const mockClient = createMockSupabaseClient([
        { error: null }, // delete result
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await deleteCustomTag('tag-123')

      expect(mockClient.from).toHaveBeenCalledWith('custom_tags')
      expect(result).toBe(true)
    })

    it('should throw UnauthorizedError for unauthorized user', async () => {
      const mockClient = createMockSupabaseClient([], null) // null user
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(deleteCustomTag('tag-123')).rejects.toThrow(UnauthorizedError)
    })

    it('should throw error on database error', async () => {
      const mockClient = createMockSupabaseClient([
        { error: { message: 'Database error', code: '500' } },
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(deleteCustomTag('tag-123')).rejects.toThrow('Unable to delete custom tag')
    })
  })

  // ==========================================================================
  // canAddCustomTag
  // ==========================================================================
  describe('canAddCustomTag', () => {
    it('should return true when under limit', async () => {
      const mockClient = createMockSupabaseClient([
        { count: 5, error: null },
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await canAddCustomTag('project-123')

      expect(result).toBe(true)
    })

    it('should return false when at limit (10)', async () => {
      const mockClient = createMockSupabaseClient([
        { count: 10, error: null },
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await canAddCustomTag('project-123')

      expect(result).toBe(false)
    })

    it('should return false when Supabase not configured', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false)

      const result = await canAddCustomTag('project-123')

      expect(result).toBe(false)
    })

    it('should return false on database error', async () => {
      const mockClient = createMockSupabaseClient([
        { count: null, error: { message: 'Error' } },
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await canAddCustomTag('project-123')

      expect(result).toBe(false)
    })
  })

  // ==========================================================================
  // updateTagPositions
  // ==========================================================================
  describe('updateTagPositions', () => {
    it('should update positions for multiple tags', async () => {
      const mockClient = createMockSupabaseClient([
        { error: null }, // update tag 1
        { error: null }, // update tag 2
        { error: null }, // update tag 3
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      const result = await updateTagPositions([
        { id: 'tag-1', position: 0 },
        { id: 'tag-2', position: 1 },
        { id: 'tag-3', position: 2 },
      ])

      expect(mockClient.from).toHaveBeenCalledTimes(3)
      expect(result).toBe(true)
    })

    it('should throw UnauthorizedError for unauthorized user', async () => {
      const mockClient = createMockSupabaseClient([], null) // null user
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(updateTagPositions([
        { id: 'tag-1', position: 0 },
      ])).rejects.toThrow(UnauthorizedError)
    })

    it('should throw error on database error', async () => {
      const mockClient = createMockSupabaseClient([
        { error: { message: 'Database error', code: '500' } },
      ])
      mockCreateClient.mockResolvedValue(mockClient)

      await expect(updateTagPositions([
        { id: 'tag-1', position: 0 },
      ])).rejects.toThrow('Unable to update tag positions')
    })
  })
})
