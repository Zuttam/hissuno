/**
 * Unit Tests for Knowledge Embedding Service
 *
 * Tests the embedding generation and search functionality
 * using mocked OpenAI and Supabase clients.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store references that can be accessed inside mocks
const mocks = {
  openAIEmbeddingsCreate: vi.fn(),
  createAdminClient: vi.fn(),
  downloadKnowledgePackage: vi.fn(),
  chunkKnowledgeContent: vi.fn(),
}

// Mock OpenAI module before imports
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: (...args: unknown[]) => mocks.openAIEmbeddingsCreate(...args),
      }
    },
  }
})

// Mock Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mocks.createAdminClient(),
}))

// Mock storage module
vi.mock('@/lib/knowledge/storage', () => ({
  downloadKnowledgePackage: (...args: unknown[]) => mocks.downloadKnowledgePackage(...args),
}))

// Mock chunking module
vi.mock('@/lib/knowledge/chunking', () => ({
  chunkKnowledgeContent: (...args: unknown[]) => mocks.chunkKnowledgeContent(...args),
}))

// Import after mocks are set up
import { embedProjectKnowledge, embedQuery, searchKnowledgeEmbeddings } from '@/lib/knowledge/embedding-service'

// Export mocks for easy access in tests
const mockOpenAIEmbeddingsCreate = mocks.openAIEmbeddingsCreate
const mockCreateAdminClient = mocks.createAdminClient
const mockDownloadKnowledgePackage = mocks.downloadKnowledgePackage
const mockChunkKnowledgeContent = mocks.chunkKnowledgeContent

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEmbedding(dimension: number = 1536): number[] {
  return Array(dimension).fill(0).map(() => Math.random())
}

function createMockPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pkg-123',
    project_id: 'project-123',
    category: 'business',
    storage_path: 'knowledge/project-123/business/v1.md',
    version: 1,
    generated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function createMockChunk(overrides: Record<string, unknown> = {}) {
  return {
    index: 0,
    text: 'Sample chunk text content',
    startLine: 0,
    endLine: 10,
    sectionHeading: 'Section Title',
    parentHeadings: ['Main Heading'],
    ...overrides,
  }
}

function createMockSupabaseClient(queryResults: Array<{ data?: unknown; error?: unknown; count?: number | null }>) {
  let callIndex = 0

  const getNextResult = () => {
    const result = queryResults[callIndex] ?? { data: null, error: null }
    callIndex++
    return result
  }

  const createBuilder = () => {
    const builder: Record<string, unknown> = {}

    const chainMethods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'rpc']
    chainMethods.forEach((method) => {
      builder[method] = vi.fn().mockImplementation(() => builder)
    })

    builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResult()))

    builder.then = (resolve: (value: unknown) => void) => {
      const result = getNextResult()
      resolve(result)
      return Promise.resolve(result)
    }

    return builder
  }

  return {
    from: vi.fn().mockImplementation(() => createBuilder()),
    rpc: vi.fn().mockImplementation(() => Promise.resolve(getNextResult())),
  }
}

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks()

  // Default mock for embeddings - returns embedding for each input
  mockOpenAIEmbeddingsCreate.mockImplementation(async ({ input }: { input: string | string[] }) => {
    const inputs = Array.isArray(input) ? input : [input]
    return {
      data: inputs.map((_, i) => ({
        index: i,
        embedding: createMockEmbedding(),
      })),
    }
  })
})

afterEach(() => {
  vi.resetAllMocks()
})

// ============================================================================
// Tests: embedProjectKnowledge
// ============================================================================

describe('embedProjectKnowledge', () => {
  it('should return success with zero chunks when no packages exist', async () => {
    const mockClient = createMockSupabaseClient([
      { data: [], error: null }, // No packages found
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    const result = await embedProjectKnowledge('project-123')

    expect(result.success).toBe(true)
    expect(result.chunksEmbedded).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('should embed all packages for a project', async () => {
    const packages = [
      createMockPackage({ category: 'business' }),
      createMockPackage({ id: 'pkg-456', category: 'product' }),
    ]

    const chunks = [
      createMockChunk({ index: 0 }),
      createMockChunk({ index: 1, text: 'Another chunk' }),
    ]

    // Mock Supabase - returns packages, then handles delete/insert for each
    const mockClient = createMockSupabaseClient([
      { data: packages, error: null }, // Fetch packages
      // Package 1
      { error: null }, // Delete old embeddings
      { error: null }, // Insert batch 1
      // Package 2
      { error: null }, // Delete old embeddings
      { error: null }, // Insert batch 2
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    // Mock storage - returns content for both packages
    mockDownloadKnowledgePackage.mockResolvedValue({
      content: '# Sample Content\n\nThis is sample content.',
      error: null,
    })

    // Mock chunking - returns chunks
    mockChunkKnowledgeContent.mockReturnValue(chunks)

    const result = await embedProjectKnowledge('project-123')

    expect(result.success).toBe(true)
    expect(result.chunksEmbedded).toBe(4) // 2 chunks per package * 2 packages
    expect(result.errors).toEqual([])

    // Verify embeddings were generated
    expect(mockOpenAIEmbeddingsCreate).toHaveBeenCalled()
  })

  it('should return error when fetch packages fails', async () => {
    const mockClient = createMockSupabaseClient([
      { data: null, error: { message: 'Database error' } },
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    const result = await embedProjectKnowledge('project-123')

    expect(result.success).toBe(false)
    expect(result.chunksEmbedded).toBe(0)
    expect(result.errors).toContain('Database error')
  })

  it('should handle download errors gracefully', async () => {
    const packages = [createMockPackage()]

    const mockClient = createMockSupabaseClient([
      { data: packages, error: null },
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    // Mock storage failure
    mockDownloadKnowledgePackage.mockResolvedValue({
      content: null,
      error: { message: 'Download failed' },
    })

    const result = await embedProjectKnowledge('project-123')

    expect(result.success).toBe(false)
    expect(result.errors).toContain('business: Download failed')
  })

  it('should handle empty content gracefully', async () => {
    const packages = [createMockPackage()]

    const mockClient = createMockSupabaseClient([
      { data: packages, error: null },
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    // Empty string content is treated as a failure (nothing to embed)
    mockDownloadKnowledgePackage.mockResolvedValue({
      content: '',
      error: null,
    })

    mockChunkKnowledgeContent.mockReturnValue([])

    const result = await embedProjectKnowledge('project-123')

    // Empty content returns success: false since there's nothing to embed
    expect(result.success).toBe(false)
    expect(result.chunksEmbedded).toBe(0)
  })
})

// ============================================================================
// Tests: embedQuery
// ============================================================================

describe('embedQuery', () => {
  it('should generate embedding for a query string', async () => {
    const query = 'What is the pricing model?'
    const mockEmbedding = createMockEmbedding()

    mockOpenAIEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ index: 0, embedding: mockEmbedding }],
    })

    const result = await embedQuery(query)

    expect(result).toEqual(mockEmbedding)
    expect(mockOpenAIEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536,
    })
  })

  it('should trim whitespace from query', async () => {
    const query = '  How do I get started?  '
    const mockEmbedding = createMockEmbedding()

    mockOpenAIEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ index: 0, embedding: mockEmbedding }],
    })

    await embedQuery(query)

    expect(mockOpenAIEmbeddingsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'How do I get started?',
      })
    )
  })

  it('should throw error on OpenAI failure', async () => {
    mockOpenAIEmbeddingsCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'))

    await expect(embedQuery('test query')).rejects.toThrow('API rate limit exceeded')
  })
})

// ============================================================================
// Tests: searchKnowledgeEmbeddings
// ============================================================================

describe('searchKnowledgeEmbeddings', () => {
  it('should search embeddings with default options', async () => {
    const mockResults = [
      {
        id: 'emb-1',
        category: 'business',
        chunk_text: 'Pricing information here',
        section_heading: 'Pricing',
        parent_headings: ['Overview'],
        similarity: 0.85,
      },
      {
        id: 'emb-2',
        category: 'product',
        chunk_text: 'Feature details',
        section_heading: 'Features',
        parent_headings: ['Product'],
        similarity: 0.75,
      },
    ]

    const mockClient = createMockSupabaseClient([])
    mockClient.rpc = vi.fn().mockResolvedValue({ data: mockResults, error: null })
    mockCreateAdminClient.mockReturnValue(mockClient)

    const results = await searchKnowledgeEmbeddings('project-123', 'pricing model')

    expect(results).toHaveLength(2)
    expect(results[0].category).toBe('business')
    expect(results[0].chunkText).toBe('Pricing information here')
    expect(results[0].sectionHeading).toBe('Pricing')
    expect(results[0].similarity).toBe(0.85)
  })

  it('should filter by categories when specified', async () => {
    const mockClient = createMockSupabaseClient([])
    mockClient.rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    mockCreateAdminClient.mockReturnValue(mockClient)

    await searchKnowledgeEmbeddings('project-123', 'test query', {
      categories: ['business', 'faq'],
    })

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'search_knowledge_embeddings',
      expect.objectContaining({
        p_categories: ['business', 'faq'],
      })
    )
  })

  it('should respect limit option', async () => {
    const mockClient = createMockSupabaseClient([])
    mockClient.rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    mockCreateAdminClient.mockReturnValue(mockClient)

    await searchKnowledgeEmbeddings('project-123', 'test query', {
      limit: 10,
    })

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'search_knowledge_embeddings',
      expect.objectContaining({
        p_limit: 10,
      })
    )
  })

  it('should respect similarity threshold option', async () => {
    const mockClient = createMockSupabaseClient([])
    mockClient.rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    mockCreateAdminClient.mockReturnValue(mockClient)

    await searchKnowledgeEmbeddings('project-123', 'test query', {
      similarityThreshold: 0.8,
    })

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'search_knowledge_embeddings',
      expect.objectContaining({
        p_similarity_threshold: 0.8,
      })
    )
  })

  it('should throw error on RPC failure', async () => {
    const mockClient = createMockSupabaseClient([])
    mockClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'RPC function error' },
    })
    mockCreateAdminClient.mockReturnValue(mockClient)

    await expect(searchKnowledgeEmbeddings('project-123', 'test')).rejects.toThrow('Search failed: RPC function error')
  })

  it('should handle empty results', async () => {
    const mockClient = createMockSupabaseClient([])
    mockClient.rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    mockCreateAdminClient.mockReturnValue(mockClient)

    const results = await searchKnowledgeEmbeddings('project-123', 'nonexistent query')

    expect(results).toEqual([])
  })

  it('should handle null parent_headings', async () => {
    const mockResults = [
      {
        id: 'emb-1',
        category: 'technical',
        chunk_text: 'Technical content',
        section_heading: null,
        parent_headings: null,
        similarity: 0.7,
      },
    ]

    const mockClient = createMockSupabaseClient([])
    mockClient.rpc = vi.fn().mockResolvedValue({ data: mockResults, error: null })
    mockCreateAdminClient.mockReturnValue(mockClient)

    const results = await searchKnowledgeEmbeddings('project-123', 'technical')

    expect(results[0].parentHeadings).toEqual([])
    expect(results[0].sectionHeading).toBeNull()
  })
})

// ============================================================================
// Tests: Batching Behavior
// ============================================================================

describe('batching behavior', () => {
  it('should batch embeddings when chunking produces many chunks', async () => {
    // Create 150 chunks (exceeds typical batch size)
    const manyChunks = Array(150)
      .fill(null)
      .map((_, i) => createMockChunk({ index: i, text: `Chunk ${i} content` }))

    const packages = [createMockPackage()]

    const mockClient = createMockSupabaseClient([
      { data: packages, error: null },
      { error: null }, // Delete
      { error: null }, // Insert batch 1
      { error: null }, // Insert batch 2
      { error: null }, // Insert batch 3
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    mockDownloadKnowledgePackage.mockResolvedValue({
      content: '# Large Content',
      error: null,
    })

    mockChunkKnowledgeContent.mockReturnValue(manyChunks)

    const result = await embedProjectKnowledge('project-123')

    expect(result.success).toBe(true)
    expect(result.chunksEmbedded).toBe(150)

    // OpenAI should be called multiple times for batching
    expect(mockOpenAIEmbeddingsCreate).toHaveBeenCalled()
  })
})
