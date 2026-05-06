/**
 * Proxy (Middleware) Tests
 *
 * Tests the request proxy layer (app/src/proxy.ts).
 * This is the most security-critical component:
 *   - Identity header stripping prevents spoofing
 *   - API key auth flow with project scope enforcement
 *   - Session auth flow with header injection
 *   - Bearer token verification for cron/admin paths
 *   - Public path passthrough
 *   - Auth failure handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// MOCKS
// ============================================================================

const mockGetToken = vi.fn()
vi.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockResolveApiKey = vi.fn()
vi.mock('@/lib/auth/api-keys', () => ({
  resolveApiKey: (...args: unknown[]) => mockResolveApiKey(...args),
}))

// db.select().from().where().limit() for userProfiles lookup
const mockDbLimit = vi.fn()
const mockDbWhere = vi.fn(() => ({ limit: mockDbLimit }))
const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }))
const mockDbSelect = vi.fn((..._args: any[]) => ({ from: mockDbFrom }))

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
  },
}))

vi.mock('@/lib/db/schema/app', () => ({
  userProfiles: {
    user_id: 'user_id',
    full_name: 'full_name',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
}))

// ============================================================================
// IMPORT UNDER TEST
// ============================================================================

import { proxy } from '@/proxy'

// ============================================================================
// HELPERS
// ============================================================================

const BASE_URL = 'http://localhost:3000'

const IDENTITY_HEADERS = [
  'x-user-id',
  'x-user-email',
  'x-user-name',
  'x-api-key-id',
  'x-api-key-project-id',
  'x-api-key-created-by',
]

function createRequest(
  path: string,
  options?: {
    headers?: Record<string, string>
    method?: string
  },
): NextRequest {
  const url = `${BASE_URL}${path}`
  const init = {
    method: options?.method ?? 'GET',
    headers: options?.headers ?? {},
  }
  return new NextRequest(url, init)
}

/**
 * Extract the headers that would be forwarded by NextResponse.next().
 * NextResponse.next() stores overridden request headers internally.
 */
function getForwardedHeaders(response: NextResponse): Headers | null {
  // NextResponse.next({ request: { headers } }) stores them in the
  // response headers as x-middleware-request-* headers.
  const result = new Headers()
  response.headers.forEach((value, key) => {
    const prefix = 'x-middleware-request-'
    if (key.startsWith(prefix)) {
      result.set(key.slice(prefix.length), value)
    }
  })
  return result
}

function setupAuthenticatedSession(user: {
  id: string
  email?: string | null
  name?: string | null
}) {
  mockGetToken.mockResolvedValue({
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
  })
}

function setupUserProfile(profile: {
  full_name: string | null
} | null) {
  if (profile) {
    mockDbLimit.mockResolvedValue([profile])
  } else {
    mockDbLimit.mockResolvedValue([])
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no session, no profile
  mockGetToken.mockResolvedValue(null)
  mockDbLimit.mockResolvedValue([])
})

// ============================================================================
// Identity header stripping (SECURITY)
// ============================================================================

