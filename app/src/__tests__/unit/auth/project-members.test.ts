/**
 * Project Members Tests
 *
 * Tests addProjectMember, removeProjectMember, updateMemberRole,
 * isProjectMember, hasProjectRole, transferOwnership.
 *
 * Focuses on:
 *   - Last-owner protection (cannot remove or demote the last owner)
 *   - Member-not-found errors
 *   - Unique constraint violation handling
 *   - Transfer ownership edge cases
 *   - Access/role boolean checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS - Queue-based to handle multiple independent db.select() calls
// ============================================================================

/**
 * Each db.select() call creates a fresh chain. We use a queue to control
 * what each successive select chain returns. Each entry describes:
 *   - hasLimit: whether the chain ends with .limit() (single-row lookup)
 *               or resolves directly from .where() (count queries)
 *   - result: the array to resolve with
 */
interface SelectQueueEntry {
  hasLimit: boolean
  result: unknown[]
}

const selectQueue: SelectQueueEntry[] = []

function enqueueSelect(result: unknown[], hasLimit = true) {
  selectQueue.push({ hasLimit, result })
}

const mockDbSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(function () {
      const entry = selectQueue.shift()
      if (!entry) {
        throw new Error('Unexpected db.select() call - selectQueue is empty')
      }
      if (entry.hasLimit) {
        // Caller will chain .limit(1) then await
        return {
          limit: vi.fn().mockResolvedValue(entry.result),
        }
      }
      // Count queries: caller awaits .where() directly (no .limit())
      // Return a thenable that resolves to the result
      const promise = Promise.resolve(entry.result)
      return Object.assign(promise, {
        limit: vi.fn().mockResolvedValue(entry.result),
      })
    }),
    orderBy: vi.fn(),
  })),
}))

// Insert chain: db.insert().values().returning()
const mockInsertReturning = vi.fn()
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }))
const mockInsert = vi.fn(() => ({ values: mockInsertValues }))

// Update chain: db.update().set().where().returning()
const mockUpdateReturning = vi.fn()
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }))
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }))
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }))

// Delete chain: db.delete().where().returning()
const mockDeleteReturning = vi.fn()
const mockDeleteWhere = vi.fn(() => ({ returning: mockDeleteReturning }))
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }))

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

