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

// Mock Drizzle db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
}))

// Mock storage module (no longer needs downloadAnalyzedContent - content comes from DB)

// Mock chunking module
vi.mock('@/lib/knowledge/chunking', () => ({
  chunkKnowledgeContent: vi.fn(),
}))

// Import after mocks are set up
import { embedQuery } from '@/lib/knowledge/embedding-service'

// Export mocks for easy access in tests
const mockOpenAIEmbeddingsCreate = mocks.openAIEmbeddingsCreate

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEmbedding(dimension: number = 1536): number[] {
  return Array(dimension).fill(0).map(() => Math.random())
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
