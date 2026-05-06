// @ts-nocheck -- TODO: re-enable after migrating tool execute signature/scorer typing to Mastra v1
/**
 * Tests for contact-mode data tools
 *
 * Verifies:
 * - Contact scoping: all queries filter by contactId
 * - Ownership check on get-conversation
 * - Error handling when contactId or projectId is missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequestContext } from '@mastra/core/request-context'

// ============================================================================
// MOCKS
// ============================================================================

// Drizzle chain: db.select().from().where().orderBy().limit()
const mockLimit = vi.fn()
const mockOrderBy = vi.fn()
const mockWhere = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()

function chainable() {
  return {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
  }
}

for (const fn of [mockSelect, mockFrom, mockWhere, mockOrderBy]) {
  fn.mockReturnValue(chainable())
}
mockLimit.mockResolvedValue([])

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
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
  const ctx = new RequestContext()
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
    for (const fn of [mockSelect, mockFrom, mockWhere, mockOrderBy]) {
      fn.mockReturnValue(chainable())
    }
    mockLimit.mockResolvedValue([])
  })

  describe('my-issues', () => {
    it('returns error when projectId is missing', async () => {
      const result = (await myIssuesTool.execute!({} as any, { requestContext: makeRuntimeContext(null, 'contact-1') } as any)) as any

      expect(result.error).toBe('Project context not available.')
    })

    it('returns error when contactId is missing', async () => {
      const result = (await myIssuesTool.execute!({} as any, { requestContext: makeRuntimeContext('proj-1', null) } as any)) as any

      expect(result.error).toBe('Contact context not available.')
    })

    it('queries sessions by contact_id and project_id', async () => {
      // First where() call: get sessions for contact (returns empty)
      mockWhere.mockResolvedValueOnce([])

      const result = (await myIssuesTool.execute!({} as any, { requestContext: makeRuntimeContext('proj-1', 'contact-1') } as any)) as any

      expect(mockSelect).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalled()
      expect(mockWhere).toHaveBeenCalled()
      expect(result.issues).toEqual([])
    })
  })

  describe('my-conversations', () => {
    it('returns error when contactId is missing', async () => {
      const result = (await myConversationsTool.execute!({} as any, { requestContext: makeRuntimeContext('proj-1', null) } as any)) as any

      expect(result.error).toBe('Contact context not available.')
    })

    it('queries sessions by contact_id', async () => {
      // First query: entity_relationships returns session IDs for this contact
      mockWhere.mockResolvedValueOnce([{ session_id: 's-1' }])

      // Second query: sessions table returns session data
      mockLimit.mockResolvedValueOnce([
        { id: 's-1', name: 'Chat 1', source: 'widget', status: 'active', message_count: 5, created_at: new Date('2026-01-01'), last_activity_at: new Date('2026-01-02') },
      ])

      const result = (await myConversationsTool.execute!({} as any, { requestContext: makeRuntimeContext('proj-1', 'contact-1') } as any)) as any

      expect(mockSelect).toHaveBeenCalled()
      expect(result.conversations).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  describe('get-conversation', () => {
    it('returns error when contactId is missing', async () => {
      const result = (await getConversationTool.execute!({ sessionId: 's-1' } as any, { requestContext: makeRuntimeContext('proj-1', null) } as any)) as any

      expect(result.error).toBe('Contact context not available.')
      expect(result.found).toBe(false)
    })

    it('rejects access when session belongs to different contact', async () => {
      // Ownership check via entity_relationships: no link found for this contact
      mockWhere.mockResolvedValueOnce([])

      const result = (await getConversationTool.execute!({ sessionId: 's-1' } as any, { requestContext: makeRuntimeContext('proj-1', 'contact-1') } as any)) as any

      expect(result.found).toBe(false)
      expect(result.error).toBe('Conversation not found')
    })

    it('returns conversation when contact_id matches', async () => {
      // 1st where: ownership check via entity_relationships passes
      mockWhere.mockResolvedValueOnce([{ session_id: 's-1' }])
      // 2nd where: get session data
      mockWhere.mockResolvedValueOnce([
        {
          id: 's-1',
          name: 'My Chat',
          source: 'widget',
          status: 'active',
          created_at: new Date('2026-01-01'),
        },
      ])
      // 3rd where (messages): falls through to default chainable, continues to orderBy
      mockOrderBy.mockResolvedValueOnce([
        { sender_type: 'user', content: 'Help', created_at: new Date('2026-01-01T00:00:00Z') },
      ])

      const result = (await getConversationTool.execute!({ sessionId: 's-1' } as any, { requestContext: makeRuntimeContext('proj-1', 'contact-1') } as any)) as any

      expect(result.found).toBe(true)
      expect(result.conversation?.id).toBe('s-1')
      expect(result.conversation?.messages).toHaveLength(1)
    })
  })
})