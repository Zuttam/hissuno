/**
 * Tests for Step 2: Extract Topics.
 * Verifies LLM topic extraction, contact bypass, fallback behavior, and topic capping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAgentGenerate = vi.hoisted(() => vi.fn())

vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    generate = mockAgentGenerate
  },
}))
vi.mock('@/mastra/models', () => ({
  resolveModel: vi.fn(() => 'mock-model'),
}))
vi.mock('@/lib/db/queries/project-settings', () => ({
  getAIModelSettingsAdmin: vi.fn(() => Promise.resolve({ ai_model: null, ai_model_small: null })),
}))

import { extractTopics } from '@/mastra/workflows/graph-evaluation/steps/extract-topics'

/** Helper: mock agent.generate to resolve with a structured object */
function mockGenerateResult(obj: unknown) {
  mockAgentGenerate.mockResolvedValue({ object: obj })
}

/** Helper: mock agent.generate to reject */
function mockGenerateReject(error: Error) {
  mockAgentGenerate.mockRejectedValue(error)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractTopics', () => {
  describe('contact bypass', () => {
    it('returns [entityName] as topics without calling LLM', async () => {
      const result = await extractTopics('contact content text', 'Jane Doe', 'contact', null)
      expect(result.topics).toEqual(['Jane Doe'])
      expect(mockAgentGenerate).not.toHaveBeenCalled()
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
    it('calls agent.generate for non-contact entity types', async () => {
      mockGenerateResult({ topics: ['billing', 'payments'] })

      await extractTopics('session content', 'Session A', 'session', null)
      expect(mockAgentGenerate).toHaveBeenCalledTimes(1)
    })

    it('includes entity content in the prompt', async () => {
      mockGenerateResult({ topics: ['api'] })

      await extractTopics('API integration details', 'API Issue', 'issue', null)
      const prompt = mockAgentGenerate.mock.calls[0][0]
      expect(prompt).toContain('API integration details')
    })

    it('includes guidelines in prompt when provided', async () => {
      mockGenerateResult({ topics: ['billing'] })

      await extractTopics('content', 'Entity', 'session', 'Focus on payment topics')
      const prompt = mockAgentGenerate.mock.calls[0][0]
      expect(prompt).toContain('Focus on payment topics')
      expect(prompt).toContain('User guidelines for relationship discovery')
    })

    it('omits guidelines section from prompt when guidelines is null', async () => {
      mockGenerateResult({ topics: ['billing'] })

      await extractTopics('content', 'Entity', 'session', null)
      const prompt = mockAgentGenerate.mock.calls[0][0]
      expect(prompt).not.toContain('User guidelines')
    })

    it('uses "knowledge source" label for knowledge_source entityType', async () => {
      mockGenerateResult({ topics: ['docs'] })

      await extractTopics('content', 'Entity', 'knowledge_source', null)
      const prompt = mockAgentGenerate.mock.calls[0][0]
      expect(prompt).toContain('knowledge source')
      expect(prompt).not.toContain('knowledge_source')
    })

    it('uses entityType directly as label for session, issue, company', async () => {
      for (const entityType of ['session', 'issue', 'company'] as const) {
        vi.clearAllMocks()
        mockGenerateResult({ topics: ['topic'] })

        await extractTopics('content', 'Entity', entityType, null)
        const prompt = mockAgentGenerate.mock.calls[0][0]
        expect(prompt).toContain(`this ${entityType} content`)
      }
    })

    it('limits topics to maximum 5 even if LLM returns more', async () => {
      mockGenerateResult({ topics: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })

      const result = await extractTopics('content', 'Entity', 'session', null)
      expect(result.topics).toHaveLength(5)
      expect(result.topics).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    it('returns topics.join(" ") as combinedQuery for non-contacts', async () => {
      mockGenerateResult({ topics: ['billing', 'payments', 'api'] })

      const result = await extractTopics('content', 'Entity', 'issue', null)
      expect(result.combinedQuery).toBe('billing payments api')
    })
  })

  describe('LLM failure fallback', () => {
    it('falls back to [entityName] when agent.generate throws', async () => {
      mockGenerateReject(new Error('LLM timeout'))

      const result = await extractTopics('content', 'My Session', 'session', null)
      expect(result.topics).toEqual(['My Session'])
      expect(result.combinedQuery).toBe('My Session')
    })

    it('falls back to [entityName] when agent returns empty topics array', async () => {
      mockGenerateResult({ topics: [] })

      const result = await extractTopics('content', 'Test Issue', 'issue', null)
      expect(result.topics).toEqual(['Test Issue'])
      expect(result.combinedQuery).toBe('Test Issue')
    })

    it('filters empty entityName via filter(Boolean) on fallback', async () => {
      mockGenerateReject(new Error('fail'))

      const result = await extractTopics('content', '', 'session', null)
      expect(result.topics).toEqual([])
      expect(result.combinedQuery).toBe('')
    })
  })

  describe('all non-contact entity types call LLM', () => {
    for (const entityType of ['session', 'issue', 'knowledge_source', 'company'] as const) {
      it(`calls LLM for ${entityType}`, async () => {
        mockGenerateResult({ topics: ['topic'] })

        await extractTopics('content', 'Entity', entityType, null)
        expect(mockAgentGenerate).toHaveBeenCalledTimes(1)
      })
    }
  })
})