vi.mock('@/lib/db/schema/app', () => ({
  projectMembers: {
    id: 'id',
    project_id: 'project_id',
    user_id: 'user_id',
    role: 'role',
    status: 'status',
    invited_email: 'invited_email',
    invited_by_user_id: 'invited_by_user_id',
    created_at: 'created_at',
    updated_at: 'updated_at',
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
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  asc: vi.fn((...args: unknown[]) => ({ type: 'asc', args })),
  inArray: vi.fn((...args: unknown[]) => ({ type: 'inArray', args })),
  count: vi.fn(() => 'count_fn'),
}))

// ============================================================================
// IMPORT UNDER TEST
// ============================================================================

import {
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
  isProjectMember,
  hasProjectRole,
  transferOwnership,
} from '@/lib/auth/project-members'

// ============================================================================
// HELPERS
// ============================================================================

const PROJECT_ID = 'proj-test-001'
const USER_ID = 'user-001'
const MEMBER_ID = 'member-001'

beforeEach(() => {
  vi.clearAllMocks()
  selectQueue.length = 0
})

// ============================================================================
// isProjectMember
// ============================================================================

describe('isProjectMember', () => {
  it('returns true when user is an active member', async () => {
    enqueueSelect([{ id: MEMBER_ID }], true)

    const result = await isProjectMember(PROJECT_ID, USER_ID)

    expect(result).toBe(true)
  })

  it('returns false when user is not a member', async () => {
    enqueueSelect([], true)

    const result = await isProjectMember(PROJECT_ID, USER_ID)

    expect(result).toBe(false)
  })
})

// ============================================================================
// hasProjectRole
// ============================================================================

describe('hasProjectRole', () => {
  it('returns true when user has the specified role', async () => {
    enqueueSelect([{ id: MEMBER_ID }], true)

    const result = await hasProjectRole(PROJECT_ID, USER_ID, 'owner')

    expect(result).toBe(true)
  })

  it('returns false when user does not have the specified role', async () => {
    enqueueSelect([], true)

    const result = await hasProjectRole(PROJECT_ID, USER_ID, 'owner')

    expect(result).toBe(false)
  })

  it('returns false when user is not a member at all', async () => {
    enqueueSelect([], true)

    const result = await hasProjectRole(PROJECT_ID, 'nonexistent-user', 'member')

    expect(result).toBe(false)
  })
})

// ============================================================================
// addProjectMember
// ============================================================================

describe('addProjectMember', () => {
  it('creates a member and returns its id', async () => {
    mockInsertReturning.mockResolvedValue([{ id: 'new-member-id' }])

    const result = await addProjectMember({
      projectId: PROJECT_ID,
      userId: USER_ID,
      role: 'member',
    })

    expect(result).toEqual({ id: 'new-member-id' })
    expect(mockInsert).toHaveBeenCalled()
  })

  it('throws when insert returns no data', async () => {
    mockInsertReturning.mockResolvedValue([])

    await expect(
      addProjectMember({ projectId: PROJECT_ID, userId: USER_ID }),
    ).rejects.toThrow('Failed to add project member.')
  })

  it('throws user-friendly message on unique constraint violation (code 23505)', async () => {
    const dbError = new Error('duplicate key value violates unique constraint')
    ;(dbError as unknown as Record<string, string>).code = '23505'
    mockInsertReturning.mockRejectedValue(dbError)

    await expect(
      addProjectMember({ projectId: PROJECT_ID, userId: USER_ID }),
    ).rejects.toThrow('User is already a member of this project.')
  })

  it('throws generic message on other database errors', async () => {
    mockInsertReturning.mockRejectedValue(new Error('connection refused'))

    await expect(
      addProjectMember({ projectId: PROJECT_ID, userId: USER_ID }),
    ).rejects.toThrow('Failed to add project member.')
  })
})

// ============================================================================
// removeProjectMember
// ============================================================================

describe('removeProjectMember', () => {
  it('throws when member is not found', async () => {
    // member lookup -> empty
    enqueueSelect([], true)

    await expect(removeProjectMember(PROJECT_ID, MEMBER_ID)).rejects.toThrow(
      'Member not found.',
    )
  })

  it('throws when trying to remove the last owner', async () => {
    // 1st select: member lookup -> owner
    enqueueSelect([{ role: 'owner' }], true)
    // 2nd select: owner count (no .limit()) -> count=1
    enqueueSelect([{ count: 1 }], false)

    await expect(removeProjectMember(PROJECT_ID, MEMBER_ID)).rejects.toThrow(
      'Cannot remove the last owner of a project.',
    )
  })

  it('removes a non-owner member successfully', async () => {
    // member lookup -> regular member
    enqueueSelect([{ role: 'member' }], true)
    // delete returns result
    mockDeleteReturning.mockResolvedValue([{ id: MEMBER_ID }])

    await expect(removeProjectMember(PROJECT_ID, MEMBER_ID)).resolves.toBeUndefined()
    expect(mockDelete).toHaveBeenCalled()
  })

  it('removes an owner when there are multiple owners', async () => {
    // member lookup -> owner
    enqueueSelect([{ role: 'owner' }], true)
    // owner count -> 2
    enqueueSelect([{ count: 2 }], false)
    // delete returns result
    mockDeleteReturning.mockResolvedValue([{ id: MEMBER_ID }])

    await expect(removeProjectMember(PROJECT_ID, MEMBER_ID)).resolves.toBeUndefined()
    expect(mockDelete).toHaveBeenCalled()
  })

  it('throws when delete returns empty result', async () => {
    // member lookup
    enqueueSelect([{ role: 'member' }], true)
    // delete returns empty
    mockDeleteReturning.mockResolvedValue([])

    await expect(removeProjectMember(PROJECT_ID, MEMBER_ID)).rejects.toThrow(
      'Failed to remove project member.',
    )
  })
})

// ============================================================================
// updateMemberRole
// ============================================================================

describe('updateMemberRole', () => {
  it('throws when member is not found', async () => {
    enqueueSelect([], true)

    await expect(updateMemberRole(PROJECT_ID, MEMBER_ID, 'owner')).rejects.toThrow(
      'Member not found.',
    )
  })

  it('throws when demoting the last owner', async () => {
    // member lookup -> owner
    enqueueSelect([{ role: 'owner' }], true)
    // owner count -> 1
    enqueueSelect([{ count: 1 }], false)

    await expect(updateMemberRole(PROJECT_ID, MEMBER_ID, 'member')).rejects.toThrow(
      'Cannot demote the last owner of a project.',
    )
  })

  it('allows demoting an owner when there are multiple owners', async () => {
    // member lookup -> owner
    enqueueSelect([{ role: 'owner' }], true)
    // owner count -> 3
    enqueueSelect([{ count: 3 }], false)
    // update returns result
    mockUpdateReturning.mockResolvedValue([{ id: MEMBER_ID }])

    await expect(updateMemberRole(PROJECT_ID, MEMBER_ID, 'member')).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('allows promoting a member to owner without checking owner count', async () => {
    // member lookup -> member (not owner), so no count check
    enqueueSelect([{ role: 'member' }], true)
    // update returns result
    mockUpdateReturning.mockResolvedValue([{ id: MEMBER_ID }])

    await expect(updateMemberRole(PROJECT_ID, MEMBER_ID, 'owner')).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('no-ops role check when setting owner to owner (no demotion)', async () => {
    // member lookup -> already owner, newRole is also owner, no demotion check
    enqueueSelect([{ role: 'owner' }], true)
    // update returns result
    mockUpdateReturning.mockResolvedValue([{ id: MEMBER_ID }])

    await expect(updateMemberRole(PROJECT_ID, MEMBER_ID, 'owner')).resolves.toBeUndefined()
  })

  it('throws when update returns empty result', async () => {
    // member lookup
    enqueueSelect([{ role: 'member' }], true)
    // update returns empty
    mockUpdateReturning.mockResolvedValue([])

    await expect(updateMemberRole(PROJECT_ID, MEMBER_ID, 'owner')).rejects.toThrow(
      'Failed to update member role.',
    )
  })
})

// ============================================================================
// transferOwnership
// ============================================================================

describe('transferOwnership', () => {
  const FROM_USER = 'user-from'
  const TO_USER = 'user-to'

  it('throws when target user is not an active member', async () => {
    // target member lookup -> empty
    enqueueSelect([], true)

    await expect(
      transferOwnership(PROJECT_ID, FROM_USER, TO_USER),
    ).rejects.toThrow('Target user is not an active member of this project.')
  })

  it('promotes target and demotes source when multiple owners exist after promotion', async () => {
    // target member lookup -> found
    enqueueSelect([{ id: 'target-member-id' }], true)
    // promote target: db.update().set().where() (first update)
    mockUpdateWhere.mockReturnValueOnce(Promise.resolve(undefined))
    // owner count after promotion -> 2
    enqueueSelect([{ count: 2 }], false)
    // demote source: db.update().set().where() (second update)
    mockUpdateWhere.mockReturnValueOnce(Promise.resolve(undefined))

    await expect(
      transferOwnership(PROJECT_ID, FROM_USER, TO_USER),
    ).resolves.toBeUndefined()

    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('does not demote source when they would be the only owner (count <= 1)', async () => {
    // target member lookup -> found
    enqueueSelect([{ id: 'target-member-id' }], true)
    // promote target
    mockUpdateWhere.mockReturnValueOnce(Promise.resolve(undefined))
    // owner count -> 1 (only newly promoted target)
    enqueueSelect([{ count: 1 }], false)

    await expect(
      transferOwnership(PROJECT_ID, FROM_USER, TO_USER),
    ).resolves.toBeUndefined()

    // Only one update (promote), no demote
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})
