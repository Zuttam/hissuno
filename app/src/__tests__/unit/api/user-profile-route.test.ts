import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockIsDatabaseConfigured = vi.fn()
vi.mock('@/lib/db/config', () => ({
  isDatabaseConfigured: () => mockIsDatabaseConfigured(),
}))

const mockRequireUserIdentity = vi.fn()
vi.mock('@/lib/auth/identity', () => ({
  requireUserIdentity: () => mockRequireUserIdentity(),
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

vi.mock('@/lib/auth/authorization', () => ({
  ForbiddenError: class ForbiddenError extends Error {
    status = 403
    constructor(msg = 'Forbidden') {
      super(msg)
      this.name = 'ForbiddenError'
    }
  },
}))

// Mock drizzle db - we need to intercept the query chain
const mockReturning = vi.fn()
const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }))
const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }))
const mockInsert = vi.fn((..._args: any[]) => ({ values: mockValues }))

const mockLimit = vi.fn()
const mockWhere = vi.fn(() => ({ limit: mockLimit }))
const mockSelectFrom = vi.fn(() => ({ where: mockWhere }))
const mockSelect = vi.fn((..._args: any[]) => ({ from: mockSelectFrom }))

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
  },
}))

vi.mock('@/lib/db/schema/app', () => ({
  userProfiles: {
    user_id: 'user_id',
    $inferInsert: {},
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}))

// ---------------------------------------------------------------------------
// Import the route handlers and error classes after mocks are registered
// ---------------------------------------------------------------------------

const { GET, POST } = await import(
  '@/app/api/(account)/user/profile/route'
)
const { UnauthorizedError } = await import('@/lib/auth/server')
const { ForbiddenError } = await import('@/lib/auth/authorization')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER_IDENTITY = { type: 'user', userId: 'user-1', email: 'test@example.com', name: 'Test User' }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDatabaseConfigured.mockReturnValue(true)
  mockRequireUserIdentity.mockResolvedValue(MOCK_USER_IDENTITY)
})

// ---- GET -----------------------------------------------------------------

describe('GET /api/user/profile', () => {
  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const res = await GET()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireUserIdentity.mockRejectedValue(new UnauthorizedError())

    const res = await GET()

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized.')
  })

  it('returns 403 when called with API key identity', async () => {
    mockRequireUserIdentity.mockRejectedValue(
      new ForbiddenError('This endpoint requires user authentication.'),
    )

    const res = await GET()

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('This endpoint requires user authentication.')
  })

  it('returns profile when found', async () => {
    const profile = {
      user_id: 'user-1',
      full_name: 'Test User',
      company_name: 'TestCo',
    }
    mockLimit.mockResolvedValue([profile])

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile).toEqual(profile)
  })

  it('returns null profile when none exists', async () => {
    mockLimit.mockResolvedValue([])

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile).toBeNull()
  })

  it('returns 500 on unexpected error', async () => {
    mockLimit.mockRejectedValue(new Error('DB error'))

    const res = await GET()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to load profile.')
  })
})

// ---- POST ----------------------------------------------------------------

describe('POST /api/user/profile', () => {
  function createPostRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/user/profile', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createPostRequest({ fullName: 'Test' })
    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireUserIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createPostRequest({ fullName: 'Test' })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 when called with API key identity', async () => {
    mockRequireUserIdentity.mockRejectedValue(
      new ForbiddenError('This endpoint requires user authentication.'),
    )

    const req = createPostRequest({ fullName: 'Test' })
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('This endpoint requires user authentication.')
  })

  it('upserts profile and returns result', async () => {
    const savedProfile = {
      user_id: 'user-1',
      full_name: 'Updated Name',
      company_name: null,
    }
    // The GET query for existing profile
    mockLimit.mockResolvedValue([])
    // The upsert returning
    mockReturning.mockResolvedValue([savedProfile])

    const req = createPostRequest({ fullName: 'Updated Name' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile).toEqual(savedProfile)
  })

  it('returns 500 on unexpected error', async () => {
    mockReturning.mockRejectedValue(new Error('DB error'))

    const req = createPostRequest({ fullName: 'Test' })
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to save profile.')
  })
})
