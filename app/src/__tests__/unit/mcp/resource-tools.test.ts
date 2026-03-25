/**
 * MCP Resource Tools Tests
 *
 * Tests the 5 resource tools:
 * - list_resource_types: returns all types with schemas
 * - list_resources: calls correct query function with filters
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
  mockListSessionsInternal,
  mockListIssuesInternal,
  mockListContactsInternal,
  mockListCompaniesInternal,
  mockGetSessionContactInfo,
  mockBatchGetSessionContacts,
  mockSearchSessions,
  mockSearchIssues,
  mockSearchCustomers,
  mockSearchKnowledge,
  mockCreateSessionAdmin,
  mockCreateIssueAdmin,
  mockCreateContactAdmin,
  mockCreateCompanyAdmin,
  mockDb,
} = vi.hoisted(() => ({
  mockGetContext: vi.fn<() => McpContext>(),
  mockListSessionsInternal: vi.fn(),
  mockListIssuesInternal: vi.fn(),
  mockListContactsInternal: vi.fn(),
  mockListCompaniesInternal: vi.fn(),
  mockGetSessionContactInfo: vi.fn(),
  mockBatchGetSessionContacts: vi.fn(),
  mockSearchSessions: vi.fn(),
  mockSearchIssues: vi.fn(),
  mockSearchCustomers: vi.fn(),
  mockSearchKnowledge: vi.fn(),
  mockCreateSessionAdmin: vi.fn(),
  mockCreateIssueAdmin: vi.fn(),
  mockCreateContactAdmin: vi.fn(),
  mockCreateCompanyAdmin: vi.fn(),
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    query: {
      companies: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}))

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(),
}))

vi.mock('@/mcp/context', () => ({
  getContext: () => mockGetContext(),
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema/app', () => ({
  sessions: { id: 'sessions.id', name: 'sessions.name', project_id: 'sessions.project_id', source: 'sessions.source', status: 'sessions.status', message_count: 'sessions.message_count', tags: 'sessions.tags', created_at: 'sessions.created_at', last_activity_at: 'sessions.last_activity_at' },
  sessionMessages: { session_id: 'sessionMessages.session_id', sender_type: 'sessionMessages.sender_type', content: 'sessionMessages.content', created_at: 'sessionMessages.created_at' },
  issues: { id: 'issues.id', title: 'issues.title', description: 'issues.description', type: 'issues.type', priority: 'issues.priority', status: 'issues.status', upvote_count: 'issues.upvote_count', created_at: 'issues.created_at', updated_at: 'issues.updated_at', project_id: 'issues.project_id', is_archived: 'issues.is_archived' },
  contacts: { id: 'contacts.id', name: 'contacts.name', email: 'contacts.email', role: 'contacts.role', title: 'contacts.title', phone: 'contacts.phone', is_champion: 'contacts.is_champion', notes: 'contacts.notes', last_contacted_at: 'contacts.last_contacted_at', company_id: 'contacts.company_id', project_id: 'contacts.project_id', is_archived: 'contacts.is_archived' },
  companies: { id: 'companies.id', name: 'companies.name', domain: 'companies.domain', project_id: 'companies.project_id' },
  knowledgeSources: { id: 'knowledgeSources.id', name: 'knowledgeSources.name', type: 'knowledgeSources.type', description: 'knowledgeSources.description', analyzed_content: 'knowledgeSources.analyzed_content', analyzed_at: 'knowledgeSources.analyzed_at', status: 'knowledgeSources.status', project_id: 'knowledgeSources.project_id', created_at: 'knowledgeSources.created_at', enabled: 'knowledgeSources.enabled' },
  entityRelationships: { session_id: 'entityRelationships.session_id', contact_id: 'entityRelationships.contact_id', issue_id: 'entityRelationships.issue_id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  ilike: vi.fn(),
  or: vi.fn(),
  inArray: vi.fn(),
  isNotNull: vi.fn(),
  sql: vi.fn(),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  listSessions: (...args: unknown[]) => mockListSessionsInternal(...args),
}))

vi.mock('@/lib/db/queries/issues', () => ({
  listIssues: (...args: unknown[]) => mockListIssuesInternal(...args),
}))

vi.mock('@/lib/db/queries/contacts', () => ({
  listContacts: (...args: unknown[]) => mockListContactsInternal(...args),
}))

vi.mock('@/lib/db/queries/companies', () => ({
  listCompanies: (...args: unknown[]) => mockListCompaniesInternal(...args),
}))

vi.mock('@/lib/db/queries/entity-relationships', () => ({
  getSessionContactInfo: (...args: unknown[]) => mockGetSessionContactInfo(...args),
  batchGetSessionContacts: (...args: unknown[]) => mockBatchGetSessionContacts(...args),
}))

vi.mock('@/lib/sessions/sessions-service', () => ({
  searchSessions: (...args: unknown[]) => mockSearchSessions(...args),
  createSessionAdmin: (...args: unknown[]) => mockCreateSessionAdmin(...args),
}))

vi.mock('@/lib/issues/issues-service', () => ({
  searchIssues: (...args: unknown[]) => mockSearchIssues(...args),
  createIssueAdmin: (...args: unknown[]) => mockCreateIssueAdmin(...args),
}))

vi.mock('@/lib/customers/customers-service', () => ({
  searchCustomers: (...args: unknown[]) => mockSearchCustomers(...args),
  createContactAdmin: (...args: unknown[]) => mockCreateContactAdmin(...args),
  createCompanyAdmin: (...args: unknown[]) => mockCreateCompanyAdmin(...args),
}))

vi.mock('@/lib/knowledge/knowledge-service', () => ({
  searchKnowledge: (...args: unknown[]) => mockSearchKnowledge(...args),
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
    // Reset chainable db mock
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
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
    it('calls correct query function with projectId and filters', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockListIssuesInternal.mockResolvedValue({
        issues: [{
          id: 'i-1',
          title: 'Login bug',
          type: 'bug',
          priority: 'high',
          status: 'open',
          upvote_count: 0,
          updated_at: '2024-01-01',
        }],
        total: 1,
      })

      const result = await capturedHandlers.list_resources({
        type: 'issues',
        filters: { status: 'open' },
        limit: 10,
      })

      expect(mockListIssuesInternal).toHaveBeenCalledWith('proj-1', {
        type: undefined,
        priority: undefined,
        status: 'open',
        search: undefined,
        limit: 10,
      })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('Login bug')
      expect(result.content[0].text).toContain('i-1')
    })

    it('returns error when query function throws', async () => {
      mockGetContext.mockReturnValue(userContext())
      // For knowledge, the code calls db.select()...limit() directly
      mockDb.limit.mockRejectedValue(new Error('DB down'))

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
      // For get_resource issues, the code calls db.select()...where() then
      // db.select()...where() for session links, then batchGetSessionContacts
      const mockIssue = {
        id: 'i-1',
        title: 'Login Bug',
        description: 'Users cannot log in.',
        type: 'bug',
        priority: 'high',
        status: 'open',
        upvote_count: 3,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
      }
      // First db call returns the issue, second returns session links (empty)
      mockDb.where
        .mockResolvedValueOnce([mockIssue])    // issue query
        .mockResolvedValueOnce([])              // session links query
      mockBatchGetSessionContacts.mockResolvedValue(new Map())

      const result = await capturedHandlers.get_resource({ type: 'issues', id: 'i-1' })

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('# Login Bug')
    })

    it('returns error when resource is not found', async () => {
      mockGetContext.mockReturnValue(userContext())
      // For customers, first tries contacts (empty), then tries companies (null)
      mockDb.where.mockResolvedValueOnce([]) // contact query returns empty
      mockDb.query.companies.findFirst.mockResolvedValue(null) // company query returns null

      const result = await capturedHandlers.get_resource({ type: 'customers', id: 'nonexistent' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Not found')
    })
  })

  // --------------------------------------------------------------------------
  // search_resources
  // --------------------------------------------------------------------------

  describe('search_resources', () => {
    it('searches one type when type is specified', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockSearchIssues.mockResolvedValue([
        { id: 'i-1', name: 'Checkout bug', snippet: 'Error in checkout', score: 0.85 },
      ])

      const result = await capturedHandlers.search_resources({
        query: 'checkout flow',
        type: 'issues',
        limit: 5,
      })

      expect(mockSearchIssues).toHaveBeenCalledWith('proj-1', 'checkout flow', 5)
      expect(mockSearchKnowledge).not.toHaveBeenCalled()
      expect(mockSearchSessions).not.toHaveBeenCalled()
      expect(mockSearchCustomers).not.toHaveBeenCalled()
      expect(result.content[0].text).toContain('Checkout bug')
      expect(result.content[0].text).toContain('85%')
    })

    it('searches all 4 types in parallel when no type specified', async () => {
      mockGetContext.mockReturnValue(userContext())
      mockSearchKnowledge.mockResolvedValue([
        { id: 'k-1', name: 'Auth docs', snippet: 'Setup auth', score: 0.9 },
      ])
      mockSearchSessions.mockResolvedValue([
        { id: 'f-1', name: 'Auth complaint', snippet: 'Cannot login' },
      ])
      mockSearchIssues.mockResolvedValue([
        { id: 'i-1', name: 'Auth bug', snippet: 'Login fails', score: 0.7 },
      ])
      mockSearchCustomers.mockResolvedValue([])

      const result = await capturedHandlers.search_resources({ query: 'auth' })

      expect(mockSearchKnowledge).toHaveBeenCalled()
      expect(mockSearchSessions).toHaveBeenCalled()
      expect(mockSearchIssues).toHaveBeenCalled()
      expect(mockSearchCustomers).toHaveBeenCalled()

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
      mockSearchKnowledge.mockRejectedValue(new Error('Embedding API down'))
      mockSearchSessions.mockResolvedValue([
        { id: 'f-1', name: 'Some session', snippet: 'content' },
      ])
      mockSearchIssues.mockResolvedValue([])
      mockSearchCustomers.mockResolvedValue([])

      const result = await capturedHandlers.search_resources({ query: 'test' })

      // Should succeed with results from working services
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
      mockCreateIssueAdmin.mockResolvedValue({
        issue: { id: 'i-new', title: 'New Bug' },
      })

      const result = await capturedHandlers.add_resource({
        type: 'issues',
        data: { type: 'bug', title: 'New Bug', description: 'Something broke' },
      })

      expect(mockCreateIssueAdmin).toHaveBeenCalledWith({
        projectId: 'proj-1',
        type: 'bug',
        title: 'New Bug',
        description: 'Something broke',
        priority: undefined,
      })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('New Bug')
      expect(result.content[0].text).toContain('i-new')
    })

    it('rejects in contact mode without calling service', async () => {
      mockGetContext.mockReturnValue(contactContext())

      const result = await capturedHandlers.add_resource({
        type: 'issues',
        data: { type: 'bug', title: 'Test', description: 'desc' },
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not available in contact mode')
      expect(mockCreateIssueAdmin).not.toHaveBeenCalled()
    })

    it('surfaces validation error from inline validation', async () => {
      mockGetContext.mockReturnValue(userContext())

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
