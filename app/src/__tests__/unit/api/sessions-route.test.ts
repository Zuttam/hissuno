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

const mockListSessions = vi.fn()
const mockGetStats = vi.fn()
vi.mock('@/lib/db/queries/sessions', () => ({
  listSessions: (...args: unknown[]) => mockListSessions(...args),
  getProjectIntegrationStats: (...args: unknown[]) => mockGetStats(...args),
}))

const mockCreateSession = vi.fn()
vi.mock('@/lib/sessions/sessions-service', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}))

vi.mock('@/types/session', () => ({
  SESSION_TAGS: [
    'general_feedback',
    'wins',
    'losses',
    'bug',
    'feature_request',
    'change_request',
  ],
}))

// ---------------------------------------------------------------------------
// Import the route handlers and error classes after mocks are registered
// ---------------------------------------------------------------------------

const { GET, POST } = await import(
  '@/app/api/(project)/sessions/route'
)
const { UnauthorizedError } = await import('@/lib/auth/server')
const { ForbiddenError } = await import('@/lib/auth/authorization')
const { MissingProjectIdError } = await import('@/lib/auth/project-context')

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

  // Sensible defaults: database configured, user authenticated, access granted
  mockIsDatabaseConfigured.mockReturnValue(true)
  mockRequireRequestIdentity.mockResolvedValue(MOCK_IDENTITY)
  mockAssertProjectAccess.mockResolvedValue(undefined)
})

// ---- GET -----------------------------------------------------------------

describe('GET /api/sessions', () => {
  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createRequest(`http://localhost/api/sessions?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/sessions')
    const res = await GET(req)

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createRequest(`http://localhost/api/sessions?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no project access', async () => {
    mockAssertProjectAccess.mockRejectedValue(new ForbiddenError())

    const req = createRequest(`http://localhost/api/sessions?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it('returns integration stats when stats=true', async () => {
    const stats = { totalSessions: 42, integrations: { intercom: 10 } }
    mockGetStats.mockResolvedValue(stats)

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}&stats=true`,
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stats).toEqual(stats)
    expect(mockGetStats).toHaveBeenCalledWith(PROJECT_ID)
    expect(mockListSessions).not.toHaveBeenCalled()
  })

  it('returns sessions list with correct filters', async () => {
    const sessions = [{ id: 's1' }, { id: 's2' }]
    mockListSessions.mockResolvedValue({ sessions, total: 2 })

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessions).toEqual(sessions)
    expect(body.total).toBe(2)
    expect(mockListSessions).toHaveBeenCalled()

    // The filters object passed should contain the projectId
    const filters = mockListSessions.mock.calls[0][1]
    expect(filters.projectId).toBe(PROJECT_ID)
  })

  it('passes limit and offset from query params', async () => {
    mockListSessions.mockResolvedValue({ sessions: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}&limit=25&offset=50`,
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    const filters = mockListSessions.mock.calls[0][1]
    expect(filters.limit).toBe(25)
    expect(filters.offset).toBe(50)
  })
})

// ---- POST ----------------------------------------------------------------

describe('POST /api/sessions', () => {
  const validBody = {
    title: 'Customer call',
    tags: ['bug', 'feature_request'],
    messages: [
      { role: 'user', content: 'I found a bug' },
      { role: 'assistant', content: 'Thanks for reporting' },
    ],
  }

  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('creates session with valid input and returns 201', async () => {
    const createdSession = { id: 's-new', ...validBody }
    mockCreateSession.mockResolvedValue(createdSession)

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.session.id).toBe('s-new')
    expect(mockCreateSession).toHaveBeenCalled()
  })

  it('filters invalid tags from body', async () => {
    const bodyWithInvalidTags = {
      ...validBody,
      tags: ['bug', 'INVALID_TAG', 'feature_request', 'not_a_real_tag'],
    }
    mockCreateSession.mockResolvedValue({ id: 's-new' })

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify(bodyWithInvalidTags),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(201)
    const input = mockCreateSession.mock.calls[0][0]
    // Only valid tags should remain
    expect(input.tags).toEqual(
      expect.arrayContaining(['bug', 'feature_request']),
    )
    expect(input.tags).not.toContain('INVALID_TAG')
    expect(input.tags).not.toContain('not_a_real_tag')
  })

  it('returns 400 for invalid session_type', async () => {
    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify({ ...validBody, session_type: 'invalid_type' }),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid session_type')
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('passes valid session_type to createSession', async () => {
    mockCreateSession.mockResolvedValue({ id: 's-new' })

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify({ ...validBody, session_type: 'meeting' }),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(201)
    const input = mockCreateSession.mock.calls[0][0]
    expect(input.session_type).toBe('meeting')
  })

  it('passes name, description, contact_id, and linked_entities to createSession', async () => {
    mockCreateSession.mockResolvedValue({ id: 's-new' })

    const bodyWithNewFields = {
      ...validBody,
      name: 'My Feedback',
      description: 'Detailed description',
      session_type: 'chat',
      contact_id: 'contact-123',
      linked_entities: {
        companies: ['co-1', 'co-2'],
        issues: ['iss-1'],
      },
    }

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify(bodyWithNewFields),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(201)
    const input = mockCreateSession.mock.calls[0][0]
    expect(input.name).toBe('My Feedback')
    expect(input.description).toBe('Detailed description')
    expect(input.session_type).toBe('chat')
    expect(input.contact_id).toBe('contact-123')
    expect(input.linked_entities).toEqual({
      companies: ['co-1', 'co-2'],
      issues: ['iss-1'],
    })
  })

  it('omits optional new fields when not provided', async () => {
    mockCreateSession.mockResolvedValue({ id: 's-new' })

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    await POST(req)

    const input = mockCreateSession.mock.calls[0][0]
    expect(input.name).toBeUndefined()
    expect(input.description).toBeUndefined()
    expect(input.session_type).toBeUndefined()
    expect(input.contact_id).toBeUndefined()
    expect(input.linked_entities).toBeUndefined()
  })

  it('rejects messages with missing content', async () => {
    const body = {
      ...validBody,
      messages: [
        { role: 'user', content: 'Valid message' },
        { role: 'user' }, // missing content
      ],
    }

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/content/i)
  })

  it('rejects messages with invalid role', async () => {
    const body = {
      ...validBody,
      messages: [
        { role: 'invalid_role', content: 'Bad role' },
      ],
    }

    const req = createRequest(
      `http://localhost/api/sessions?projectId=${PROJECT_ID}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/role/i)
  })
})
