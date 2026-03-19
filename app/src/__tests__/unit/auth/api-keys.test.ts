/**
 * API Keys Tests
 *
 * Tests resolveApiKey, createApiKey, revokeApiKey, revokeAllApiKeys, listApiKeys.
 * Focuses on security-critical paths:
 *   - Revoked keys are rejected
 *   - Expired keys are rejected
 *   - Valid keys return correct identity
 *   - Non-existent keys return null
 *   - Max active keys per project enforced
 *   - last_used_at updated asynchronously
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS
// ============================================================================

// Chain-style mock: db.select().from().where().limit()
const mockLimit = vi.fn()
const mockWhere = vi.fn(() => ({ limit: mockLimit }))
const mockFrom = vi.fn(() => ({ where: mockWhere }))
const mockDbSelect = vi.fn(() => ({ from: mockFrom }))

// Insert chain: db.insert().values().returning()
const mockReturning = vi.fn()
const mockValues = vi.fn(() => ({ returning: mockReturning }))
const mockInsert = vi.fn(() => ({ values: mockValues }))

// Update chain: db.update().set().where().returning() / .then()
const mockUpdateReturning = vi.fn()
const mockUpdateWhere = vi.fn(() => ({
  returning: mockUpdateReturning,
  then: vi.fn((onOk: unknown) => {
    if (typeof onOk === 'function') (onOk as () => void)()
    return Promise.resolve()
  }),
}))
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }))
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }))

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}))

vi.mock('@/lib/db/schema/app', () => ({
  projectApiKeys: {
    id: 'id',
    project_id: 'project_id',
    created_by_user_id: 'created_by_user_id',
    name: 'name',
    key_hash: 'key_hash',
    key_prefix: 'key_prefix',
    last_used_at: 'last_used_at',
    expires_at: 'expires_at',
    revoked_at: 'revoked_at',
    created_at: 'created_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: 'isNull', args })),
  desc: vi.fn((...args: unknown[]) => ({ type: 'desc', args })),
  count: vi.fn(() => 'count_fn'),
}))

// ============================================================================
// IMPORT UNDER TEST
// ============================================================================

import {
  resolveApiKey,
  createApiKey,
  revokeApiKey,
  revokeAllApiKeys,
  listApiKeys,
} from '@/lib/auth/api-keys'

// ============================================================================
// HELPERS
// ============================================================================

const PROJECT_ID = 'proj-test-123'
const USER_ID = 'user-creator-456'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// resolveApiKey
// ============================================================================

describe('resolveApiKey', () => {
  it('returns null when key does not exist in database', async () => {
    mockLimit.mockResolvedValue([])

    const result = await resolveApiKey('hiss_nonexistent_key_abc123')

    expect(result).toBeNull()
  })

  it('returns null when key is revoked', async () => {
    mockLimit.mockResolvedValue([
      {
        id: 'key-1',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        revoked_at: new Date('2025-01-01'),
        expires_at: null,
      },
    ])

    const result = await resolveApiKey('hiss_revoked_key_abc123')

    expect(result).toBeNull()
  })

  it('returns null when key is expired', async () => {
    mockLimit.mockResolvedValue([
      {
        id: 'key-2',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        revoked_at: null,
        expires_at: new Date('2020-01-01'),
      },
    ])

    const result = await resolveApiKey('hiss_expired_key_abc123')

    expect(result).toBeNull()
  })

  it('returns identity for a valid, non-revoked, non-expired key', async () => {
    const futureDate = new Date('2099-12-31')
    mockLimit.mockResolvedValue([
      {
        id: 'key-3',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        revoked_at: null,
        expires_at: futureDate,
      },
    ])

    const result = await resolveApiKey('hiss_valid_key_abc123')

    expect(result).toEqual({
      keyId: 'key-3',
      projectId: PROJECT_ID,
      createdByUserId: USER_ID,
    })
  })

  it('returns identity for a key with no expiration (null expires_at)', async () => {
    mockLimit.mockResolvedValue([
      {
        id: 'key-4',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        revoked_at: null,
        expires_at: null,
      },
    ])

    const result = await resolveApiKey('hiss_no_expiry_key')

    expect(result).toEqual({
      keyId: 'key-4',
      projectId: PROJECT_ID,
      createdByUserId: USER_ID,
    })
  })

  it('fires async update for last_used_at on valid key', async () => {
    mockLimit.mockResolvedValue([
      {
        id: 'key-5',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        revoked_at: null,
        expires_at: null,
      },
    ])

    await resolveApiKey('hiss_track_usage_key')

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockUpdateSet).toHaveBeenCalled()
  })

  it('does NOT fire last_used_at update for revoked keys', async () => {
    mockLimit.mockResolvedValue([
      {
        id: 'key-6',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        revoked_at: new Date('2025-06-01'),
        expires_at: null,
      },
    ])

    await resolveApiKey('hiss_revoked_no_update')

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('does NOT fire last_used_at update for expired keys', async () => {
    mockLimit.mockResolvedValue([
      {
        id: 'key-7',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        revoked_at: null,
        expires_at: new Date('2020-01-01'),
      },
    ])

    await resolveApiKey('hiss_expired_no_update')

    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

// ============================================================================
// createApiKey
// ============================================================================

describe('createApiKey', () => {
  it('throws when max active keys limit (25) is reached', async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn().mockResolvedValue([{ count: 25 }]),
    })

    await expect(
      createApiKey({
        projectId: PROJECT_ID,
        createdByUserId: USER_ID,
        name: 'Test Key',
      }),
    ).rejects.toThrow('Maximum of 25 active API keys per project.')
  })

  it('creates a key with hiss_ prefix when under limit', async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    })

    const now = new Date()
    mockReturning.mockResolvedValue([
      {
        id: 'new-key-id',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        name: 'My API Key',
        key_prefix: 'hiss_AAAAAAAAAA',
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        created_at: now,
      },
    ])

    const result = await createApiKey({
      projectId: PROJECT_ID,
      createdByUserId: USER_ID,
      name: 'My API Key',
    })

    expect(result.fullKey).toMatch(/^hiss_/)
    expect(result.key.id).toBe('new-key-id')
    expect(result.key.project_id).toBe(PROJECT_ID)
    expect(result.key.created_at).toBe(now.toISOString())
    expect(result.key.last_used_at).toBeNull()
  })

  it('serializes expiresAt Date to ISO string in result', async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    })

    const now = new Date()
    mockReturning.mockResolvedValue([
      {
        id: 'exp-key-id',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        name: 'Expiring Key',
        key_prefix: 'hiss_BBBBBBBBBB',
        last_used_at: null,
        expires_at: new Date('2025-12-31'),
        revoked_at: null,
        created_at: now,
      },
    ])

    const result = await createApiKey({
      projectId: PROJECT_ID,
      createdByUserId: USER_ID,
      name: 'Expiring Key',
      expiresAt: '2025-12-31',
    })

    expect(result.key.expires_at).toBe('2025-12-31T00:00:00.000Z')
  })

  it('throws when insert returns no data', async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    })

    mockReturning.mockResolvedValue([])

    await expect(
      createApiKey({
        projectId: PROJECT_ID,
        createdByUserId: USER_ID,
        name: 'Failed Key',
      }),
    ).rejects.toThrow('Failed to create API key.')
  })

  it('allows creation at count 24 (one below limit)', async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn().mockResolvedValue([{ count: 24 }]),
    })

    const now = new Date()
    mockReturning.mockResolvedValue([
      {
        id: 'key-at-24',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        name: 'Key 25',
        key_prefix: 'hiss_CCCCCCCCCC',
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        created_at: now,
      },
    ])

    const result = await createApiKey({
      projectId: PROJECT_ID,
      createdByUserId: USER_ID,
      name: 'Key 25',
    })

    expect(result.key.id).toBe('key-at-24')
  })
})

// ============================================================================
// revokeApiKey
// ============================================================================

describe('revokeApiKey', () => {
  it('revokes a key successfully', async () => {
    mockUpdateReturning.mockResolvedValue([{ id: 'key-to-revoke' }])

    await expect(revokeApiKey('key-to-revoke', PROJECT_ID)).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('throws when key not found or wrong project', async () => {
    mockUpdateReturning.mockResolvedValue([])

    await expect(revokeApiKey('nonexistent-key', PROJECT_ID)).rejects.toThrow(
      'Failed to revoke API key.',
    )
  })
})

// ============================================================================
// revokeAllApiKeys
// ============================================================================

describe('revokeAllApiKeys', () => {
  it('calls update with project filter', async () => {
    mockUpdateWhere.mockResolvedValue(undefined)

    await expect(revokeAllApiKeys(PROJECT_ID)).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockUpdateSet).toHaveBeenCalled()
  })
})

// ============================================================================
// listApiKeys
// ============================================================================

describe('listApiKeys', () => {
  it('returns empty array when no keys exist', async () => {
    const mockOrderBy = vi.fn().mockResolvedValue([])
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy })

    const result = await listApiKeys(PROJECT_ID)

    expect(result).toEqual([])
  })

  it('serializes Date fields to ISO strings', async () => {
    const now = new Date('2025-06-15T10:00:00Z')
    const mockOrderBy = vi.fn().mockResolvedValue([
      {
        id: 'key-list-1',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        name: 'Key 1',
        key_prefix: 'hiss_AAAAAA',
        last_used_at: now,
        expires_at: null,
        revoked_at: null,
        created_at: now,
      },
    ])
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy })

    const result = await listApiKeys(PROJECT_ID)

    expect(result).toHaveLength(1)
    expect(result[0].last_used_at).toBe('2025-06-15T10:00:00.000Z')
    expect(result[0].created_at).toBe('2025-06-15T10:00:00.000Z')
    expect(result[0].expires_at).toBeNull()
    expect(result[0].revoked_at).toBeNull()
  })

  it('handles multiple keys with mixed null/set dates', async () => {
    const date1 = new Date('2025-01-01T00:00:00Z')
    const date2 = new Date('2025-06-01T00:00:00Z')
    const mockOrderBy = vi.fn().mockResolvedValue([
      {
        id: 'key-a',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        name: 'Active',
        key_prefix: 'hiss_A',
        last_used_at: date1,
        expires_at: date2,
        revoked_at: null,
        created_at: date1,
      },
      {
        id: 'key-b',
        project_id: PROJECT_ID,
        created_by_user_id: USER_ID,
        name: 'Revoked',
        key_prefix: 'hiss_B',
        last_used_at: null,
        expires_at: null,
        revoked_at: date2,
        created_at: date1,
      },
    ])
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy })

    const result = await listApiKeys(PROJECT_ID)

    expect(result).toHaveLength(2)
    expect(result[0].revoked_at).toBeNull()
    expect(result[0].expires_at).toBe('2025-06-01T00:00:00.000Z')
    expect(result[1].revoked_at).toBe('2025-06-01T00:00:00.000Z')
    expect(result[1].last_used_at).toBeNull()
  })
})
