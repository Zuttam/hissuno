import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

import { headers } from 'next/headers'
import {
  USER_ID_HEADER,
  USER_EMAIL_HEADER,
  USER_NAME_HEADER,
  UnauthorizedError,
  getSessionUser,
  getSafeRedirectPath,
} from '@/lib/auth/server'

const mockHeaders = headers as unknown as ReturnType<typeof vi.fn>

function createMockHeaders(entries: Record<string, string>): Headers {
  const h = new Headers()
  for (const [key, value] of Object.entries(entries)) {
    h.set(key, value)
  }
  return h
}

describe('auth/server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('header constants', () => {
    it('exports correct header names', () => {
      expect(USER_ID_HEADER).toBe('x-user-id')
      expect(USER_EMAIL_HEADER).toBe('x-user-email')
      expect(USER_NAME_HEADER).toBe('x-user-name')
    })
  })

  describe('UnauthorizedError', () => {
    it('has status 401', () => {
      const error = new UnauthorizedError()
      expect(error.status).toBe(401)
    })

    it('has default message "Unauthorized"', () => {
      const error = new UnauthorizedError()
      expect(error.message).toBe('Unauthorized')
    })

    it('accepts a custom message', () => {
      const error = new UnauthorizedError('Custom unauthorized message')
      expect(error.message).toBe('Custom unauthorized message')
      expect(error.status).toBe(401)
    })

    it('is an instance of Error', () => {
      const error = new UnauthorizedError()
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('getSessionUser', () => {
    it('returns user when headers have x-user-id', async () => {
      const h = createMockHeaders({
        [USER_ID_HEADER]: 'user-123',
        [USER_EMAIL_HEADER]: 'test@example.com',
        [USER_NAME_HEADER]: 'Test User',
      })
      mockHeaders.mockResolvedValue(h)

      const user = await getSessionUser()

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      })
    })

    it('returns null when no x-user-id header', async () => {
      const h = createMockHeaders({})
      mockHeaders.mockResolvedValue(h)

      const user = await getSessionUser()

      expect(user).toBeNull()
    })

    it('returns email and name from headers', async () => {
      const h = createMockHeaders({
        [USER_ID_HEADER]: 'user-456',
        [USER_EMAIL_HEADER]: 'another@example.com',
        [USER_NAME_HEADER]: 'Another User',
      })
      mockHeaders.mockResolvedValue(h)

      const user = await getSessionUser()

      expect(user).not.toBeNull()
      expect(user!.email).toBe('another@example.com')
      expect(user!.name).toBe('Another User')
    })

    it('handles null email and name when headers are absent', async () => {
      const h = createMockHeaders({
        [USER_ID_HEADER]: 'user-789',
      })
      mockHeaders.mockResolvedValue(h)

      const user = await getSessionUser()

      expect(user).not.toBeNull()
      expect(user!.id).toBe('user-789')
      expect(user!.email).toBeNull()
      expect(user!.name).toBeNull()
    })

    it('accepts explicit Headers parameter instead of using next/headers', async () => {
      const h = createMockHeaders({
        [USER_ID_HEADER]: 'explicit-user',
        [USER_EMAIL_HEADER]: 'explicit@example.com',
        [USER_NAME_HEADER]: 'Explicit User',
      })

      const user = await getSessionUser(h)

      expect(user).toEqual({
        id: 'explicit-user',
        email: 'explicit@example.com',
        name: 'Explicit User',
      })
      // Should not call next/headers when explicit headers are provided
      expect(mockHeaders).not.toHaveBeenCalled()
    })
  })

  describe('getSafeRedirectPath', () => {
    it('returns path for valid relative paths like /dashboard', () => {
      expect(getSafeRedirectPath('/dashboard')).toBe('/dashboard')
    })

    it('returns default for null', () => {
      expect(getSafeRedirectPath(null)).toBe('/projects')
    })

    it('returns default for undefined', () => {
      expect(getSafeRedirectPath(undefined)).toBe('/projects')
    })

    it('returns default for empty string', () => {
      expect(getSafeRedirectPath('')).toBe('/projects')
    })

    it('blocks protocol-relative URLs //evil.com', () => {
      expect(getSafeRedirectPath('//evil.com')).toBe('/projects')
    })

    it('blocks javascript: protocol', () => {
      expect(getSafeRedirectPath('javascript:alert(1)')).toBe('/projects')
    })

    it('blocks data: protocol', () => {
      expect(getSafeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe('/projects')
    })

    it('blocks paths with backslashes', () => {
      expect(getSafeRedirectPath('\\evil.com')).toBe('/projects')
      expect(getSafeRedirectPath('/path\\evil')).toBe('/projects')
    })

    it('blocks paths with @ symbol', () => {
      expect(getSafeRedirectPath('/redirect@evil.com')).toBe('/projects')
      expect(getSafeRedirectPath('http://user@evil.com')).toBe('/projects')
    })

    it('returns default for paths not starting with /', () => {
      expect(getSafeRedirectPath('http://evil.com')).toBe('/projects')
      expect(getSafeRedirectPath('https://evil.com')).toBe('/projects')
      expect(getSafeRedirectPath('ftp://evil.com')).toBe('/projects')
      expect(getSafeRedirectPath('relative-path')).toBe('/projects')
    })

    it('accepts custom default path parameter', () => {
      expect(getSafeRedirectPath(null, '/home')).toBe('/home')
      expect(getSafeRedirectPath('', '/home')).toBe('/home')
      expect(getSafeRedirectPath('//evil.com', '/custom-default')).toBe('/custom-default')
    })

    it('allows deeply nested paths /a/b/c/d', () => {
      expect(getSafeRedirectPath('/a/b/c/d')).toBe('/a/b/c/d')
    })

    it('allows paths with query strings /path?foo=bar', () => {
      expect(getSafeRedirectPath('/path?foo=bar')).toBe('/path?foo=bar')
    })

    it('allows paths with hash /path#section', () => {
      expect(getSafeRedirectPath('/path#section')).toBe('/path#section')
    })
  })
})
