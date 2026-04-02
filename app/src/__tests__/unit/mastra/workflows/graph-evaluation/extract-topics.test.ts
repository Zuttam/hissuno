/**
 * Tests for Step 2: Extract Topics.
 * Verifies LLM topic extraction, contact bypass, fallback behavior, and topic capping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateObject = vi.hoisted(() => vi.fn())

vi.mock('ai', () => ({
  generateObject: mockGenerateObject,
}))
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-model'),
}))

import { extractTopics } from '@/mastra/workflows/graph-evaluation/steps/extract-topics'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractTopics', () => {
  describe('contact bypass', () => {
    it('returns [entityName] as topics without calling LLM', async () => {
      const result = await extractTopics('contact content text', 'Jane Doe', 'contact', null)
      expect(result.topics).toEqual(['Jane Doe'])
      expect(mockGenerateObject).not.toHaveBeenCalled()
    })

    it('returns contentForSearch as combinedQuery (not topics.join)', async () => {
      const result = await extractTopics('Jane Doe jane@example.com Product Manager', 'Jane Doe', 'contact', null)
      expect(result.combinedQuery).toBe('Jane Doe jane@example.com Product Manager')
    })

    it('works with empty contentForSearch', async () => {
      const result = await extractTopics('', 'Jane Doe', 'contact', null)
      expect(result.topics).toEqual(['Jane Doe'])
      expect(result.combinedQuery).toBe('')
    })

    it('works with empty entityName', async () => {
      const result = await extractTopics('some content', '', 'contact', null)
      expect(result.topics).toEqual([''])
      expect(result.combinedQuery).toBe('some content')
    })
  })

  describe('LLM topic extraction', () => {
    it('calls generateObject for non-contact entity types', async () => {
      mockGenerateObject.mockResolvedValue({ object: { topics: ['billing', 'payments'] } })

      await extractTopics('session content', 'Session A', 'session', null)
      expect(mockGenerateObject).toHaveBeenCalledTimes(1)
    })

    it('includes entity content in the prompt', async () => {
      mockGenerateObject.mockResolvedValue({ object: { topics: ['api'] } })

      await extractTopics('API integration details', 'API Issue', 'issue', null)
      const prompt = mockGenerateObject.mock.calls[0][0].prompt
      expect(prompt).toContain('API integration details')
    })

    it('includes guidelines in prompt when provided', async () => {
      mockGenerateObject.mockResolvedValue({ object: { topics: ['billing'] } })

      await extractTopics('content', 'Entity', 'session', 'Focus on payment topics')
      const prompt = mockGenerateObject.mock.calls[0][0].prompt
      expect(prompt).toContain('Focus on payment topics')
      expect(prompt).toContain('User guidelines for relationship discovery')
    })

    it('omits guidelines section from prompt when guidelines is null', async () => {
      mockGenerateObject.mockResolvedValue({ object: { topics: ['billing'] } })

      await extractTopics('content', 'Entity', 'session', null)
      const prompt = mockGenerateObject.mock.calls[0][0].prompt
      expect(prompt).not.toContain('User guidelines')
    })

    it('uses "knowledge source" label for knowledge_source entityType', async () => {
      mockGenerateObject.mockResolvedValue({ object: { topics: ['docs'] } })

      await extractTopics('content', 'Entity', 'knowledge_source', null)
      const prompt = mockGenerateObject.mock.calls[0][0].prompt
      expect(prompt).toContain('knowledge source')
      expect(prompt).not.toContain('knowledge_source')
    })

    it('uses entityType directly as label for session, issue, company', async () => {
      for (const entityType of ['session', 'issue', 'company'] as const) {
        vi.clearAllMocks()
        mockGenerateObject.mockResolvedValue({ object: { topics: ['topic'] } })

        await extractTopics('content', 'Entity', entityType, null)
        const prompt = mockGenerateObject.mock.calls[0][0].prompt
        expect(prompt).toContain(`this ${entityType} content`)
      }
    })

    it('limits topics to maximum 5 even if LLM returns more', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { topics: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
      })

      const result = await extractTopics('content', 'Entity', 'session', null)
      expect(result.topics).toHaveLength(5)
      expect(result.topics).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    it('returns topics.join(" ") as combinedQuery for non-contacts', async () => {
      mockGenerateObject.mockResolvedValue({
        object: { topics: ['billing', 'payments', 'api'] },
      })

      const result = await extractTopics('content', 'Entity', 'issue', null)
      expect(result.combinedQuery).toBe('billing payments api')
    })
  })

  describe('LLM failure fallback', () => {
    it('falls back to [entityName] when generateObject throws', async () => {
      mockGenerateObject.mockRejectedValue(new Error('LLM timeout'))

      const result = await extractTopics('content', 'My Session', 'session', null)
      expect(result.topics).toEqual(['My Session'])
      expect(result.combinedQuery).toBe('My Session')
    })

    it('falls back to [entityName] when generateObject returns empty topics array', async () => {
      mockGenerateObject.mockResolvedValue({ object: { topics: [] } })

      const result = await extractTopics('content', 'Test Issue', 'issue', null)
      expect(result.topics).toEqual(['Test Issue'])
      expect(result.combinedQuery).toBe('Test Issue')
    })

    it('filters empty entityName via filter(Boolean) on fallback', async () => {
      mockGenerateObject.mockRejectedValue(new Error('fail'))

      const result = await extractTopics('content', '', 'session', null)
      expect(result.topics).toEqual([])
      expect(result.combinedQuery).toBe('')
    })
  })

  describe('all non-contact entity types call LLM', () => {
    for (const entityType of ['session', 'issue', 'knowledge_source', 'company'] as const) {
      it(`calls LLM for ${entityType}`, async () => {
        mockGenerateObject.mockResolvedValue({ object: { topics: ['topic'] } })

        await extractTopics('content', 'Entity', entityType, null)
        expect(mockGenerateObject).toHaveBeenCalledTimes(1)
      })
    }
  })
})
