/**
 * Tests for user-mode data tools
 *
 * Mocks createAdminClient to verify:
 * - Correct Supabase queries (table, filters, ordering)
 * - Project scoping via projectId from runtimeContext
 * - Error handling when projectId is missing
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
const mockOr = vi.fn()
const mockIlike = vi.fn()
const mockOverlaps = vi.fn()
const mockGte = vi.fn()
const mockLte = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

function chainable() {
  return {
    select: mockSelect,
    eq: mockEq,
    or: mockOr,
    ilike: mockIlike,
    overlaps: mockOverlaps,
    gte: mockGte,
    lte: mockLte,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    from: mockFrom,
  }
}

// Each mock returns the chainable object
for (const fn of [mockSelect, mockEq, mockOr, mockIlike, mockOverlaps, mockGte, mockLte, mockOrder, mockLimit, mockFrom]) {
  fn.mockReturnValue(chainable())
}
// single() returns query result
mockSingle.mockResolvedValue({ data: null, error: null })
// select with count returns data + count
mockLimit.mockResolvedValue({ data: [], count: 0, error: null })

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockFrom }),
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
    for (const fn of [mockSelect, mockEq, mockOr, mockIlike, mockOverlaps, mockGte, mockLte, mockOrder, mockLimit, mockFrom]) {
      fn.mockReturnValue(chainable())
    }
    mockSingle.mockResolvedValue({ data: null, error: null })
    mockLimit.mockResolvedValue({ data: [], count: 0, error: null })
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
      mockLimit.mockResolvedValue({
        data: [
          { id: 'i-1', title: 'Bug 1', type: 'bug', priority: 'high', status: 'open', upvote_count: 3, updated_at: '2026-01-01' },
        ],
        count: 1,
        error: null,
      })

      const result = await listIssuesTool.execute!({
        context: { limit: 20 },
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(mockFrom).toHaveBeenCalledWith('issues')
      expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-1')
      expect(mockEq).toHaveBeenCalledWith('is_archived', false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].id).toBe('i-1')
      expect(result.total).toBe(1)
    })

    it('applies type filter when provided', async () => {
      mockLimit.mockResolvedValue({ data: [], count: 0, error: null })

      await listIssuesTool.execute!({
        context: { type: 'bug' },
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(mockEq).toHaveBeenCalledWith('type', 'bug')
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
      mockSingle.mockResolvedValue({
        data: {
          id: 'i-1',
          title: 'Bug 1',
          description: 'Desc',
          type: 'bug',
          priority: 'high',
          status: 'open',
          upvote_count: 3,
          created_at: '2026-01-01',
          updated_at: '2026-01-02',
          issue_sessions: [],
        },
        error: null,
      })

      const result = await getIssueTool.execute!({
        context: { issueId: 'i-1' },
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(mockFrom).toHaveBeenCalledWith('issues')
      expect(mockEq).toHaveBeenCalledWith('id', 'i-1')
      expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-1')
      expect(result.found).toBe(true)
      expect(result.issue?.id).toBe('i-1')
    })
  })

  describe('list-feedback', () => {
    it('queries sessions table filtered by projectId', async () => {
      mockLimit.mockResolvedValue({ data: [], count: 0, error: null })

      await listFeedbackTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(mockFrom).toHaveBeenCalledWith('sessions')
      expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-1')
    })
  })

  describe('get-feedback', () => {
    it('returns session with messages', async () => {
      // First call: get session
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 's-1',
          name: 'Test session',
          source: 'widget',
          status: 'active',
          message_count: 2,
          tags: ['bug'],
          created_at: '2026-01-01',
          contact: null,
        },
        error: null,
      })

      // Second call: get messages (returns via order chain)
      mockOrder.mockResolvedValueOnce({
        data: [
          { sender_type: 'user', content: 'Hello', created_at: '2026-01-01T00:00:00Z' },
          { sender_type: 'ai', content: 'Hi there', created_at: '2026-01-01T00:00:01Z' },
        ],
        error: null,
      })

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
      mockLimit.mockResolvedValue({ data: [], count: 0, error: null })

      await listContactsTool.execute!({
        context: {},
        runtimeContext: makeRuntimeContext('proj-1'),
      } as any)

      expect(mockFrom).toHaveBeenCalledWith('contacts')
      expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-1')
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