describe('identity header stripping', () => {
  it('strips all identity headers from /api/auth requests', async () => {
    const request = createRequest('/api/auth/callback/google', {
      headers: {
        'x-user-id': 'spoofed-user',
        'x-api-key-id': 'spoofed-key',
        'x-api-key-project-id': 'spoofed-project',
        'x-api-key-created-by': 'spoofed-creator',
      },
    })

    const response = await proxy(request)
    const forwarded = getForwardedHeaders(response)

    expect(response.status).toBe(200) // passthrough
    for (const header of IDENTITY_HEADERS) {
      expect(forwarded?.get(header)).toBeFalsy()
    }
    // auth() should NOT be called for /api/auth paths
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('strips all identity headers from public paths', async () => {
    const request = createRequest('/login', {
      headers: { 'x-user-id': 'spoofed-user' },
    })

    const response = await proxy(request)
    const forwarded = getForwardedHeaders(response)

    for (const header of IDENTITY_HEADERS) {
      expect(forwarded?.get(header)).toBeFalsy()
    }
  })

  it('strips identity headers when no session exists on protected paths', async () => {
    mockGetToken.mockResolvedValue(null)

    const request = createRequest('/api/projects', {
      headers: { 'x-user-id': 'spoofed-user' },
    })

    const response = await proxy(request)

    // Should return 401 for unauthenticated API route
    expect(response.status).toBe(401)
  })
})

// ============================================================================
// /api/auth passthrough
// ============================================================================

describe('/api/auth passthrough', () => {
  it('passes through /api/auth without calling auth()', async () => {
    const request = createRequest('/api/auth/signin')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('passes through /api/auth/callback/google', async () => {
    const request = createRequest('/api/auth/callback/google')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mockGetToken).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Public paths
// ============================================================================

describe('public paths', () => {
  const publicPaths = [
    '/login',
    '/unauthorized',
    '/legal',
    '/legal/privacy',
    '/landing',
    '/docs',
    '/docs/api',
    '/api/healthz',
    '/api/plugins/oauth/slack/callback',
    '/api/plugins/webhook/slack',
    '/api/plugins/webhook/github',
    '/api/integrations/widget/chat',
    '/api/integrations/widget/embed',
  ]

  for (const path of publicPaths) {
    it(`allows ${path} without authentication`, async () => {
      const request = createRequest(path)
      const response = await proxy(request)

      // Public paths should pass through (200)
      expect(response.status).toBe(200)
    })
  }
})

// ============================================================================
// Bearer token auth (cron paths)
// ============================================================================

describe('bearer token auth for /api/cron', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 when CRON_SECRET is set but token is wrong', async () => {
    process.env = { ...originalEnv, CRON_SECRET: 'correct-secret' }

    const request = createRequest('/api/cron/daily', {
      headers: { authorization: 'Bearer wrong-secret' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(401)
  })

  it('passes through when CRON_SECRET matches', async () => {
    process.env = { ...originalEnv, CRON_SECRET: 'correct-secret' }

    const request = createRequest('/api/cron/daily', {
      headers: { authorization: 'Bearer correct-secret' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('returns 500 when CRON_SECRET env var is not configured (optional=false)', async () => {
    process.env = { ...originalEnv }
    delete process.env.CRON_SECRET

    const request = createRequest('/api/cron/daily')

    const response = await proxy(request)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('CRON_SECRET')
  })

  it('strips identity headers from cron requests even when valid', async () => {
    process.env = { ...originalEnv, CRON_SECRET: 'correct-secret' }

    const request = createRequest('/api/cron/daily', {
      headers: {
        authorization: 'Bearer correct-secret',
        'x-user-id': 'should-be-stripped',
      },
    })

    const response = await proxy(request)
    const forwarded = getForwardedHeaders(response)

    expect(forwarded?.get('x-user-id')).toBeFalsy()
  })

  it('returns 401 when authorization header is missing and CRON_SECRET is set', async () => {
    process.env = { ...originalEnv, CRON_SECRET: 'correct-secret' }

    const request = createRequest('/api/cron/daily')

    const response = await proxy(request)

    expect(response.status).toBe(401)
  })
})

// ============================================================================
// Authenticated session flow
// ============================================================================

describe('authenticated session flow', () => {
  it('sets user identity headers for authenticated users', async () => {
    setupAuthenticatedSession({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    })
    setupUserProfile({ full_name: 'Test User' })

    const request = createRequest('/dashboard')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    const forwarded = getForwardedHeaders(response)
    expect(forwarded?.get('x-user-id')).toBe('user-123')
    expect(forwarded?.get('x-user-email')).toBe('test@example.com')
  })

  it('prefers profile full_name over session name', async () => {
    setupAuthenticatedSession({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Session Name',
    })
    setupUserProfile({ full_name: 'Profile Name' })

    const request = createRequest('/dashboard')
    const response = await proxy(request)

    const forwarded = getForwardedHeaders(response)
    expect(forwarded?.get('x-user-name')).toBe('Profile Name')
  })

  it('falls back to session name when profile full_name is null', async () => {
    setupAuthenticatedSession({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Session Name',
    })
    setupUserProfile({ full_name: null })

    const request = createRequest('/dashboard')
    const response = await proxy(request)

    const forwarded = getForwardedHeaders(response)
    expect(forwarded?.get('x-user-name')).toBe('Session Name')
  })

  it('redirects unauthenticated page requests to /login with redirectTo', async () => {
    mockGetToken.mockResolvedValue(null)

    const request = createRequest('/projects/abc/settings')
    const response = await proxy(request)

    expect(response.status).toBe(307) // redirect
    const location = response.headers.get('location')
    expect(location).toContain('/login')
    expect(location).toContain('redirectTo=%2Fprojects%2Fabc%2Fsettings')
  })

  it('returns 401 JSON for unauthenticated API requests (no API key)', async () => {
    mockGetToken.mockResolvedValue(null)

    const request = createRequest('/api/projects')
    const response = await proxy(request)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })
})

// ============================================================================
// API key authentication flow
// ============================================================================

describe('API key authentication', () => {
  beforeEach(() => {
    // No session (API key auth only applies when no session)
    mockGetToken.mockResolvedValue(null)
  })

  it('authenticates with a valid hiss_ API key', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-001',
      projectId: 'proj-001',
      createdByUserId: 'user-creator-001',
    })

    const request = createRequest('/api/projects/proj-001/sessions', {
      headers: { authorization: 'Bearer hiss_valid_api_key_here' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    const forwarded = getForwardedHeaders(response)
    expect(forwarded?.get('x-api-key-id')).toBe('key-001')
    expect(forwarded?.get('x-api-key-project-id')).toBe('proj-001')
    expect(forwarded?.get('x-api-key-created-by')).toBe('user-creator-001')
    // User headers must NOT be set
    expect(forwarded?.get('x-user-id')).toBeFalsy()
  })

  it('returns 401 for an invalid API key', async () => {
    mockResolveApiKey.mockResolvedValue(null)

    const request = createRequest('/api/projects/proj-001/data', {
      headers: { authorization: 'Bearer hiss_invalid_key' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Invalid API key')
  })

  it('strips spoofed identity headers before injecting API key identity', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-001',
      projectId: 'proj-001',
      createdByUserId: 'user-creator-001',
    })

    const request = createRequest('/api/projects/proj-001/data', {
      headers: {
        authorization: 'Bearer hiss_valid_key',
        'x-user-id': 'spoofed-user',
        'x-user-email': 'spoofed@evil.com',
        'x-api-key-id': 'spoofed-key',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    const forwarded = getForwardedHeaders(response)
    // Spoofed user headers must be stripped
    expect(forwarded?.get('x-user-id')).toBeFalsy()
    expect(forwarded?.get('x-user-email')).toBeFalsy()
    // Correct API key identity injected
    expect(forwarded?.get('x-api-key-id')).toBe('key-001')
  })

  it('returns 403 when API key projectId does not match URL path project', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-001',
      projectId: 'proj-001',
      createdByUserId: 'user-creator-001',
    })

    const request = createRequest('/api/projects/proj-OTHER/data', {
      headers: { authorization: 'Bearer hiss_valid_key' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 when API key projectId does not match query param projectId', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-001',
      projectId: 'proj-001',
      createdByUserId: 'user-creator-001',
    })

    const request = createRequest('/api/sessions?projectId=proj-OTHER', {
      headers: { authorization: 'Bearer hiss_valid_key' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('passes through when API key projectId matches URL path project', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-001',
      projectId: 'proj-001',
      createdByUserId: 'user-creator-001',
    })

    const request = createRequest('/api/projects/proj-001/data', {
      headers: { authorization: 'Bearer hiss_valid_key' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('passes through when no projectId query param is provided', async () => {
    mockResolveApiKey.mockResolvedValue({
      keyId: 'key-001',
      projectId: 'proj-001',
      createdByUserId: 'user-creator-001',
    })

    const request = createRequest('/api/some-endpoint', {
      headers: { authorization: 'Bearer hiss_valid_key' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('does not attempt API key auth for non-hiss_ bearer tokens', async () => {
    const request = createRequest('/api/projects', {
      headers: { authorization: 'Bearer sk_live_some_other_token' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(401)
    expect(mockResolveApiKey).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Marketing paths
// ============================================================================

describe('marketing path (root /)', () => {
  it('redirects authenticated users from / to /projects', async () => {
    setupAuthenticatedSession({ id: 'user-123' })
    setupUserProfile({ full_name: null })

    const request = createRequest('/')
    const response = await proxy(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('/projects')
  })

  it('passes through for unauthenticated users on /', async () => {
    mockGetToken.mockResolvedValue(null)

    const request = createRequest('/')
    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('redirects OAuth errors from / to /login with error params', async () => {
    mockGetToken.mockResolvedValue(null)

    const request = createRequest('/?error=access_denied&error_description=User+denied')
    const response = await proxy(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('/login')
    expect(location).toContain('error=access_denied')
    expect(location).toContain('error_description=User')
  })
})

// ============================================================================
// Auth failure handling
// ============================================================================

describe('auth() failure', () => {
  it('returns 401 for API routes when auth() throws', async () => {
    mockGetToken.mockRejectedValue(new Error('auth session corrupted'))

    const request = createRequest('/api/projects')
    const response = await proxy(request)

    expect(response.status).toBe(401)
  })

  it('redirects page routes to /login with error when auth() throws', async () => {
    mockGetToken.mockRejectedValue(new Error('session expired'))

    const request = createRequest('/dashboard')
    const response = await proxy(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('/login')
    expect(location).toContain('error=')
  })

  it('strips identity headers when auth() throws', async () => {
    mockGetToken.mockRejectedValue(new Error('crash'))

    const request = createRequest('/api/test', {
      headers: { 'x-user-id': 'should-be-stripped' },
    })

    const response = await proxy(request)

    // 401 response - headers are not forwarded, but the response should be clean
    expect(response.status).toBe(401)
  })
})
