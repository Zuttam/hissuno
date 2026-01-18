/**
 * OpenAI Embeddings Mock
 *
 * Provides deterministic mock responses for OpenAI embedding API calls
 * in integration tests. Uses consistent fake embedding vectors that are
 * valid for pgvector operations.
 */

import { vi } from 'vitest'

// Generate a deterministic 1536-dimension embedding based on input text
// Uses a simple hash-based approach for reproducibility
function generateDeterministicEmbedding(text: string): number[] {
  const embedding: number[] = []
  const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

  for (let i = 0; i < 1536; i++) {
    // Generate values between -1 and 1 using a simple deterministic formula
    const value = Math.sin(seed * (i + 1) * 0.001) * 0.5
    embedding.push(value)
  }

  // Normalize the embedding to unit length (important for cosine similarity)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map((val) => val / magnitude)
}

// Default mock embedding response
export function createMockEmbeddingResponse(
  inputs: string | string[]
): {
  data: Array<{ embedding: number[]; index: number; object: 'embedding' }>
  model: string
  usage: { prompt_tokens: number; total_tokens: number }
  object: 'list'
} {
  const inputArray = Array.isArray(inputs) ? inputs : [inputs]

  return {
    data: inputArray.map((text, index) => ({
      embedding: generateDeterministicEmbedding(text),
      index,
      object: 'embedding' as const,
    })),
    model: 'text-embedding-3-small',
    usage: {
      prompt_tokens: inputArray.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
      total_tokens: inputArray.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
    },
    object: 'list' as const,
  }
}

/**
 * Mock the OpenAI module for embedding tests
 *
 * Usage in tests:
 * ```ts
 * import { mockOpenAIEmbeddings } from '@/__tests__/mocks/openai-embeddings'
 *
 * beforeAll(() => {
 *   mockOpenAIEmbeddings()
 * })
 * ```
 */
export function mockOpenAIEmbeddings(): void {
  vi.mock('openai', () => {
    const mockCreate = vi.fn().mockImplementation(async (params: { input: string | string[] }) => {
      return createMockEmbeddingResponse(params.input)
    })

    return {
      default: vi.fn().mockImplementation(() => ({
        embeddings: {
          create: mockCreate,
        },
      })),
    }
  })
}

/**
 * Get a reference to the mock create function for assertions
 * Must be called after mockOpenAIEmbeddings()
 */
export function getMockEmbeddingsCreate(): ReturnType<typeof vi.fn> | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenAI = require('openai').default
  const instance = new OpenAI()
  return instance.embeddings?.create ?? null
}

/**
 * Reset the mock call history
 */
export function resetEmbeddingsMock(): void {
  const mockFn = getMockEmbeddingsCreate()
  if (mockFn) {
    mockFn.mockClear()
  }
}
