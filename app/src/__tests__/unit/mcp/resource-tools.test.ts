/**
 * MCP Resource Tools Tests
 *
 * Tests the 5 resource tools:
 * - list_resource_types: returns all types with schemas
 * - list_resources: routes to correct adapter with filters
 * - get_resource: returns markdown or error when not found
 * - search_resources: single-type and cross-type search
 * - add_resource: creates resource or rejects in contact mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpContext } from '@/mcp/context'

// ============================================================================
// MOCKS (vi.hoisted to avoid TDZ issues with vi.mock factory hoisting)
// ============================================================================

const {
  mockGetContext,
  mockKnowledgeAdapter,
  mockFeedbackAdapter,
  mockIssuesAdapter,
  mockCustomersAdapter,
} = vi.hoisted(() => ({
  mockGetContext: vi.fn<() => McpContext>(),
  mockKnowledgeAdapter: { list: vi.fn(), get: vi.fn(), search: vi.fn(), add: vi.fn() },
  mockFeedbackAdapter: { list: vi.fn(), get: vi.fn(), search: vi.fn(), add: vi.fn() },
  mockIssuesAdapter: { list: vi.fn(), get: vi.fn(), search: vi.fn(), add: vi.fn() },
  mockCustomersAdapter: { list: vi.fn(), get: vi.fn(), search: vi.fn(), add: vi.fn() },
}))

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(),
}))

vi.mock('@/mcp/context', () => ({
  getContext: () => mockGetContext(),
}))

vi.mock('@/mcp/resources/knowledge', () => ({
  knowledgeAdapter: mockKnowledgeAdapter,
}))

vi.mock('@/mcp/resources/feedback', () => ({
  feedbackAdapter: mockFeedbackAdapter,
}))

vi.mock('@/mcp/resources/issues', () => ({
  issuesAdapter: mockIssuesAdapter,
}))

vi.mock('@/mcp/resources/customers', () => ({
  customersAdapter: mockCustomersAdapter,
}))

// ============================================================================
// IMPORT & SETUP
// ============================================================================

import { registerResourceTools } from '@/mcp/resource-tools'

type ToolHandler = (params: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>
  isError?: boolean
}>

const capturedHandlers: Record<string, ToolHandler> = {}

function setupTools() {
  const fakeServer = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      capturedHandlers[name] = handler
    }),
  } as unknown as McpServer

  registerResourceTools(fakeServer)

  expect(fakeServer.registerTool).toHaveBeenCalledTimes(5)
  expect(capturedHandlers).toHaveProperty('list_resource_types')
  expect(capturedHandlers).toHaveProperty('list_resources')
  expect(capturedHandlers).toHaveProperty('get_resource')
  expect(capturedHandlers).toHaveProperty('search_resources')
  expect(capturedHandlers).toHaveProperty('add_resource')
}

function userContext(): McpContext {
  return {
    mode: 'user',
    projectId: 'proj-1',
    keyId: 'key-1',
    createdByUserId: 'user-1',
  }
}

function contactContext(): McpContext {
  return {
    mode: 'contact',
    projectId: 'proj-1',
    keyId: 'key-1',
    createdByUserId: 'user-1',
    contactId: 'contact-1',
    contactEmail: 'jane@example.com',
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('MCP Resource Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTools()
  })

  // --------------------------------------------------------------------------
  // list_resource_types
  // --------------------------------------------------------------------------

  describe('list_resource_types', () => {
    it('returns all 4 resource types', async () => {
      const result = await capturedHandlers.list_resource_types({})

      expect(result.isError).toBeUndefined()
      const text = result.content[0].text
      expect(text).toContain('knowledge')
      expect(text).toContain('feedback')
      expect(text).toContain('issues')
      expect(text).toContain('customers')
    })
  })

  // --------------------------------------------------------------------------
  // list_resources
  // --------------------------------------------------------------------------

  describe('list_resources', () => {
    it('calls correct adapter with projectId and filters', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockIssuesAdapter.list.mockResolvedValue({
        items: [{ id: 'i-1', name: 'Login bug', description: 'bug | high | open', metadata: { type: 'bug' } }],
        total: 1,
      })

      const result = await capturedHandlers.list_resources({
        type: 'issues',
        filters: { status: 'open' },
        limit: 10,
      })

      expect(mockIssuesAdapter.list).toHaveBeenCalledWith('proj-1', { status: 'open', limit: 10 })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('Login bug')
      expect(result.content[0].text).toContain('i-1')
    })

    it('returns error when adapter throws', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockKnowledgeAdapter.list.mockRejectedValue(new Error('DB down'))

      const result = await capturedHandlers.list_resources({ type: 'knowledge' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('DB down')
    })
  })

  // --------------------------------------------------------------------------
  // get_resource
  // --------------------------------------------------------------------------

  describe('get_resource', () => {
    it('returns markdown when resource is found', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockIssuesAdapter.get.mockResolvedValue({
        id: 'i-1',
        type: 'issues',
        markdown: '# Login Bug\n\nUsers cannot log in.',
      })

      const result = await capturedHandlers.get_resource({ type: 'issues', id: 'i-1' })

      expect(mockIssuesAdapter.get).toHaveBeenCalledWith('proj-1', 'i-1')
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('# Login Bug')
    })

    it('returns error when resource is not found', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockCustomersAdapter.get.mockResolvedValue(null)

      const result = await capturedHandlers.get_resource({ type: 'customers', id: 'nonexistent' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Not found')
    })
  })

  // --------------------------------------------------------------------------
  // search_resources
  // --------------------------------------------------------------------------

  describe('search_resources', () => {
    it('searches one adapter when type is specified', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockIssuesAdapter.search.mockResolvedValue([
        { id: 'i-1', type: 'issues', name: 'Checkout bug', snippet: 'Error in checkout', score: 0.85 },
      ])

      const result = await capturedHandlers.search_resources({
        query: 'checkout flow',
        type: 'issues',
        limit: 5,
      })

      expect(mockIssuesAdapter.search).toHaveBeenCalledWith('proj-1', 'checkout flow', 5)
      expect(mockKnowledgeAdapter.search).not.toHaveBeenCalled()
      expect(mockFeedbackAdapter.search).not.toHaveBeenCalled()
      expect(mockCustomersAdapter.search).not.toHaveBeenCalled()
      expect(result.content[0].text).toContain('Checkout bug')
      expect(result.content[0].text).toContain('85%')
    })

    it('searches all 4 adapters in parallel when no type specified', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockKnowledgeAdapter.search.mockResolvedValue([
        { id: 'k-1', type: 'knowledge', name: 'Auth docs', snippet: 'Setup auth', score: 0.9 },
      ])
      mockFeedbackAdapter.search.mockResolvedValue([
        { id: 'f-1', type: 'feedback', name: 'Auth complaint', snippet: 'Cannot login' },
      ])
      mockIssuesAdapter.search.mockResolvedValue([
        { id: 'i-1', type: 'issues', name: 'Auth bug', snippet: 'Login fails', score: 0.7 },
      ])
      mockCustomersAdapter.search.mockResolvedValue([])

      const result = await capturedHandlers.search_resources({ query: 'auth' })

      expect(mockKnowledgeAdapter.search).toHaveBeenCalled()
      expect(mockFeedbackAdapter.search).toHaveBeenCalled()
      expect(mockIssuesAdapter.search).toHaveBeenCalled()
      expect(mockCustomersAdapter.search).toHaveBeenCalled()

      const text = result.content[0].text
      expect(text).toContain('3 results')
      // Scored results should come first (knowledge 0.9, then issues 0.7, then feedback unscored)
      const knowledgeIdx = text.indexOf('Auth docs')
      const issuesIdx = text.indexOf('Auth bug')
      const feedbackIdx = text.indexOf('Auth complaint')
      expect(knowledgeIdx).toBeLessThan(issuesIdx)
      expect(issuesIdx).toBeLessThan(feedbackIdx)
    })

    it('handles partial failures gracefully', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockKnowledgeAdapter.search.mockRejectedValue(new Error('Embedding API down'))
      mockFeedbackAdapter.search.mockResolvedValue([
        { id: 'f-1', type: 'feedback', name: 'Some session', snippet: 'content' },
      ])
      mockIssuesAdapter.search.mockResolvedValue([])
      mockCustomersAdapter.search.mockResolvedValue([])

      const result = await capturedHandlers.search_resources({ query: 'test' })

      // Should succeed with results from working adapters
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('1 results')
      expect(result.content[0].text).toContain('Some session')
    })
  })

  // --------------------------------------------------------------------------
  // add_resource
  // --------------------------------------------------------------------------

  describe('add_resource', () => {
    it('creates resource in user mode', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockIssuesAdapter.add.mockResolvedValue({
        id: 'i-new',
        type: 'issues',
        name: 'New Bug',
      })

      const result = await capturedHandlers.add_resource({
        type: 'issues',
        data: { type: 'bug', title: 'New Bug', description: 'Something broke' },
      })

      expect(mockIssuesAdapter.add).toHaveBeenCalledWith('proj-1', {
        type: 'bug',
        title: 'New Bug',
        description: 'Something broke',
      })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('New Bug')
      expect(result.content[0].text).toContain('i-new')
    })

    it('rejects in contact mode without calling adapter', async () => {
      mockGetContext.mockReturnValue(contactContext())

      const result = await capturedHandlers.add_resource({
        type: 'issues',
        data: { type: 'bug', title: 'Test', description: 'desc' },
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not available in contact mode')
      expect(mockIssuesAdapter.add).not.toHaveBeenCalled()
    })

    it('surfaces validation error from adapter', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockIssuesAdapter.add.mockRejectedValue(new Error('Validation error: "title" is required.'))

      const result = await capturedHandlers.add_resource({
        type: 'issues',
        data: { type: 'bug' },
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Validation error')
      expect(result.content[0].text).toContain('"title" is required')
    })
  })
})
