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

vi.mock('@/types/customer', () => ({
  COMPANY_STAGES: ['prospect', 'onboarding', 'active', 'churned', 'expansion'],
}))

const mockListCompanies = vi.fn()
vi.mock('@/lib/db/queries/companies', () => ({
  listCompanies: (...args: unknown[]) => mockListCompanies(...args),
}))

const mockCreateCompany = vi.fn()
vi.mock('@/lib/customers/customers-service', () => ({
  createCompany: (...args: unknown[]) => mockCreateCompany(...args),
}))

// ---------------------------------------------------------------------------
// Import the route handlers and error classes after mocks are registered
// ---------------------------------------------------------------------------

const { GET, POST } = await import(
  '@/app/api/(project)/companies/route'
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

describe('GET /api/companies', () => {
  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createRequest(`http://localhost/api/companies?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/companies')
    const res = await GET(req)

    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireRequestIdentity.mockRejectedValue(new UnauthorizedError())

    const req = createRequest(`http://localhost/api/companies?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('returns 403 when user has no project access', async () => {
    mockAssertProjectAccess.mockRejectedValue(new ForbiddenError())

    const req = createRequest(`http://localhost/api/companies?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it('returns companies list', async () => {
    const companies = [{ id: 'co1', name: 'Acme' }]
    mockListCompanies.mockResolvedValue({ companies, total: 1 })

    const req = createRequest(
      `http://localhost/api/companies?projectId=${PROJECT_ID}`,
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.companies).toEqual(companies)
    expect(body.total).toBe(1)

    const filters = mockListCompanies.mock.calls[0][1]
    expect(filters.projectId).toBe(PROJECT_ID)
  })

  it('passes stage, search, industry, planTier, country filters', async () => {
    mockListCompanies.mockResolvedValue({ companies: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/companies?projectId=${PROJECT_ID}&stage=active&search=acme&industry=SaaS&planTier=enterprise&country=US`,
    )
    await GET(req)

    const filters = mockListCompanies.mock.calls[0][1]
    expect(filters.stage).toBe('active')
    expect(filters.search).toBe('acme')
    expect(filters.industry).toBe('SaaS')
    expect(filters.planTier).toBe('enterprise')
    expect(filters.country).toBe('US')
  })

  it('passes limit and offset from query params', async () => {
    mockListCompanies.mockResolvedValue({ companies: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/companies?projectId=${PROJECT_ID}&limit=15&offset=30`,
    )
    await GET(req)

    const filters = mockListCompanies.mock.calls[0][1]
    expect(filters.limit).toBe(15)
    expect(filters.offset).toBe(30)
  })

  it('passes showArchived filter', async () => {
    mockListCompanies.mockResolvedValue({ companies: [], total: 0 })

    const req = createRequest(
      `http://localhost/api/companies?projectId=${PROJECT_ID}&showArchived=true`,
    )
    await GET(req)

    const filters = mockListCompanies.mock.calls[0][1]
    expect(filters.showArchived).toBe(true)
  })

  it('returns 500 on unexpected error', async () => {
    mockListCompanies.mockRejectedValue(new Error('DB error'))

    const req = createRequest(`http://localhost/api/companies?projectId=${PROJECT_ID}`)
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to load companies.')
  })
})

// ---- POST ----------------------------------------------------------------

describe('POST /api/companies', () => {
  const validBody = {
    name: 'Acme Corp',
    domain: 'acme.com',
  }

  function createPostRequest(body: Record<string, unknown>, projectId = PROJECT_ID) {
    return createRequest(
      `http://localhost/api/companies?projectId=${projectId}`,
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
    const req = createRequest('http://localhost/api/companies', {
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
    const req = createPostRequest({ domain: 'acme.com' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('name is required.')
  })

  it('returns 400 when domain is missing', async () => {
    const req = createPostRequest({ name: 'Acme' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('domain is required.')
  })

  it('returns 400 when stage is invalid', async () => {
    const req = createPostRequest({ ...validBody, stage: 'invalid_stage' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid stage')
  })

  it('accepts valid stage values', async () => {
    mockCreateCompany.mockResolvedValue({ id: 'co-new' })

    for (const stage of ['prospect', 'onboarding', 'active', 'churned', 'expansion']) {
      vi.clearAllMocks()
      mockIsDatabaseConfigured.mockReturnValue(true)
      mockRequireRequestIdentity.mockResolvedValue(MOCK_IDENTITY)
      mockAssertProjectAccess.mockResolvedValue(undefined)
      mockCreateCompany.mockResolvedValue({ id: 'co-new' })

      const req = createPostRequest({ ...validBody, stage })
      const res = await POST(req)

      expect(res.status).toBe(201)
    }
  })

  it('creates company with valid input and returns 201', async () => {
    const createdCompany = { id: 'co-new', ...validBody }
    mockCreateCompany.mockResolvedValue(createdCompany)

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.company.id).toBe('co-new')
    expect(mockCreateCompany).toHaveBeenCalled()
  })

  it('passes optional fields through to createCompany', async () => {
    const fullBody = {
      ...validBody,
      arr: 100000,
      stage: 'active',
      product_used: 'Pro Plan',
      industry: 'SaaS',
      employee_count: 50,
      plan_tier: 'enterprise',
      renewal_date: '2025-06-01',
      health_score: 85,
      country: 'US',
      notes: 'Strategic account',
      custom_fields: { region: 'west' },
    }
    mockCreateCompany.mockResolvedValue({ id: 'co-new' })

    const req = createPostRequest(fullBody)
    await POST(req)

    const input = mockCreateCompany.mock.calls[0][0]
    expect(input.projectId).toBe(PROJECT_ID)
    expect(input.name).toBe('Acme Corp')
    expect(input.domain).toBe('acme.com')
    expect(input.arr).toBe(100000)
    expect(input.stage).toBe('active')
    expect(input.productUsed).toBe('Pro Plan')
    expect(input.industry).toBe('SaaS')
    expect(input.employeeCount).toBe(50)
    expect(input.planTier).toBe('enterprise')
    expect(input.renewalDate).toBe('2025-06-01')
    expect(input.healthScore).toBe(85)
    expect(input.country).toBe('US')
    expect(input.notes).toBe('Strategic account')
    expect(input.customFields).toEqual({ region: 'west' })
  })

  it('defaults stage to prospect when not provided', async () => {
    mockCreateCompany.mockResolvedValue({ id: 'co-new' })

    const req = createPostRequest(validBody)
    await POST(req)

    const input = mockCreateCompany.mock.calls[0][0]
    expect(input.stage).toBe('prospect')
  })

  it('defaults optional fields to null or empty', async () => {
    mockCreateCompany.mockResolvedValue({ id: 'co-new' })

    const req = createPostRequest(validBody)
    await POST(req)

    const input = mockCreateCompany.mock.calls[0][0]
    expect(input.arr).toBeNull()
    expect(input.productUsed).toBeNull()
    expect(input.industry).toBeNull()
    expect(input.employeeCount).toBeNull()
    expect(input.planTier).toBeNull()
    expect(input.renewalDate).toBeNull()
    expect(input.healthScore).toBeNull()
    expect(input.country).toBeNull()
    expect(input.notes).toBeNull()
    expect(input.customFields).toEqual({})
  })

  it('returns 500 on unexpected error', async () => {
    mockCreateCompany.mockRejectedValue(new Error('DB write failed'))

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to create company.')
  })
})
