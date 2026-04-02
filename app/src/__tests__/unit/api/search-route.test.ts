import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockIsDatabaseConfigured = vi.fn()
vi.mock('@/lib/db/config', () => ({
  isDatabaseConfigured: () => mockIsDatabaseConfigured(),
}))

const mockRequireRequestIdentity = vi.fn()
vi.mock('@/lib/auth/identity', () => ({
  requireRequestIdentity: () => mockRequireRequestIdentity(),
}))

const mockAssertProjectAccess = vi.fn()
vi.mock('@/lib/auth/authorization', () => ({
  assertProjectAccess: (...args: unknown[]) => mockAssertProjectAccess(...args),
  ForbiddenError: class ForbiddenError extends Error {
    status = 403
    constructor(msg = 'Forbidden') {
      super(msg)
      this.name = 'ForbiddenError'
    }
  },
}))

vi.mock('@/lib/auth/server', () => ({
  UnauthorizedError: class UnauthorizedError extends Error {
    status = 401
    constructor(msg = 'Unauthorized') {
      super(msg)
      this.name = 'UnauthorizedError'
    }
  },
}))

class MockMissingProjectIdError extends Error {
  status = 400
  constructor() {
    super('projectId query parameter is required.')
    this.name = 'MissingProjectIdError'
  }
}

vi.mock('@/lib/auth/project-context', () => ({
  requireProjectId: (req: NextRequest) => {
    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      throw new MockMissingProjectIdError()
    }
    return projectId
  },
  MissingProjectIdError: MockMissingProjectIdError,
}))

const mockSearchSessions = vi.fn()
const mockSearchIssues = vi.fn()
const mockSearchCustomers = vi.fn()
const mockSearchKnowledge = vi.fn()
const mockSearchScopes = vi.fn()

vi.mock('@/lib/sessions/sessions-service', () => ({
  searchSessions: (...args: unknown[]) => mockSearchSessions(...args),
}))

vi.mock('@/lib/issues/issues-service', () => ({
  searchIssues: (...args: unknown[]) => mockSearchIssues(...args),
}))

vi.mock('@/lib/customers/customers-service', () => ({
  searchCustomers: (...args: unknown[]) => mockSearchCustomers(...args),
}))

vi.mock('@/lib/knowledge/knowledge-service', () => ({
  searchKnowledge: (...args: unknown[]) => mockSearchKnowledge(...args),
}))

vi.mock('@/lib/product-scopes/product-scopes-service', () => ({
  searchScopes: (...args: unknown[]) => mockSearchScopes(...args),
}))

// ---------------------------------------------------------------------------
// Import the route handler after mocks
// ---------------------------------------------------------------------------

const { GET } = await import('@/app/api/(project)/search/route')
const { UnauthorizedError } = await import('@/lib/auth/server')
const { ForbiddenError } = await import('@/lib/auth/authorization')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/search')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

