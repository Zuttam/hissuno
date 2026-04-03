import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockReturning = vi.fn()
const mockWhere = vi.fn((_condition?: unknown) => ({ returning: mockReturning }))
const mockSet = vi.fn(() => ({ where: mockWhere }))
const mockUpdate = vi.fn((..._args: any[]) => ({ set: mockSet }))

vi.mock('@/lib/db', () => ({
  db: {
    update: (...args: any[]) => mockUpdate(...args),
  },
}))

vi.mock('@/lib/db/errors', () => ({
  isUniqueViolation: () => false,
}))

vi.mock('@/lib/db/schema/app', () => ({
  projectMembers: {
    status: 'status',
    user_id: 'user_id',
    invited_email: 'invited_email',
    id: 'id',
    project_id: 'project_id',
    role: 'role',
    invited_by_user_id: 'invited_by_user_id',
    created_at: 'created_at',
    updated_at: 'updated_at',
    $inferInsert: {},
  },
  userProfiles: {
    user_id: 'user_id',
    full_name: 'full_name',
  },
}))

vi.mock('@/lib/db/schema/auth', () => ({
  users: {
    id: 'id',
    email: 'email',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  or: (...args: unknown[]) => ({ op: 'or', args }),
  asc: (col: unknown) => ({ op: 'asc', col }),
  inArray: (col: unknown, vals: unknown[]) => ({ op: 'inArray', col, vals }),
  count: () => ({ op: 'count' }),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { activatePendingMemberships } = await import('@/lib/auth/project-members')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('activatePendingMemberships', () => {
  it('returns 0 when no pending memberships exist', async () => {
    mockReturning.mockResolvedValue([])

    const count = await activatePendingMemberships('user-1', 'test@example.com')

    expect(count).toBe(0)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('returns the count of activated memberships', async () => {
    mockReturning.mockResolvedValue([{ id: 'member-1' }, { id: 'member-2' }])

    const count = await activatePendingMemberships('user-1', 'test@example.com')

    expect(count).toBe(2)
  })

  it('sets status to active and assigns user_id', async () => {
    mockReturning.mockResolvedValue([{ id: 'member-1' }])

    await activatePendingMemberships('user-1', 'test@example.com')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'active',
        user_id: 'user-1',
      })
    )
  })

  it('lowercases the email for matching', async () => {
    mockReturning.mockResolvedValue([])

    await activatePendingMemberships('user-1', 'Test@Example.COM')

    // The where clause should use the lowercased email
    const whereArg = mockWhere.mock.calls[0][0] as { args: { op: string; col?: string; val?: unknown; args?: { op: string; col?: string; val?: unknown }[] }[] }
    // Find the or() clause that contains the email eq()
    const orClause = whereArg.args.find((a) => a.op === 'or')!
    const emailEq = orClause.args!.find(
      (a) => a.op === 'eq' && a.col === 'invited_email'
    )
    expect(emailEq!.val).toBe('test@example.com')
  })

  it('propagates errors (not swallowed)', async () => {
    mockReturning.mockRejectedValue(new Error('DB error'))

    await expect(
      activatePendingMemberships('user-1', 'test@example.com')
    ).rejects.toThrow('DB error')
  })
})
