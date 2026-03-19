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

const mockParseCSVContent = vi.fn()
const mockValidateAndImportRows = vi.fn()
vi.mock('@/lib/customers/csv-import', () => ({
  parseCSVContent: (...args: unknown[]) => mockParseCSVContent(...args),
  validateAndImportRows: (...args: unknown[]) => mockValidateAndImportRows(...args),
}))

const mockDownloadCSVImport = vi.fn()
const mockDeleteCSVImport = vi.fn()
vi.mock('@/lib/customers/csv-storage', () => ({
  downloadCSVImport: (...args: unknown[]) => mockDownloadCSVImport(...args),
  deleteCSVImport: (...args: unknown[]) => mockDeleteCSVImport(...args),
}))

// ---------------------------------------------------------------------------
// Import the route handlers and error classes after mocks are registered
// ---------------------------------------------------------------------------

const { POST } = await import(
  '@/app/api/(project)/contacts/import/route'
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

const validBody = {
  storagePath: `${PROJECT_ID}/imports/file.csv`,
  entityType: 'contact',
  mappings: [{ csvColumn: 'Name', field: 'name' }],
}

function createPostRequest(body: Record<string, unknown>, projectId = PROJECT_ID) {
  return createRequest(
    `http://localhost/api/contacts/import?projectId=${projectId}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDatabaseConfigured.mockReturnValue(true)
  mockRequireRequestIdentity.mockResolvedValue(MOCK_IDENTITY)
  mockAssertProjectAccess.mockResolvedValue(undefined)
  mockDeleteCSVImport.mockResolvedValue(undefined)
})

describe('POST /api/contacts/import', () => {
  // ---- Auth & preconditions ----------------------------------------------

  it('returns 500 when database is not configured', async () => {
    mockIsDatabaseConfigured.mockReturnValue(false)

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(500)
  })

  it('returns 400 when projectId is missing', async () => {
    const req = createRequest('http://localhost/api/contacts/import', {
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

  // ---- Input validation --------------------------------------------------

  it('returns 400 when storagePath is missing', async () => {
    const req = createPostRequest({
      entityType: 'contact',
      mappings: [{ csvColumn: 'Name', field: 'name' }],
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('storagePath is required.')
  })

  it('returns 400 when storagePath is not a string', async () => {
    const req = createPostRequest({
      storagePath: 123,
      entityType: 'contact',
      mappings: [],
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('storagePath is required.')
  })

  it('returns 400 when entityType is missing', async () => {
    const req = createPostRequest({
      storagePath: `${PROJECT_ID}/file.csv`,
      mappings: [],
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('entityType')
  })

  it('returns 400 when entityType is invalid', async () => {
    const req = createPostRequest({
      storagePath: `${PROJECT_ID}/file.csv`,
      entityType: 'invalid_type',
      mappings: [],
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('entityType')
  })

  it('accepts company as a valid entityType', async () => {
    mockDownloadCSVImport.mockResolvedValue({ content: 'Name\nAcme', error: null })
    mockParseCSVContent.mockReturnValue({ rows: [{ Name: 'Acme' }] })
    mockValidateAndImportRows.mockResolvedValue({ imported: 1, errors: [] })

    const req = createPostRequest({
      storagePath: `${PROJECT_ID}/file.csv`,
      entityType: 'company',
      mappings: [{ csvColumn: 'Name', field: 'name' }],
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('returns 400 when mappings is not an array', async () => {
    const req = createPostRequest({
      storagePath: `${PROJECT_ID}/file.csv`,
      entityType: 'contact',
      mappings: 'not-an-array',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('mappings')
  })

  // ---- Path traversal protection -----------------------------------------

  it('returns 403 when storagePath does not start with projectId', async () => {
    const req = createPostRequest({
      storagePath: 'other-project/imports/file.csv',
      entityType: 'contact',
      mappings: [{ csvColumn: 'Name', field: 'name' }],
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden.')
  })

  it('rejects path traversal attempts', async () => {
    const req = createPostRequest({
      storagePath: '../other-project/imports/file.csv',
      entityType: 'contact',
      mappings: [{ csvColumn: 'Name', field: 'name' }],
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
  })

  // ---- CSV processing ----------------------------------------------------

  it('returns 500 when CSV download fails', async () => {
    mockDownloadCSVImport.mockResolvedValue({ content: null, error: 'Not found' })

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to download CSV file.')
  })

  it('returns 400 when CSV has no rows', async () => {
    mockDownloadCSVImport.mockResolvedValue({ content: 'header\n', error: null })
    mockParseCSVContent.mockReturnValue({ rows: [] })

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No rows to import.')
  })

  it('returns 400 when CSV exceeds 500 row limit', async () => {
    mockDownloadCSVImport.mockResolvedValue({ content: 'csv-data', error: null })
    const manyRows = Array.from({ length: 501 }, (_, i) => ({ Name: `Row${i}` }))
    mockParseCSVContent.mockReturnValue({ rows: manyRows })

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Too many rows')
    expect(body.error).toContain('500')
  })

  it('accepts exactly 500 rows', async () => {
    mockDownloadCSVImport.mockResolvedValue({ content: 'csv-data', error: null })
    const exactRows = Array.from({ length: 500 }, (_, i) => ({ Name: `Row${i}` }))
    mockParseCSVContent.mockReturnValue({ rows: exactRows })
    mockValidateAndImportRows.mockResolvedValue({ imported: 500, errors: [] })

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  // ---- Successful import -------------------------------------------------

  it('imports successfully and returns result', async () => {
    mockDownloadCSVImport.mockResolvedValue({ content: 'Name\nAlice\nBob', error: null })
    mockParseCSVContent.mockReturnValue({
      rows: [{ Name: 'Alice' }, { Name: 'Bob' }],
    })
    const importResult = { imported: 2, errors: [] }
    mockValidateAndImportRows.mockResolvedValue(importResult)

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toEqual(importResult)

    // Verify correct args passed to validateAndImportRows
    expect(mockValidateAndImportRows).toHaveBeenCalledWith(
      PROJECT_ID,
      'contact',
      [{ Name: 'Alice' }, { Name: 'Bob' }],
      validBody.mappings,
      { createMissingCompanies: false },
    )
  })

  it('passes createMissingCompanies flag when true', async () => {
    mockDownloadCSVImport.mockResolvedValue({ content: 'csv-data', error: null })
    mockParseCSVContent.mockReturnValue({ rows: [{ Name: 'Alice' }] })
    mockValidateAndImportRows.mockResolvedValue({ imported: 1, errors: [] })

    const req = createPostRequest({
      ...validBody,
      createMissingCompanies: true,
    })
    await POST(req)

    const options = mockValidateAndImportRows.mock.calls[0][4]
    expect(options.createMissingCompanies).toBe(true)
  })

  it('cleans up CSV from storage after import', async () => {
    mockDownloadCSVImport.mockResolvedValue({ content: 'csv-data', error: null })
    mockParseCSVContent.mockReturnValue({ rows: [{ Name: 'Alice' }] })
    mockValidateAndImportRows.mockResolvedValue({ imported: 1, errors: [] })

    const req = createPostRequest(validBody)
    await POST(req)

    expect(mockDeleteCSVImport).toHaveBeenCalledWith(validBody.storagePath)
  })

  it('returns 500 on unexpected error', async () => {
    mockDownloadCSVImport.mockRejectedValue(new Error('Storage error'))

    const req = createPostRequest(validBody)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to import data.')
  })
})
