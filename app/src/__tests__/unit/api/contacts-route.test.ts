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

const mockListContacts = vi.fn()
vi.mock('@/lib/db/queries/contacts', () => ({
  listContacts: (...args: unknown[]) => mockListContacts(...args),
}))

const mockCreateContact = vi.fn()
vi.mock('@/lib/customers/customers-service', () => ({
  createContact: (...args: unknown[]) => mockCreateContact(...args),
}))

// ---------------------------------------------------------------------------
// Import the route handlers and error classes after mocks are registered
// ---------------------------------------------------------------------------

const { GET, POST } = await import(
  '@/app/api/(project)/contacts/route'
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

describe('GET /api/contacts', () => {
  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createRequest(`http://localhost/api/contacts?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/contacts')
    const res = await GET(req)

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createRequest(`http://localhost/api/contacts?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no project access', async () => {
    mockAssertProjectAccess.mockRejectedValue(new ForbiddenError())

    const req = createRequest(`http://localhost/api/contacts?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it('returns contacts list with correct filters', async () => {
    const contacts = [{ id: 'c1', name: 'Alice' }, { id: 'c2', name: 'Bob' }]
    mockListContacts.mockResolvedValue({ contacts, total: 2 })

    const req = createRequest(
      `http://localhost/api/contacts?projectId=${PROJECT_ID}`,
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contacts).toEqual(contacts)
    expect(body.total).toBe(2)
    expect(mockListContacts).toHaveBeenCalled()

    const filters = mockListContacts.mock.calls[0][1]
    expect(filters.projectId).toBe(PROJECT_ID)
  })

  it('passes companyId, search, and isChampion filters', async () => {
    mockListContacts.mockResolvedValue({ contacts: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/contacts?projectId=${PROJECT_ID}&companyId=comp-1&search=alice&isChampion=true`,
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    const filters = mockListContacts.mock.calls[0][1]
    expect(filters.companyId).toBe('comp-1')
    expect(filters.search).toBe('alice')
    expect(filters.isChampion).toBe(true)
  })

  it('passes limit and offset from query params', async () => {
    mockListContacts.mockResolvedValue({ contacts: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/contacts?projectId=${PROJECT_ID}&limit=10&offset=20`,
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    const filters = mockListContacts.mock.calls[0][1]
    expect(filters.limit).toBe(10)
    expect(filters.offset).toBe(20)
  })

  it('passes showArchived filter', async () => {
    mockListContacts.mockResolvedValue({ contacts: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/contacts?projectId=${PROJECT_ID}&showArchived=true`,
    )
    await GET(req)

    const filters = mockListContacts.mock.calls[0][1]
    expect(filters.showArchived).toBe(true)
  })

  it('returns 500 on unexpected error', async () => {
    mockListContacts.mockRejectedValue(new Error('DB connection failed'))

    const req = createRequest(`http://localhost/api/contacts?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to load contacts.')
  })
})

// ---- POST ----------------------------------------------------------------

describe('POST /api/contacts', () => {
  const validBody = {
    name: 'Alice Smith',
    email: 'alice@example.com',
  }

  function createPostRequest(body: Record<string, unknown>, projectId = PROJECT_ID) {
    return createRequest(
      `http://localhost/api/contacts?projectId=${projectId}`,
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
    const req = createRequest('http://localhost/api/contacts', {
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

  it('returns 400 when name is missing', async () => {
    const req = createPostRequest({ email: 'alice@example.com' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('name is required.')
  })

  it('returns 400 when email is missing', async () => {
    const req = createPostRequest({ name: 'Alice' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('email is required.')
  })

  it('creates contact with valid input and returns 201', async () => {
    const createdContact = { id: 'c-new', ...validBody }
    mockCreateContact.mockResolvedValue(createdContact)

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.contact.id).toBe('c-new')
    expect(mockCreateContact).toHaveBeenCalled()
  })

  it('passes optional fields through to createContact', async () => {
    const fullBody = {
      ...validBody,
      company_id: 'comp-1',
      role: 'Engineering',
      title: 'CTO',
      phone: '+1234567890',
      company_url: 'https://example.com',
      is_champion: true,
      last_contacted_at: '2024-01-01T00:00:00Z',
      notes: 'Key decision maker',
      custom_fields: { segment: 'enterprise' },
    }
    mockCreateContact.mockResolvedValue({ id: 'c-new' })

    const req = createPostRequest(fullBody)
    await POST(req)

    const input = mockCreateContact.mock.calls[0][0]
    expect(input.projectId).toBe(PROJECT_ID)
    expect(input.companyId).toBe('comp-1')
    expect(input.role).toBe('Engineering')
    expect(input.title).toBe('CTO')
    expect(input.phone).toBe('+1234567890')
    expect(input.companyUrl).toBe('https://example.com')
    expect(input.isChampion).toBe(true)
    expect(input.notes).toBe('Key decision maker')
    expect(input.customFields).toEqual({ segment: 'enterprise' })
  })

  it('defaults optional fields to null or empty', async () => {
    mockCreateContact.mockResolvedValue({ id: 'c-new' })

    const req = createPostRequest(validBody)
    await POST(req)

    const input = mockCreateContact.mock.calls[0][0]
    expect(input.companyId).toBeNull()
    expect(input.role).toBeNull()
    expect(input.title).toBeNull()
    expect(input.phone).toBeNull()
    expect(input.companyUrl).toBeNull()
    expect(input.isChampion).toBe(false)
    expect(input.lastContactedAt).toBeNull()
    expect(input.notes).toBeNull()
    expect(input.customFields).toEqual({})
  })

  it('returns 500 on unexpected error', async () => {
    mockCreateContact.mockRejectedValue(new Error('DB write failed'))

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to create contact.')
  })
})
