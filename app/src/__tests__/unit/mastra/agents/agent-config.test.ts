import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLoadPackageKnowledge = vi.fn()
vi.mock('@/lib/knowledge/loader', () => ({
  loadPackageKnowledge: (...args: unknown[]) => mockLoadPackageKnowledge(...args),
}))

import { resolveAgent, supportAgent, productManagerAgent } from '@/mastra/agents/chat-agent'

describe('Agent Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadPackageKnowledge.mockResolvedValue(null)
  })

  describe('resolveAgent', () => {
    it('routes to support agent when contactId is present', async () => {
      const result = await resolveAgent({
        contactId: 'contact-1',
        supportPackageId: null,
      })

      expect(result.agent).toBe(supportAgent)
      expect(result.mode).toBe('support')
    })

    it('routes to product manager agent when no contactId', async () => {
      const result = await resolveAgent({
        contactId: null,
        supportPackageId: null,
      })

      expect(result.agent).toBe(productManagerAgent)
      expect(result.mode).toBe('product-manager')
    })

    it('injects knowledge system messages for support agent', async () => {
      mockLoadPackageKnowledge.mockResolvedValue('Product documentation content')

      const result = await resolveAgent({
        contactId: 'contact-1',
        supportPackageId: 'pkg-1',
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
        supportPackageId: 'pkg-1',
      })

      expect(result.systemMessages).toHaveLength(0)
    })

    it('does not inject knowledge for product manager agent', async () => {
      mockLoadPackageKnowledge.mockResolvedValue('Product documentation content')

      const result = await resolveAgent({
        contactId: null,
        supportPackageId: 'pkg-1',
      })

      expect(result.systemMessages).toHaveLength(0)
    })

    it('does not inject knowledge when supportPackageId is null', async () => {
      const result = await resolveAgent({
        contactId: 'contact-1',
        supportPackageId: null,
      })

      expect(result.systemMessages).toHaveLength(0)
    })
  })
})