function setupAuth() {
  mockIsDatabaseConfigured.mockReturnValue(true)
  mockRequireRequestIdentity.mockResolvedValue({ type: 'user', userId: 'u-1' })
  mockAssertProjectAccess.mockResolvedValue(undefined)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // Auth & validation
  // -----------------------------------------------------------------------

  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)
    const res = await GET(makeRequest({ projectId: 'p-1', q: 'test' }))
    expect(res.status).toBe(500)
  })

  it('returns 400 when projectId is missing', async () => {
    mockIsDatabaseConfigured.mockReturnValue(true)
    const res = await GET(makeRequest({ q: 'test' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockIsDatabaseConfigured.mockReturnValue(true)
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())
    const res = await GET(makeRequest({ projectId: 'p-1', q: 'test' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user lacks project access', async () => {
    mockIsDatabaseConfigured.mockReturnValue(true)
    mockRequireRequestIdentity.mockResolvedValue({ type: 'user', userId: 'u-1' })
    mockAssertProjectAccess.mockRejectedValue(new ForbiddenError())
    const res = await GET(makeRequest({ projectId: 'p-1', q: 'test' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when q parameter is missing', async () => {
    setupAuth()
    const res = await GET(makeRequest({ projectId: 'p-1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('q')
  })

  it('returns 400 for invalid type parameter', async () => {
    setupAuth()
    const res = await GET(makeRequest({ projectId: 'p-1', q: 'test', type: 'invalid' }))
    expect(res.status).toBe(400)
  })

  // -----------------------------------------------------------------------
  // Single-type search
  // -----------------------------------------------------------------------

  it('searches a single type when type is specified', async () => {
    setupAuth()
    mockSearchIssues.mockResolvedValue([
      { id: 'i-1', name: 'Login bug', snippet: 'Cannot login', score: 0.9 },
    ])

    const res = await GET(makeRequest({ projectId: 'p-1', q: 'login', type: 'issues' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].id).toBe('i-1')
    expect(body.total).toBe(1)

    const defaultOpts = { mode: undefined, threshold: undefined }
    expect(mockSearchIssues).toHaveBeenCalledWith('p-1', 'login', 10, defaultOpts)
    expect(mockSearchKnowledge).not.toHaveBeenCalled()
    expect(mockSearchSessions).not.toHaveBeenCalled()
    expect(mockSearchCustomers).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // Cross-type search
  // -----------------------------------------------------------------------

  it('searches all types when no type specified', async () => {
    setupAuth()
    mockSearchKnowledge.mockResolvedValue([
      { id: 'k-1', name: 'Auth docs', snippet: 'Login flow', score: 0.8 },
    ])
    mockSearchSessions.mockResolvedValue([])
    mockSearchIssues.mockResolvedValue([
      { id: 'i-1', name: 'Login bug', snippet: 'Cannot login', score: 0.95 },
    ])
    mockSearchCustomers.mockResolvedValue([])
    mockSearchScopes.mockResolvedValue([])

    const res = await GET(makeRequest({ projectId: 'p-1', q: 'login' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(2)
    // Sorted by score descending
    expect(body.results[0].id).toBe('i-1')
    expect(body.results[1].id).toBe('k-1')
    expect(body.total).toBe(2)

    // All service functions were called
    const defaultOpts = { mode: undefined, threshold: undefined }
    expect(mockSearchKnowledge).toHaveBeenCalledWith('p-1', 'login', 10, defaultOpts)
    expect(mockSearchSessions).toHaveBeenCalledWith('p-1', 'login', 10, defaultOpts)
    expect(mockSearchIssues).toHaveBeenCalledWith('p-1', 'login', 10, defaultOpts)
    expect(mockSearchCustomers).toHaveBeenCalledWith('p-1', 'login', 10, defaultOpts)
    expect(mockSearchScopes).toHaveBeenCalledWith('p-1', 'login', 10, defaultOpts)
  })

  it('respects limit parameter', async () => {
    setupAuth()
    mockSearchIssues.mockResolvedValue([])

    await GET(makeRequest({ projectId: 'p-1', q: 'test', type: 'issues', limit: '5' }))
    expect(mockSearchIssues).toHaveBeenCalledWith('p-1', 'test', 5, { mode: undefined, threshold: undefined })
  })

  it('caps limit at 20', async () => {
    setupAuth()
    mockSearchIssues.mockResolvedValue([])

    await GET(makeRequest({ projectId: 'p-1', q: 'test', type: 'issues', limit: '100' }))
    expect(mockSearchIssues).toHaveBeenCalledWith('p-1', 'test', 20, { mode: undefined, threshold: undefined })
  })

  it('handles service failures gracefully in cross-type search', async () => {
    setupAuth()
    mockSearchKnowledge.mockRejectedValue(new Error('DB error'))
    mockSearchSessions.mockResolvedValue([
      { id: 'f-1', name: 'Chat', snippet: 'User said login', score: 0.7 },
    ])
    mockSearchIssues.mockResolvedValue([])
    mockSearchCustomers.mockResolvedValue([])
    mockSearchScopes.mockResolvedValue([])

    const res = await GET(makeRequest({ projectId: 'p-1', q: 'login' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    // Knowledge failed but others succeeded
    expect(body.results).toHaveLength(1)
    expect(body.results[0].id).toBe('f-1')
  })

  it('searches scopes when type is specified', async () => {
    setupAuth()
    mockSearchScopes.mockResolvedValue([
      { id: 's-1', name: 'Payments', snippet: 'Payment processing', score: 0.85 },
    ])

    const res = await GET(makeRequest({ projectId: 'p-1', q: 'payments', type: 'scopes' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].type).toBe('scopes')
    expect(body.results[0].name).toBe('Payments')
    expect(mockSearchScopes).toHaveBeenCalledWith('p-1', 'payments', 10, { mode: undefined, threshold: undefined })
  })

  // -----------------------------------------------------------------------
  // Mode parameter
  // -----------------------------------------------------------------------

  it('returns 400 for invalid mode parameter', async () => {
    setupAuth()
    const res = await GET(makeRequest({ projectId: 'p-1', q: 'test', mode: 'invalid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('mode')
  })

  it('passes mode parameter to service functions', async () => {
    setupAuth()
    mockSearchIssues.mockResolvedValue([
      { id: 'i-1', name: 'Bug', snippet: 'desc', score: 0.9 },
    ])

    const res = await GET(makeRequest({ projectId: 'p-1', q: 'test', type: 'issues', mode: 'keyword' }))
    expect(res.status).toBe(200)
    expect(mockSearchIssues).toHaveBeenCalledWith('p-1', 'test', 10, { mode: 'keyword', threshold: undefined })
  })

  it('passes both mode to all services in cross-type search', async () => {
    setupAuth()
    mockSearchKnowledge.mockResolvedValue([])
    mockSearchSessions.mockResolvedValue([])
    mockSearchIssues.mockResolvedValue([])
    mockSearchCustomers.mockResolvedValue([])
    mockSearchScopes.mockResolvedValue([])

    await GET(makeRequest({ projectId: 'p-1', q: 'test', mode: 'both' }))

    const opts = { mode: 'both', threshold: undefined }
    expect(mockSearchKnowledge).toHaveBeenCalledWith('p-1', 'test', 10, opts)
    expect(mockSearchSessions).toHaveBeenCalledWith('p-1', 'test', 10, opts)
    expect(mockSearchIssues).toHaveBeenCalledWith('p-1', 'test', 10, opts)
    expect(mockSearchCustomers).toHaveBeenCalledWith('p-1', 'test', 10, opts)
    expect(mockSearchScopes).toHaveBeenCalledWith('p-1', 'test', 10, opts)
  })

  // -----------------------------------------------------------------------
  // Threshold parameter
  // -----------------------------------------------------------------------

  it('returns 400 for invalid threshold parameter', async () => {
    setupAuth()
    const res = await GET(makeRequest({ projectId: 'p-1', q: 'test', threshold: '1.5' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('threshold')
  })

  it('returns 400 for non-numeric threshold', async () => {
    setupAuth()
    const res = await GET(makeRequest({ projectId: 'p-1', q: 'test', threshold: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('passes threshold parameter to service functions', async () => {
    setupAuth()
    mockSearchIssues.mockResolvedValue([])

    await GET(makeRequest({ projectId: 'p-1', q: 'test', type: 'issues', threshold: '0.3' }))
    expect(mockSearchIssues).toHaveBeenCalledWith('p-1', 'test', 10, { mode: undefined, threshold: 0.3 })
  })

  it('passes both mode and threshold together', async () => {
    setupAuth()
    mockSearchIssues.mockResolvedValue([])

    await GET(makeRequest({ projectId: 'p-1', q: 'test', type: 'issues', mode: 'semantic', threshold: '0.7' }))
    expect(mockSearchIssues).toHaveBeenCalledWith('p-1', 'test', 10, { mode: 'semantic', threshold: 0.7 })
  })
})
