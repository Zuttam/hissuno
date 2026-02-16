/**
 * MCP Auth Tests
 *
 * Tests the authenticateRequest() function:
 * - Missing/invalid Authorization header → 401
 * - Invalid API key → 401
 * - Valid API key, no contact token → user mode
 * - Valid API key + valid contact JWT → contact mode
 * - Valid API key + invalid contact JWT → 401
 * - Valid API key + contact JWT but contact not found → 404
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS
// ============================================================================

const mockResolveApiKey = vi.fn()
vi.mock('@/lib/auth/api-keys', () => ({
  resolveApiKey: (...args: unknown[]) => mockResolveApiKey(...args),
}))

const mockVerifyWidgetJWT = vi.fn()
vi.mock('@/lib/utils/widget-auth', () => ({
  verifyWidgetJWT: (...args: unknown[]) => mockVerifyWidgetJWT(...args),
}))

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle, eq: mockEq }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))

// ============================================================================
// HELPERS
// ============================================================================

function createMockHeaders(headers: Record<string, string>) {
  return {
    get: (name: string) => headers[name.toLowerCase()] ?? null,
  }
}

// ============================================================================
// TESTS
// ============================================================================

import { authenticateRequest, McpAuthError } from '@/mcp/auth'

describe('MCP authenticateRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing Authorization header', async () => {
    const req = createMockHeaders({})
    await expect(authenticateRequest(req)).rejects.toThrow(McpAuthError)
    await expect(authenticateRequest(req)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects non-Bearer Authorization header', async () => {
    const req = createMockHeaders({ authorization: 'Basic abc123' })
    await expect(authenticateRequest(req)).rejects.toThrow(McpAuthError)
  })

  it('rejects non-hiss_ prefixed key', async () => {
    const req = createMockHeaders({ authorization: 'Bearer sk_live_abc123' })
    await expect(authenticateRequest(req)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects invalid API key', async () => {
    mockResolveApiKey.mockResolvedValue(null)
    const req = createMockHeaders({ authorization: 'Bearer hiss_invalid' })
    await expect(authenticateRequest(req)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired API key',
    })
  })

  it('returns user context for valid API key without contact token', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-1',
      projectId: 'proj-1',
      createdByUserId: 'user-1',
    })

    const req = createMockHeaders({ authorization: 'Bearer hiss_validkey' })
    const ctx = await authenticateRequest(req)

    expect(ctx).toEqual({
      mode: 'user',
      projectId: 'proj-1',
      keyId: 'key-1',
      createdByUserId: 'user-1',
    })
  })

  it('returns contact context for valid API key + valid JWT', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-1',
      projectId: 'proj-1',
      createdByUserId: 'user-1',
    })

    // Mock project secret_key lookup
    mockSingle
      .mockResolvedValueOnce({ data: { secret_key: 'sk_live_test123' }, error: null })
      // Mock contact lookup
      .mockResolvedValueOnce({ data: { id: 'contact-1', email: 'jane@example.com' }, error: null })

    mockVerifyWidgetJWT.mockReturnValue({
      valid: true,
      payload: { userId: 'jane@example.com', userMetadata: { email: 'jane@example.com' } },
    })

    const req = createMockHeaders({
      authorization: 'Bearer hiss_validkey',
      'x-contact-token': 'valid.jwt.token',
    })
    const ctx = await authenticateRequest(req)

    expect(ctx).toEqual({
      mode: 'contact',
      projectId: 'proj-1',
      keyId: 'key-1',
      createdByUserId: 'user-1',
      contactId: 'contact-1',
      contactEmail: 'jane@example.com',
    })
    expect(mockVerifyWidgetJWT).toHaveBeenCalledWith('valid.jwt.token', 'sk_live_test123')
  })

  it('rejects invalid JWT', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-1',
      projectId: 'proj-1',
      createdByUserId: 'user-1',
    })

    // Mock project secret_key lookup
    mockSingle.mockResolvedValueOnce({ data: { secret_key: 'sk_live_test123' }, error: null })

    mockVerifyWidgetJWT.mockReturnValue({ valid: false, error: 'Token expired' })

    const req = createMockHeaders({
      authorization: 'Bearer hiss_validkey',
      'x-contact-token': 'expired.jwt.token',
    })
    await expect(authenticateRequest(req)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid contact token: Token expired',
    })
  })

  it('rejects when contact not found', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-1',
      projectId: 'proj-1',
      createdByUserId: 'user-1',
    })

    // Mock project secret_key lookup
    mockSingle
      .mockResolvedValueOnce({ data: { secret_key: 'sk_live_test123' }, error: null })
      // Mock contact lookup - not found
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'Not found' } })

    mockVerifyWidgetJWT.mockReturnValue({
      valid: true,
      payload: { userId: 'ghost@example.com', userMetadata: { email: 'ghost@example.com' } },
    })

    const req = createMockHeaders({
      authorization: 'Bearer hiss_validkey',
      'x-contact-token': 'valid.jwt.token',
    })
    await expect(authenticateRequest(req)).rejects.toMatchObject({ statusCode: 404 })
  })
})
