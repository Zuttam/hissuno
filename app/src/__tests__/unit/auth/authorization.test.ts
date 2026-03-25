import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHasProjectAccess = vi.fn()
const mockHasProjectRole = vi.fn()
vi.mock('@/lib/auth/project-members', () => ({
  isProjectMember: (...args: unknown[]) => mockHasProjectAccess(...args),
  hasProjectRole: (...args: unknown[]) => mockHasProjectRole(...args),
}))

import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'

const PROJECT_ID = 'project-123'

const userIdentity = {
  type: 'user' as const,
  userId: 'user-456',
  email: 'test@example.com',
  name: 'Test User',
}

const apiKeyIdentity = {
  type: 'api_key' as const,
  projectId: PROJECT_ID,
  keyId: 'key-789',
  createdByUserId: 'user-creator-001',
}

describe('ForbiddenError', () => {
  it('has status 403', () => {
    const error = new ForbiddenError()
    expect(error.status).toBe(403)
  })

  it('has default message "Forbidden"', () => {
    const error = new ForbiddenError()
    expect(error.message).toBe('Forbidden')
  })

  it('accepts a custom message', () => {
    const error = new ForbiddenError('You shall not pass')
    expect(error.message).toBe('You shall not pass')
    expect(error.status).toBe(403)
  })
})

describe('assertProjectAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('with API key identity', () => {
    it('passes when projectId matches', async () => {
      await expect(
        assertProjectAccess(apiKeyIdentity, PROJECT_ID),
      ).resolves.toBeUndefined()

      expect(mockHasProjectAccess).not.toHaveBeenCalled()
      expect(mockHasProjectRole).not.toHaveBeenCalled()
    })

    it('throws ForbiddenError when projectId does not match', async () => {
      await expect(
        assertProjectAccess(apiKeyIdentity, 'other-project'),
      ).rejects.toThrow(ForbiddenError)
    })

    it('checks creator role when requiredRole is specified', async () => {
      mockHasProjectRole.mockResolvedValue(true)

      await expect(
        assertProjectAccess(apiKeyIdentity, PROJECT_ID, {
          requiredRole: 'owner',
        }),
      ).resolves.toBeUndefined()

      expect(mockHasProjectRole).toHaveBeenCalledWith(
        PROJECT_ID,
        apiKeyIdentity.createdByUserId,
        'owner',
      )
    })

    it('throws ForbiddenError when creator lacks required role', async () => {
      mockHasProjectRole.mockResolvedValue(false)

      await expect(
        assertProjectAccess(apiKeyIdentity, PROJECT_ID, {
          requiredRole: 'owner',
        }),
      ).rejects.toThrow(ForbiddenError)

      expect(mockHasProjectRole).toHaveBeenCalledWith(
        PROJECT_ID,
        apiKeyIdentity.createdByUserId,
        'owner',
      )
    })
  })

  describe('with user identity', () => {
    it('passes when user has access (no role required)', async () => {
      mockHasProjectAccess.mockResolvedValue(true)

      await expect(
        assertProjectAccess(userIdentity, PROJECT_ID),
      ).resolves.toBeUndefined()

      expect(mockHasProjectAccess).toHaveBeenCalledWith(
        PROJECT_ID,
        userIdentity.userId,
      )
      expect(mockHasProjectRole).not.toHaveBeenCalled()
    })

    it('throws UnauthorizedError when user lacks access', async () => {
      mockHasProjectAccess.mockResolvedValue(false)

      await expect(
        assertProjectAccess(userIdentity, PROJECT_ID),
      ).rejects.toThrow(UnauthorizedError)
    })

    it('checks role when requiredRole is specified', async () => {
      mockHasProjectRole.mockResolvedValue(true)

      await expect(
        assertProjectAccess(userIdentity, PROJECT_ID, {
          requiredRole: 'owner',
        }),
      ).resolves.toBeUndefined()

      expect(mockHasProjectRole).toHaveBeenCalledWith(
        PROJECT_ID,
        userIdentity.userId,
        'owner',
      )
    })

    it('throws ForbiddenError when user lacks required role', async () => {
      mockHasProjectRole.mockResolvedValue(false)

      await expect(
        assertProjectAccess(userIdentity, PROJECT_ID, {
          requiredRole: 'owner',
        }),
      ).rejects.toThrow(ForbiddenError)

      expect(mockHasProjectRole).toHaveBeenCalledWith(
        PROJECT_ID,
        userIdentity.userId,
        'owner',
      )
    })
  })
})
