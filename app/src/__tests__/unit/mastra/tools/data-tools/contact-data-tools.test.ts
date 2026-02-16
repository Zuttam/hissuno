/**
 * Tests for contact-mode data tools
 *
 * Verifies:
 * - Contact scoping: all queries filter by contactId
 * - Ownership check on get-conversation
 * - Error handling when contactId or projectId is missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RuntimeContext } from '@mastra/core/runtime-context'

// ============================================================================
// MOCKS
// ============================================================================

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

function chainable() {
  return {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    from: mockFrom,
  }
}

for (const fn of [mockSelect, mockEq, mockOrder, mockLimit, mockFrom]) {
  fn.mockReturnValue(chainable())
}
mockSingle.mockResolvedValue({ data: null, error: null })
mockLimit.mockResolvedValue({ data: [], count: 0, error: null })

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))

// ============================================================================
// IMPORT
// ============================================================================

import {
  myIssuesTool,
  myConversationsTool,
  getConversationTool,
} from '@/mastra/tools/data-tools/contact-data-tools'

// ============================================================================
// HELPERS
// ============================================================================

function makeRuntimeContext(projectId: string | null, contactId: string | null) {
  const ctx = new RuntimeContext()
  if (projectId) ctx.set('projectId', projectId)
  if (contactId) ctx.set('contactId', contactId)
  return ctx
}

// ============================================================================
// TESTS
// ============================================================================

describe('contact-mode data tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const fn of [mockSelect, mockEq, mockOrder, mockLimit, mockFrom]) {
      fn.mockReturnValue(chainable())
    }
    mockSingle.mockResolvedValue({ data: null, error: null })
    mockLimit.mockResolvedValue({ data: [], count: 0, error: null })
  })

  describe('my-issues', () => {
    it('returns error when projectId is missing', async () => {
      const result = await myIssuesTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext(null, 'contact-1'),
      } as any)

      expect(result.error).toBe('Project context not available.')
    })

    it('returns error when contactId is missing', async () => {
      const result = await myIssuesTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext('proj-1', null),
      } as any)

      expect(result.error).toBe('Contact context not available.')
    })

    it('queries sessions by contact_id and project_id', async () => {
      // Mock: sessions query returns empty
      mockEq.mockReturnValue(chainable())

      const result = await myIssuesTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext('proj-1', 'contact-1'),
      } as any)

      expect(mockFrom).toHaveBeenCalledWith('sessions')
      expect(mockEq).toHaveBeenCalledWith('contact_id', 'contact-1')
      expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-1')
      expect(result.issues).toEqual([])
    })
  })

  describe('my-conversations', () => {
    it('returns error when contactId is missing', async () => {
      const result = await myConversationsTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext('proj-1', null),
      } as any)

      expect(result.error).toBe('Contact context not available.')
    })

    it('queries sessions by contact_id', async () => {
      mockLimit.mockResolvedValue({
        data: [
          { id: 's-1', name: 'Chat 1', source: 'widget', status: 'active', message_count: 5, created_at: '2026-01-01', last_activity_at: '2026-01-02' },
        ],
        count: 1,
        error: null,
      })

      const result = await myConversationsTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext('proj-1', 'contact-1'),
      } as any)

      expect(mockEq).toHaveBeenCalledWith('contact_id', 'contact-1')
      expect(result.conversations).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  describe('get-conversation', () => {
    it('returns error when contactId is missing', async () => {
      const result = await getConversationTool.execute!({
        context: { sessionId: 's-1' },
        runtimeContext: makeRuntimeContext('proj-1', null),
      } as any)

      expect(result.error).toBe('Contact context not available.')
      expect(result.found).toBe(false)
    })

    it('rejects access when session belongs to different contact', async () => {
      // Mock: session exists but belongs to a different contact
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 's-1',
          name: 'Chat 1',
          source: 'widget',
          status: 'active',
          created_at: '2026-01-01',
          contact_id: 'other-contact',
        },
        error: null,
      })

      const result = await getConversationTool.execute!({
        context: { sessionId: 's-1' },
        runtimeContext: makeRuntimeContext('proj-1', 'contact-1'),
      } as any)

      expect(result.found).toBe(false)
      expect(result.error).toBe('Conversation not found')
    })

    it('returns conversation when contact_id matches', async () => {
      // Mock: session belongs to the requesting contact
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 's-1',
          name: 'My Chat',
          source: 'widget',
          status: 'active',
          created_at: '2026-01-01',
          contact_id: 'contact-1',
        },
        error: null,
      })

      // Mock: messages
      mockOrder.mockResolvedValueOnce({
        data: [
          { sender_type: 'user', content: 'Help', created_at: '2026-01-01T00:00:00Z' },
        ],
        error: null,
      })

      const result = await getConversationTool.execute!({
        context: { sessionId: 's-1' },
        runtimeContext: makeRuntimeContext('proj-1', 'contact-1'),
      } as any)

      expect(result.found).toBe(true)
      expect(result.conversation?.id).toBe('s-1')
      expect(result.conversation?.messages).toHaveLength(1)
    })
  })
})
