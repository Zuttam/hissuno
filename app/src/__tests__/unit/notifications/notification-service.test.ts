/**
 * Notification Service Tests
 *
 * Tests hasNotificationBeenSent, recordNotification, shouldSendNotification,
 * getUserEmail, and getUserProfile.
 * Mocks @/lib/db for database chain calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS
// ============================================================================

// Chain-style mock: db.select().from().where().limit()
const mockLimit = vi.fn()
const mockWhere = vi.fn(() => ({ limit: mockLimit }))
const mockLeftJoin = vi.fn(() => ({ where: mockWhere }))
const mockFrom = vi.fn(() => ({ where: mockWhere, leftJoin: mockLeftJoin }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDbSelect = vi.fn<(...args: any[]) => any>(() => ({ from: mockFrom }))

// Insert chain: db.insert().values().returning()
const mockReturning = vi.fn()
const mockValues = vi.fn(() => ({ returning: mockReturning }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInsert = vi.fn<(...args: any[]) => any>(() => ({ values: mockValues }))

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}))

vi.mock('@/lib/db/errors', () => ({
  isUniqueViolation: vi.fn((err: unknown) => {
    return err instanceof Error && 'code' in err && (err as { code: string }).code === '23505'
  }),
}))

vi.mock('@/lib/db/schema/app', () => ({
  userNotifications: {
    id: 'id',
    user_id: 'user_id',
    type: 'type',
    channel: 'channel',
    metadata: 'metadata',
    dedup_key: 'dedup_key',
    project_id: 'project_id',
  },
  userProfiles: {
    user_id: 'user_id',
    notifications_silenced: 'notifications_silenced',
    notification_preferences: 'notification_preferences',
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
}))

// ============================================================================
// IMPORT UNDER TEST
// ============================================================================

import {
  hasNotificationBeenSent,
  recordNotification,
  shouldSendNotification,
  getUserEmail,
  getUserProfile,
} from '@/lib/notifications/notification-service'

// ============================================================================
// HELPERS
// ============================================================================

const USER_ID = 'user-123'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// hasNotificationBeenSent
// ============================================================================

describe('hasNotificationBeenSent', () => {
  it('returns true when notification record is found', async () => {
    mockLimit.mockResolvedValue([{ id: 'notif-1' }])

    const result = await hasNotificationBeenSent(USER_ID, 'dedup:session:abc')

    expect(result).toBe(true)
  })

  it('returns false when no notification record is found', async () => {
    mockLimit.mockResolvedValue([])

    const result = await hasNotificationBeenSent(USER_ID, 'dedup:session:xyz')

    expect(result).toBe(false)
  })
})

// ============================================================================
// recordNotification
// ============================================================================

describe('recordNotification', () => {
  it('inserts notification record and returns success with id', async () => {
    mockReturning.mockResolvedValue([{ id: 'new-notif-id' }])

    const result = await recordNotification({
      userId: USER_ID,
      type: 'human_needed',
      channel: 'email',
      metadata: { session_id: 's-1' },
    })

    expect(result.success).toBe(true)
    expect(result.notificationId).toBe('new-notif-id')
    expect(result.skipped).toBeUndefined()
    expect(mockInsert).toHaveBeenCalled()
  })

  it('skips insert when dedup key already exists', async () => {
    mockLimit.mockResolvedValue([{ id: 'existing-notif' }])

    const result = await recordNotification({
      userId: USER_ID,
      type: 'human_needed',
      dedupKey: 'human_needed:session:abc',
    })

    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('handles dedup key that has not been sent yet', async () => {
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([{ id: 'fresh-notif' }])

    const result = await recordNotification({
      userId: USER_ID,
      type: 'human_needed',
      dedupKey: 'human_needed:session:new',
    })

    expect(result.success).toBe(true)
    expect(result.notificationId).toBe('fresh-notif')
  })

  it('handles unique constraint violation gracefully', async () => {
    mockReturning.mockRejectedValue(
      Object.assign(new Error('unique violation'), { code: '23505' })
    )

    const result = await recordNotification({
      userId: USER_ID,
      type: 'human_needed',
    })

    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
  })

  it('returns failure for non-unique errors', async () => {
    mockReturning.mockRejectedValue(new Error('connection timeout'))

    const result = await recordNotification({
      userId: USER_ID,
      type: 'human_needed',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('connection timeout')
  })

  it('returns failure when insert returns no data', async () => {
    mockReturning.mockResolvedValue([])

    const result = await recordNotification({
      userId: USER_ID,
      type: 'human_needed',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to insert')
  })
})

// ============================================================================
// shouldSendNotification
// ============================================================================

describe('shouldSendNotification', () => {
  it('returns false when notifications are silenced', async () => {
    mockLimit.mockResolvedValue([{
      notifications_silenced: true,
      notification_preferences: null,
    }])

    const result = await shouldSendNotification(USER_ID, 'human_needed', 'email')

    expect(result).toBe(false)
  })

  it('respects per-type email preference set to false', async () => {
    mockLimit.mockResolvedValue([{
      notifications_silenced: false,
      notification_preferences: {
        human_needed: { email: false, slack: true },
      },
    }])

    const result = await shouldSendNotification(USER_ID, 'human_needed', 'email')

    expect(result).toBe(false)
  })

  it('respects per-type slack preference set to true', async () => {
    mockLimit.mockResolvedValue([{
      notifications_silenced: false,
      notification_preferences: {
        human_needed: { email: false, slack: true },
      },
    }])

    const result = await shouldSendNotification(USER_ID, 'human_needed', 'slack')

    expect(result).toBe(true)
  })

  it('defaults to email=true for missing profile', async () => {
    mockLimit.mockResolvedValue([])

    const result = await shouldSendNotification(USER_ID, 'human_needed', 'email')

    expect(result).toBe(true)
  })

  it('defaults to slack=false for missing profile', async () => {
    mockLimit.mockResolvedValue([])

    const result = await shouldSendNotification(USER_ID, 'human_needed', 'slack')

    expect(result).toBe(false)
  })

  it('returns true for email when type preferences resolved from defaults', async () => {
    mockLimit.mockResolvedValue([{
      notifications_silenced: false,
      notification_preferences: null,
    }])

    const result = await shouldSendNotification(USER_ID, 'weekly_digest', 'email')

    expect(result).toBe(true)
  })
})

// ============================================================================
// getUserEmail
// ============================================================================

describe('getUserEmail', () => {
  it('returns email when user is found', async () => {
    mockLimit.mockResolvedValue([{ email: 'test@example.com' }])

    const result = await getUserEmail(USER_ID)

    expect(result).toBe('test@example.com')
  })

  it('returns null when user is not found', async () => {
    mockLimit.mockResolvedValue([])

    const result = await getUserEmail('nonexistent-user')

    expect(result).toBeNull()
  })
})

// ============================================================================
// getUserProfile
// ============================================================================

describe('getUserProfile', () => {
  it('returns email and full name when user is found', async () => {
    mockWhere.mockReturnValueOnce({
      limit: vi.fn().mockResolvedValue([{ email: 'test@example.com', fullName: 'Test User' }]),
    })

    const result = await getUserProfile(USER_ID)

    expect(result).toEqual({ email: 'test@example.com', fullName: 'Test User' })
  })

  it('returns null values when user is not found', async () => {
    mockWhere.mockReturnValueOnce({
      limit: vi.fn().mockResolvedValue([]),
    })

    const result = await getUserProfile('nonexistent-user')

    expect(result).toEqual({ email: null, fullName: null })
  })
})
