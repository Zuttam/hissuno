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

const mockListIssues = vi.fn()
vi.mock('@/lib/db/queries/issues', () => ({
  listIssues: (...args: unknown[]) => mockListIssues(...args),
}))

const mockCreateIssue = vi.fn()
vi.mock('@/lib/issues/issues-service', () => ({
  createIssue: (...args: unknown[]) => mockCreateIssue(...args),
}))

// ---------------------------------------------------------------------------
// Import the route handlers and error classes after mocks are registered
// ---------------------------------------------------------------------------

const { GET, POST } = await import(
  '@/app/api/(project)/issues/route'
)
const { UnauthorizedError } = await import('@/lib/auth/server')
const { ForbiddenError } = await import('@/lib/auth/authorization')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost'), options as never)
}

const MOCK_IDENTITY = { type: 'user', userId: 'user-1' }
const PROJECT_ID = 'proj-123'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDatabaseConfigured.mockReturnValue(true)
  mockRequireRequestIdentity.mockResolvedValue(MOCK_IDENTITY)
  mockAssertProjectAccess.mockResolvedValue(undefined)
})

// ---- GET -----------------------------------------------------------------

describe('GET /api/issues', () => {
  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createRequest(`http://localhost/api/issues?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/issues')
    const res = await GET(req)

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createRequest(`http://localhost/api/issues?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no project access', async () => {
    mockAssertProjectAccess.mockRejectedValue(new ForbiddenError())

    const req = createRequest(`http://localhost/api/issues?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it('returns issues list', async () => {
    const issues = [{ id: 'i1', title: 'Bug report' }]
    mockListIssues.mockResolvedValue({ issues, total: 1 })

    const req = createRequest(
      `http://localhost/api/issues?projectId=${PROJECT_ID}`,
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.issues).toEqual(issues)
    expect(body.total).toBe(1)

    const filters = mockListIssues.mock.calls[0][1]
    expect(filters.projectId).toBe(PROJECT_ID)
  })

  it('passes type, priority, status, and search filters', async () => {
    mockListIssues.mockResolvedValue({ issues: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/issues?projectId=${PROJECT_ID}&type=bug&priority=high&status=open&search=crash`,
    )
    await GET(req)

    const filters = mockListIssues.mock.calls[0][1]
    expect(filters.type).toBe('bug')
    expect(filters.priority).toBe('high')
    expect(filters.status).toBe('open')
    expect(filters.search).toBe('crash')
  })

  it('passes RICE metric level filters', async () => {
    mockListIssues.mockResolvedValue({ issues: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/issues?projectId=${PROJECT_ID}&reachLevel=high&impactLevel=medium&confidenceLevel=low&effortLevel=high`,
    )
    await GET(req)

    const filters = mockListIssues.mock.calls[0][1]
    expect(filters.reachLevel).toBe('high')
    expect(filters.impactLevel).toBe('medium')
    expect(filters.confidenceLevel).toBe('low')
    expect(filters.effortLevel).toBe('high')
  })

  it('passes productScopeIds as comma-separated list', async () => {
    mockListIssues.mockResolvedValue({ issues: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/issues?projectId=${PROJECT_ID}&productScopeIds=pa-1,pa-2,pa-3`,
    )
    await GET(req)

    const filters = mockListIssues.mock.calls[0][1]
    expect(filters.productScopeIds).toEqual(['pa-1', 'pa-2', 'pa-3'])
  })

  it('passes limit and offset from query params', async () => {
    mockListIssues.mockResolvedValue({ issues: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/issues?projectId=${PROJECT_ID}&limit=25&offset=50`,
    )
    await GET(req)

    const filters = mockListIssues.mock.calls[0][1]
    expect(filters.limit).toBe(25)
    expect(filters.offset).toBe(50)
  })

  it('passes showArchived filter', async () => {
    mockListIssues.mockResolvedValue({ issues: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/issues?projectId=${PROJECT_ID}&showArchived=true`,
    )
    await GET(req)

    const filters = mockListIssues.mock.calls[0][1]
    expect(filters.showArchived).toBe(true)
  })

  it('returns 500 on unexpected error', async () => {
    mockListIssues.mockRejectedValue(new Error('DB error'))

    const req = createRequest(`http://localhost/api/issues?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to load issues.')
  })
})

// ---- POST ----------------------------------------------------------------

describe('POST /api/issues', () => {
  const validBody = {
    type: 'bug',
    title: 'Login page crashes',
    description: 'The login page crashes when clicking submit.',
  }

  function createPostRequest(body: Record<string, unknown>, projectId = PROJECT_ID) {
    return createRequest(
      `http://localhost/api/issues?projectId=${projectId}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/issues', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no project access', async () => {
    mockAssertProjectAccess.mockRejectedValue(new ForbiddenError())

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(403)
  })

  it('returns 400 when type is missing', async () => {
    const req = createPostRequest({ title: 'Bug', description: 'Desc' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('type is required.')
  })

  it('returns 400 when title is missing', async () => {
    const req = createPostRequest({ type: 'bug', description: 'Desc' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('title is required.')
  })

  it('returns 400 when description is missing', async () => {
    const req = createPostRequest({ type: 'bug', title: 'Bug' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('description is required.')
  })

  it('creates issue with valid input and returns 201', async () => {
    const createdIssue = { id: 'i-new', ...validBody }
    mockCreateIssue.mockResolvedValue(createdIssue)

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.issue.id).toBe('i-new')
    expect(mockCreateIssue).toHaveBeenCalled()
  })

  it('passes project_id correctly to createIssue', async () => {
    mockCreateIssue.mockResolvedValue({ id: 'i-new' })

    const req = createPostRequest(validBody)
    await POST(req)

    const input = mockCreateIssue.mock.calls[0][0]
    expect(input.project_id).toBe(PROJECT_ID)
  })

  it('passes optional priority and product_scope_id', async () => {
    mockCreateIssue.mockResolvedValue({ id: 'i-new' })

    const req = createPostRequest({
      ...validBody,
      priority: 'high',
      product_scope_id: 'pa-1',
    })
    await POST(req)

    const input = mockCreateIssue.mock.calls[0][0]
    expect(input.priority).toBe('high')
    expect(input.product_scope_id).toBe('pa-1')
  })

  it('filters session_ids to only valid strings', async () => {
    mockCreateIssue.mockResolvedValue({ id: 'i-new' })

    const req = createPostRequest({
      ...validBody,
      session_ids: ['s-1', '', 42, null, 's-2', '  '],
    })
    await POST(req)

    const input = mockCreateIssue.mock.calls[0][0]
    // Only non-empty strings should remain
    expect(input.session_ids).toEqual(['s-1', 's-2'])
  })

  it('handles session_ids when not an array', async () => {
    mockCreateIssue.mockResolvedValue({ id: 'i-new' })

    const req = createPostRequest({
      ...validBody,
      session_ids: 'not-an-array',
    })
    await POST(req)

    const input = mockCreateIssue.mock.calls[0][0]
    expect(input.session_ids).toBeUndefined()
  })

  it('returns 500 on unexpected error', async () => {
    mockCreateIssue.mockRejectedValue(new Error('Service error'))

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to create issue.')
  })
})
