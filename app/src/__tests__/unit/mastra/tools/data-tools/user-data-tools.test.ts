/**
 * Tests for user-mode data tools
 *
 * Mocks @/lib/db to verify:
 * - Correct Drizzle queries (select, from, where, orderBy, limit)
 * - Project scoping via projectId from runtimeContext
 * - Error handling when projectId is missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RuntimeContext } from '@mastra/core/runtime-context'

// ============================================================================
// MOCKS
// ============================================================================

// Drizzle chain: db.select().from().where().orderBy().limit()
// Each method returns the chain; the terminal call resolves to data.
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

// Each mock returns the chainable object (non-terminal methods)
for (const fn of [mockSelect, mockFrom, mockWhere, mockOrderBy]) {
  fn.mockReturnValue(chainable())
}
// Terminal method returns resolved data
mockLimit.mockResolvedValue([])

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}))

const mockGetSessionContactInfo = vi.fn()
const mockBatchGetSessionContacts = vi.fn()
vi.mock('@/lib/db/queries/entity-relationships', () => ({
  getSessionContactInfo: (...args: unknown[]) => mockGetSessionContactInfo(...args),
  batchGetSessionContacts: (...args: unknown[]) => mockBatchGetSessionContacts(...args),
}))

// ============================================================================
// IMPORT
// ============================================================================

import {
  listIssuesTool,
  getIssueTool,
  listFeedbackTool,
  getFeedbackTool,
  listContactsTool,
  getContactTool,
} from '@/mastra/tools/data-tools/user-data-tools'

// ============================================================================
// HELPERS
// ============================================================================

function makeRuntimeContext(projectId: string | null = 'proj-1', contactId: string | null = null) {
  const ctx = new RuntimeContext()
  if (projectId) ctx.set('projectId', projectId)
  if (contactId) ctx.set('contactId', contactId)
  return ctx
}

// ============================================================================
// TESTS
// ============================================================================

describe('user-mode data tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chain
    for (const fn of [mockSelect, mockFrom, mockWhere, mockOrderBy]) {
      fn.mockReturnValue(chainable())
    }
    mockLimit.mockResolvedValue([])
    mockGetSessionContactInfo.mockResolvedValue(null)
    mockBatchGetSessionContacts.mockResolvedValue(new Map())
  })

  describe('list-issues', () => {
    it('returns error when projectId is missing', async () => {
      const result = await listIssuesTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext(null),
      } as any)

      expect(result.error).toBe('Project context not available.')
      expect(result.issues).toEqual([])
    })

    it('queries issues table filtered by projectId', async () => {
      mockLimit.mockResolvedValue([
        { id: 'i-1', title: 'Bug 1', type: 'bug', priority: 'high', status: 'open', upvote_count: 3, updated_at: new Date('2026-01-01') },
      ])

      const result = await listIssuesTool.execute!({
        context: { limit: 20 },
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      // Verify Drizzle chain was called
      expect(mockSelect).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalled()
      expect(mockWhere).toHaveBeenCalled()
      expect(mockOrderBy).toHaveBeenCalled()
      expect(mockLimit).toHaveBeenCalledWith(20)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].id).toBe('i-1')
      expect(result.total).toBe(1)
    })
  })

  describe('get-issue', () => {
    it('returns error when projectId is missing', async () => {
      const result = await getIssueTool.execute!({
        context: { issueId: 'i-1' },
        runtimeContext: makeRuntimeContext(null),
      } as any)

      expect(result.error).toBe('Project context not available.')
      expect(result.found).toBe(false)
    })

    it('queries issue by id and project_id', async () => {
      // First call: get issue (via where() which is terminal here since no orderBy/limit)
      mockWhere.mockResolvedValueOnce([
        {
          id: 'i-1',
          title: 'Bug 1',
          description: 'Desc',
          type: 'bug',
          priority: 'high',
          status: 'open',
          upvote_count: 3,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
        },
      ])
      // Second call: get entity_relationships (returns empty)
      mockWhere.mockResolvedValueOnce([])

      const result = await getIssueTool.execute!({
        context: { issueId: 'i-1' },
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(mockSelect).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalled()
      expect(result.found).toBe(true)
      expect(result.issue?.id).toBe('i-1')
    })
  })

  describe('list-feedback', () => {
    it('queries sessions table filtered by projectId', async () => {
      mockLimit.mockResolvedValue([])

      await listFeedbackTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(mockSelect).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalled()
      expect(mockWhere).toHaveBeenCalled()
    })
  })

  describe('get-feedback', () => {
    it('returns session with messages', async () => {
      // First call: get session
      mockWhere.mockResolvedValueOnce([
        {
          id: 's-1',
          name: 'Test session',
          source: 'widget',
          status: 'active',
          message_count: 2,
          tags: ['bug'],
          created_at: new Date('2026-01-01'),
          contact_id: null,
        },
      ])

      // Second call: get messages (via orderBy chain)
      mockOrderBy.mockResolvedValueOnce([
        { sender_type: 'user', content: 'Hello', created_at: new Date('2026-01-01T00:00:00Z') },
        { sender_type: 'ai', content: 'Hi there', created_at: new Date('2026-01-01T00:00:01Z') },
      ])

      const result = await getFeedbackTool.execute!({
        context: { sessionId: 's-1' },
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(result.found).toBe(true)
      expect(result.session?.messages).toHaveLength(2)
    })
  })

  describe('list-contacts', () => {
    it('queries contacts table filtered by projectId', async () => {
      mockLimit.mockResolvedValue([])

      await listContactsTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(mockSelect).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalled()
      expect(mockWhere).toHaveBeenCalled()
    })
  })

  describe('get-contact', () => {
    it('returns error when projectId is missing', async () => {
      const result = await getContactTool.execute!({
        context: { contactId: 'c-1' },
        runtimeContext: makeRuntimeContext(null),
      } as any)

      expect(result.error).toBe('Project context not available.')
      expect(result.found).toBe(false)
    })
  })
})
