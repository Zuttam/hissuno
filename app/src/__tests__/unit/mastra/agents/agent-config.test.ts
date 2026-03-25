import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock mastra
const mockGetAgent = vi.fn()
vi.mock('@/mastra', () => ({
  mastra: {
    getAgent: (...args: unknown[]) => mockGetAgent(...args),
  },
}))

// Mock knowledge loader
const mockLoadPackageKnowledge = vi.fn()
vi.mock('@/lib/knowledge/loader', () => ({
  loadPackageKnowledge: (...args: unknown[]) => mockLoadPackageKnowledge(...args),
}))

import { resolveAgent } from '@/mastra/agents/router'

describe('Agent Router', () => {
  const fakeAgent = {
    name: 'fake-agent',
    instructions: 'You are a test agent.',
    model: 'openai/gpt-5.4-mini',
    tools: {},
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAgent.mockReturnValue(fakeAgent)
    mockLoadPackageKnowledge.mockResolvedValue(null)
  })

  describe('resolveAgent', () => {
    it('routes to support agent when contactId is present', async () => {
      const result = await resolveAgent({
        contactId: 'contact-1',
        knowledgePackageId: null,
      })

      expect(mockGetAgent).toHaveBeenCalledWith('supportAgent')
      expect(result.mode).toBe('support')
    })

    it('routes to product manager agent when no contactId', async () => {
      const result = await resolveAgent({
        contactId: null,
        knowledgePackageId: null,
      })

      expect(mockGetAgent).toHaveBeenCalledWith('productManagerAgent')
      expect(result.mode).toBe('product-manager')
    })

    it('throws error when agent not found', async () => {
      mockGetAgent.mockReturnValue(null)

      await expect(
        resolveAgent({ contactId: 'contact-1', knowledgePackageId: null })
      ).rejects.toThrow('not found in Mastra registry')
    })

    it('injects knowledge system messages for support agent', async () => {
      mockLoadPackageKnowledge.mockResolvedValue('Product documentation content')

      const result = await resolveAgent({
        contactId: 'contact-1',
        knowledgePackageId: 'pkg-1',
      })

      expect(result.systemMessages).toHaveLength(1)
      expect(result.systemMessages[0]).toEqual(
        expect.objectContaining({
          role: 'system',
        })
      )
      expect(result.systemMessages[0].content).toContain('Knowledge Base')
    })

    it('handles knowledge loading failure gracefully', async () => {
      mockLoadPackageKnowledge.mockRejectedValue(new Error('Failed to load'))

      const result = await resolveAgent({
        contactId: 'contact-1',
        knowledgePackageId: 'pkg-1',
      })

      expect(result.systemMessages).toHaveLength(0)
    })

    it('does not inject knowledge for product manager agent', async () => {
      mockLoadPackageKnowledge.mockResolvedValue('Product documentation content')

      const result = await resolveAgent({
        contactId: null,
        knowledgePackageId: 'pkg-1',
      })

      expect(result.systemMessages).toHaveLength(0)
    })

    it('does not inject knowledge when knowledgePackageId is null', async () => {
      const result = await resolveAgent({
        contactId: 'contact-1',
        knowledgePackageId: null,
      })

      expect(result.systemMessages).toHaveLength(0)
    })
  })
})
