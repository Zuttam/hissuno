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

const mockListApiKeys = vi.fn()
const mockCreateApiKey = vi.fn()
const mockRevokeAllApiKeys = vi.fn()
vi.mock('@/lib/auth/api-keys', () => ({
  listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  createApiKey: (...args: unknown[]) => mockCreateApiKey(...args),
  revokeAllApiKeys: (...args: unknown[]) => mockRevokeAllApiKeys(...args),
}))

// ---------------------------------------------------------------------------
// Import the route handlers and error classes after mocks are registered
// ---------------------------------------------------------------------------

const { GET, POST, DELETE } = await import(
  '@/app/api/(project)/access/api-keys/route'
)
const { UnauthorizedError } = await import('@/lib/auth/server')
const { ForbiddenError } = await import('@/lib/auth/authorization')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost'), options as never)
}

const MOCK_USER_IDENTITY = { type: 'user', userId: 'user-1' }
const MOCK_API_KEY_IDENTITY = {
  type: 'api_key',
  projectId: 'proj-123',
  keyId: 'key-1',
  createdByUserId: 'user-1',
}
const PROJECT_ID = 'proj-123'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDatabaseConfigured.mockReturnValue(true)
  mockRequireRequestIdentity.mockResolvedValue(MOCK_USER_IDENTITY)
  mockAssertProjectAccess.mockResolvedValue(undefined)
})

// ---- GET -----------------------------------------------------------------

describe('GET /api/access/api-keys', () => {
  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createRequest(`http://localhost/api/access/api-keys?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/access/api-keys')
    const res = await GET(req)

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createRequest(`http://localhost/api/access/api-keys?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no project access', async () => {
    mockAssertProjectAccess.mockRejectedValue(new ForbiddenError())

    const req = createRequest(`http://localhost/api/access/api-keys?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it('returns api keys list', async () => {
    const apiKeys = [
      { id: 'key-1', prefix: 'hiss_abc', name: 'Test Key' },
    ]
    mockListApiKeys.mockResolvedValue(apiKeys)

    const req = createRequest(`http://localhost/api/access/api-keys?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.apiKeys).toEqual(apiKeys)
    expect(mockListApiKeys).toHaveBeenCalledWith(PROJECT_ID)
  })

  it('returns 500 on unexpected error', async () => {
    mockListApiKeys.mockRejectedValue(new Error('DB error'))

    const req = createRequest(`http://localhost/api/access/api-keys?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to list API keys.')
  })
})

// ---- POST ----------------------------------------------------------------

describe('POST /api/access/api-keys', () => {
  const validBody = { name: 'My API Key' }

  function createPostRequest(body: Record<string, unknown>, projectId = PROJECT_ID) {
    return createRequest(
      `http://localhost/api/access/api-keys?projectId=${projectId}`,
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
    const req = createRequest('http://localhost/api/access/api-keys', {
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

  it('returns 403 when user lacks owner role', async () => {
    mockAssertProjectAccess.mockRejectedValue(
      new ForbiddenError("Requires 'owner' role."),
    )

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(403)
  })

  it('calls assertProjectAccess with requiredRole owner', async () => {
    mockCreateApiKey.mockResolvedValue({ key: { id: 'k1' }, fullKey: 'hiss_full' })

    const req = createPostRequest(validBody)
    await POST(req)

    expect(mockAssertProjectAccess).toHaveBeenCalledWith(
      MOCK_USER_IDENTITY,
      PROJECT_ID,
      { requiredRole: 'owner' },
    )
  })

  it('returns 400 when name is missing', async () => {
    const req = createPostRequest({})
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Name is required.')
  })

  it('returns 400 when name is not a string', async () => {
    const req = createPostRequest({ name: 123 })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Name is required.')
  })

  it('creates api key with valid input and returns 201', async () => {
    const result = {
      key: { id: 'key-new', prefix: 'hiss_abc', name: 'My API Key' },
      fullKey: 'hiss_abc123def456',
    }
    mockCreateApiKey.mockResolvedValue(result)

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.fullKey).toBe('hiss_abc123def456')
    expect(body.apiKey).toEqual(result.key)
  })

  it('passes expiresAt when provided', async () => {
    mockCreateApiKey.mockResolvedValue({ key: { id: 'k1' }, fullKey: 'hiss_full' })

    const req = createPostRequest({
      name: 'Expiring Key',
      expiresAt: '2025-12-31T23:59:59Z',
    })
    await POST(req)

    const input = mockCreateApiKey.mock.calls[0][0]
    expect(input.name).toBe('Expiring Key')
    expect(input.expiresAt).toBe('2025-12-31T23:59:59Z')
    expect(input.projectId).toBe(PROJECT_ID)
    expect(input.createdByUserId).toBe('user-1')
  })

  it('uses createdByUserId from api_key identity', async () => {
    mockRequireRequestIdentity.mockResolvedValue(MOCK_API_KEY_IDENTITY)
    mockCreateApiKey.mockResolvedValue({ key: { id: 'k1' }, fullKey: 'hiss_full' })

    const req = createPostRequest(validBody)
    await POST(req)

    const input = mockCreateApiKey.mock.calls[0][0]
    expect(input.createdByUserId).toBe('user-1') // createdByUserId from the api_key identity
  })

  it('returns 500 on unexpected error', async () => {
    mockCreateApiKey.mockRejectedValue(new Error('DB error'))

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to create API key.')
  })
})

// ---- DELETE --------------------------------------------------------------

describe('DELETE /api/access/api-keys', () => {
  function createDeleteRequest(projectId = PROJECT_ID) {
    return createRequest(
      `http://localhost/api/access/api-keys?projectId=${projectId}`,
      { method: 'DELETE' },
    )
  }

  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createDeleteRequest()
    const res = await DELETE(req)

    expect(res.status).toBe(500)
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/access/api-keys', {
      method: 'DELETE',
    })
    const res = await DELETE(req)

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createDeleteRequest()
    const res = await DELETE(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 when user lacks owner role', async () => {
    mockAssertProjectAccess.mockRejectedValue(
      new ForbiddenError("Requires 'owner' role."),
    )

    const req = createDeleteRequest()
    const res = await DELETE(req)

    expect(res.status).toBe(403)
  })

  it('calls assertProjectAccess with requiredRole owner', async () => {
    mockRevokeAllApiKeys.mockResolvedValue(undefined)

    const req = createDeleteRequest()
    await DELETE(req)

    expect(mockAssertProjectAccess).toHaveBeenCalledWith(
      MOCK_USER_IDENTITY,
      PROJECT_ID,
      { requiredRole: 'owner' },
    )
  })

  it('revokes all api keys and returns success', async () => {
    mockRevokeAllApiKeys.mockResolvedValue(undefined)

    const req = createDeleteRequest()
    const res = await DELETE(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockRevokeAllApiKeys).toHaveBeenCalledWith(PROJECT_ID)
  })

  it('returns 500 on unexpected error', async () => {
    mockRevokeAllApiKeys.mockRejectedValue(new Error('DB error'))

    const req = createDeleteRequest()
    const res = await DELETE(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to revoke API keys.')
  })
})
