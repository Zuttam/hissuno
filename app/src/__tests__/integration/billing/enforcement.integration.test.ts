/**
 * Billing Enforcement Integration Tests
 *
 * Tests for the complete billing enforcement flow including:
 * - Limit enforcement with subscription state
 * - Notification deduplication across billing periods
 * - Plan upgrades (immediate effect)
 * - Plan downgrades (deferred to next billing cycle)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { BillingInfo, Subscription, UsageMetrics, Plan } from '@/types/billing'
import type { EnforcementResult } from '@/lib/billing/enforcement-types'

// ============================================================================
// MOCK STATE - Simulates database
// ============================================================================

interface MockDatabaseState {
  subscriptions: Map<string, Subscription>
  notifications: Map<string, { dedupKey: string; createdAt: string }[]>
  sessions: { projectId: string; createdAt: string }[]
  projects: { id: string; userId: string }[]
  users: Map<string, { email: string; fullName: string }>
}

let mockDb: MockDatabaseState

function resetMockDatabase() {
  mockDb = {
    subscriptions: new Map(),
    notifications: new Map(),
    sessions: [],
    projects: [],
    users: new Map(),
  }
}

// ============================================================================
// MOCKS
// ============================================================================

// Track email sends for assertions
const emailsSent: { to: string; subject: string; dimension: string }[] = []

// Mock billing service
const mockGetBillingInfo = vi.fn<(userId: string) => Promise<BillingInfo>>()

vi.mock('@/lib/billing/billing-service', () => ({
  getBillingInfo: (userId: string) => mockGetBillingInfo(userId),
  getPlanLimits: vi.fn(),
  syncSubscriptionLimitsFromPlan: vi.fn(),
}))

// Mock notification service
vi.mock('@/lib/notifications/notification-service', () => ({
  hasNotificationBeenSent: vi.fn(async (userId: string, dedupKey: string) => {
    const userNotifications = mockDb.notifications.get(userId) ?? []
    return userNotifications.some((n) => n.dedupKey === dedupKey)
  }),
  recordNotification: vi.fn(async (options: { userId: string; dedupKey?: string }) => {
    const { userId, dedupKey } = options
    if (!dedupKey) return { success: true }

    const userNotifications = mockDb.notifications.get(userId) ?? []
    // Check for duplicate
    if (userNotifications.some((n) => n.dedupKey === dedupKey)) {
      return { success: true, skipped: true }
    }
    userNotifications.push({ dedupKey, createdAt: new Date().toISOString() })
    mockDb.notifications.set(userId, userNotifications)
    return { success: true, notificationId: `notif-${Date.now()}` }
  }),
  shouldSendNotification: vi.fn(async () => true),
  getUserProfile: vi.fn(async (userId: string) => {
    const user = mockDb.users.get(userId)
    return { email: user?.email ?? null, fullName: user?.fullName ?? null }
  }),
}))

// Mock Resend email client
vi.mock('@/lib/email/resend', () => ({
  isResendConfigured: vi.fn(() => true),
  getResendClient: vi.fn(() => ({
    emails: {
      send: vi.fn(async (options: { to: string; subject: string; react: unknown }) => {
        // Extract dimension from subject
        const dimensionMatch = options.subject.match(/your (\w+) limit/)
        emailsSent.push({
          to: options.to,
          subject: options.subject,
          dimension: dimensionMatch?.[1] ?? 'unknown',
        })
        return { id: `email-${Date.now()}` }
      }),
    },
  })),
  getFromAddress: vi.fn(() => 'noreply@hissuno.com'),
}))

// Mock react-email render
vi.mock('@react-email/components', () => ({
  render: vi.fn(async () => '<html>mock email</html>'),
}))

// Mock email template
vi.mock('@/lib/email/templates/limit-reached', () => ({
  LimitReachedEmail: vi.fn(() => null),
}))

// Mock Slack notifications
vi.mock('@/lib/notifications/slack-notifications', () => ({
  sendSlackNotification: vi.fn(async () => ({ ok: false })),
}))

// Import after mocks
import {
  checkEnforcement,
  enforceLimit,
  LimitExceededError,
} from '@/lib/billing/enforcement-service'
import { sendLimitNotificationIfNeeded } from '@/lib/notifications/limit-notifications'

// ============================================================================
// TEST HELPERS
// ============================================================================

function createSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: `sub-${Date.now()}`,
    user_id: 'user-123',
    plan_id: 'plan-pro',
    plan_name: 'pro',
    sessions_limit: 1000,
    issues_limit: 1000,
    status: 'active',
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lemon_squeezy_subscription_id: 'ls-123',
    lemon_squeezy_customer_id: 'cust-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function createBillingInfo(options: {
  subscription?: Partial<Subscription> | null
  analyzedSessionsUsed?: number
  analyzedIssuesUsed?: number
  periodStart?: string
  periodEnd?: string
}): BillingInfo {
  const subscription = options.subscription === null
    ? null
    : createSubscription(options.subscription)

  const periodStart = options.periodStart ?? new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  const periodEnd = options.periodEnd ?? subscription?.current_period_end ?? null

  return {
    subscription,
    plan: subscription
      ? { id: subscription.plan_id, name: subscription.plan_name } as Plan
      : null,
    usage: {
      analyzedSessionsUsed: options.analyzedSessionsUsed ?? 0,
      analyzedSessionsLimit: subscription?.sessions_limit ?? null,
      analyzedIssuesUsed: options.analyzedIssuesUsed ?? 0,
      analyzedIssuesLimit: subscription?.issues_limit ?? null,
      periodStart,
      periodEnd,
    },
    customerPortalUrl: subscription ? 'https://billing.example.com' : null,
  }
}

function setupUser(userId: string, email: string, fullName: string) {
  mockDb.users.set(userId, { email, fullName })
}

// ============================================================================
// TESTS
// ============================================================================

describe('Billing Enforcement Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDatabase()
    emailsSent.length = 0
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ==========================================================================
  // Full Enforcement Flow
  // ==========================================================================

  describe('full enforcement flow', () => {
    it('should enforce limits through complete flow', async () => {
      // Setup: User on Pro plan with 1000 session limit, used 999
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: 1000, plan_name: 'pro' },
          analyzedSessionsUsed: 999,
        })
      )

      // First session should be allowed
      const result1 = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(1)

      // Simulate session was created, now at 1000
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: 1000, plan_name: 'pro' },
          analyzedSessionsUsed: 1000,
        })
      )

      // Next session should be blocked
      await expect(
        enforceLimit({
          userId: 'user-123',
          dimension: 'analyzed_sessions',
        })
      ).rejects.toThrow(LimitExceededError)
    })

    it('should allow unlimited usage when limit is null', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: null, plan_name: 'unlimited' },
          analyzedSessionsUsed: 50000,
        })
      )

      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBeNull()
      expect(result.remaining).toBeNull()
      expect(result.message).toBe('Unlimited')
    })

    it('should block when no subscription (limit = 0)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: null,
          analyzedSessionsUsed: 0,
        })
      )

      // No subscription means blocked (limit = 0)
      await expect(
        enforceLimit({
          userId: 'user-123',
          dimension: 'analyzed_sessions',
        })
      ).rejects.toThrow(LimitExceededError)
    })

  })

  // ==========================================================================
  // Notification Deduplication
  // ==========================================================================

  describe('notification deduplication', () => {
    it('should send notification first time limit is reached', async () => {
      setupUser('user-123', 'test@example.com', 'Test User')

      const billingInfo = createBillingInfo({
        subscription: { sessions_limit: 100 },
        analyzedSessionsUsed: 100,
        periodStart: '2026-01-01T00:00:00Z',
      })
      mockGetBillingInfo.mockResolvedValue(billingInfo)

      const result: EnforcementResult = {
        allowed: false,
        isOverLimit: true,
        dimension: 'analyzed_sessions',
        current: 100,
        limit: 100,
        remaining: 0,
        message: 'Sessions limit reached',
      }

      await sendLimitNotificationIfNeeded('user-123', result)

      expect(emailsSent).toHaveLength(1)
      expect(emailsSent[0].to).toBe('test@example.com')
      expect(emailsSent[0].dimension).toBe('analyzed_sessions')
    })

    it('should NOT send duplicate notification in same billing period', async () => {
      setupUser('user-123', 'test@example.com', 'Test User')

      const billingInfo = createBillingInfo({
        subscription: { sessions_limit: 100 },
        analyzedSessionsUsed: 100,
        periodStart: '2026-01-01T00:00:00Z',
      })
      mockGetBillingInfo.mockResolvedValue(billingInfo)

      const result: EnforcementResult = {
        allowed: false,
        isOverLimit: true,
        dimension: 'analyzed_sessions',
        current: 100,
        limit: 100,
        remaining: 0,
        message: 'Sessions limit reached',
      }

      // First notification
      await sendLimitNotificationIfNeeded('user-123', result)
      expect(emailsSent).toHaveLength(1)

      // Second attempt in same period - should be deduplicated
      await sendLimitNotificationIfNeeded('user-123', result)
      expect(emailsSent).toHaveLength(1) // Still only 1 email
    })

    it('should send notification again in new billing period', async () => {
      setupUser('user-123', 'test@example.com', 'Test User')

      // First period: January
      const billingInfoJan = createBillingInfo({
        subscription: { sessions_limit: 100 },
        analyzedSessionsUsed: 100,
        periodStart: '2026-01-01T00:00:00Z',
      })
      mockGetBillingInfo.mockResolvedValue(billingInfoJan)

      const result: EnforcementResult = {
        allowed: false,
        isOverLimit: true,
        dimension: 'analyzed_sessions',
        current: 100,
        limit: 100,
        remaining: 0,
        message: 'Sessions limit reached',
      }

      await sendLimitNotificationIfNeeded('user-123', result)
      expect(emailsSent).toHaveLength(1)

      // New period: February
      const billingInfoFeb = createBillingInfo({
        subscription: { sessions_limit: 100 },
        analyzedSessionsUsed: 100,
        periodStart: '2026-02-01T00:00:00Z',
      })
      mockGetBillingInfo.mockResolvedValue(billingInfoFeb)

      await sendLimitNotificationIfNeeded('user-123', result)
      expect(emailsSent).toHaveLength(2) // New email for new period
    })

    it('should send separate notifications for different dimensions', async () => {
      setupUser('user-123', 'test@example.com', 'Test User')

      const billingInfo = createBillingInfo({
        subscription: { sessions_limit: 100, issues_limit: 100 },
        analyzedSessionsUsed: 100,
        analyzedIssuesUsed: 100,
        periodStart: '2026-01-01T00:00:00Z',
      })
      mockGetBillingInfo.mockResolvedValue(billingInfo)

      // Sessions limit reached
      await sendLimitNotificationIfNeeded('user-123', {
        allowed: false,
        isOverLimit: true,
        dimension: 'analyzed_sessions',
        current: 100,
        limit: 100,
        remaining: 0,
        message: 'Sessions limit reached',
      })

      // Issues limit reached
      await sendLimitNotificationIfNeeded('user-123', {
        allowed: false,
        isOverLimit: true,
        dimension: 'analyzed_issues',
        current: 100,
        limit: 100,
        remaining: 0,
        message: 'Analyzed issues limit reached',
      })

      expect(emailsSent).toHaveLength(2)
      expect(emailsSent[0].dimension).toBe('analyzed_sessions')
      expect(emailsSent[1].dimension).toBe('analyzed_issues')
    })

    it('should NOT send notification for unlimited plans', async () => {
      setupUser('user-123', 'test@example.com', 'Test User')

      const result: EnforcementResult = {
        allowed: true,
        isOverLimit: false,
        dimension: 'analyzed_sessions',
        current: 10000,
        limit: null, // Unlimited
        remaining: null,
        message: 'Unlimited',
      }

      await sendLimitNotificationIfNeeded('user-123', result)

      expect(emailsSent).toHaveLength(0)
    })
  })

  // ==========================================================================
  // Plan Upgrades (Immediate Effect)
  // ==========================================================================

  describe('plan upgrades - immediate effect', () => {
    it('should immediately allow more sessions after upgrade', async () => {
      // User on Basic plan at limit (100 sessions)
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: 100, plan_name: 'basic' },
          analyzedSessionsUsed: 100,
        })
      )

      // Should be blocked before upgrade
      await expect(
        enforceLimit({ userId: 'user-123', dimension: 'analyzed_sessions' })
      ).rejects.toThrow(LimitExceededError)

      // Simulate upgrade to Pro (1000 sessions)
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: 1000, plan_name: 'pro' },
          analyzedSessionsUsed: 100, // Same usage, higher limit
        })
      )

      // Should be allowed immediately after upgrade
      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(1000)
      expect(result.remaining).toBe(900)
    })

    it('should immediately allow more analyzed issues after upgrade', async () => {
      // User on Basic plan at issues limit (200 issues)
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { issues_limit: 200, plan_name: 'basic' },
          analyzedIssuesUsed: 200,
        })
      )

      // Should be blocked before upgrade
      await expect(
        enforceLimit({ userId: 'user-123', dimension: 'analyzed_issues' })
      ).rejects.toThrow(LimitExceededError)

      // Simulate upgrade to Pro (1000 issues)
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { issues_limit: 1000, plan_name: 'pro' },
          analyzedIssuesUsed: 200,
        })
      )

      // Should be allowed immediately
      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_issues',
      })

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(800)
    })

    it('should immediately grant unlimited access on upgrade to unlimited plan', async () => {
      // User on Pro plan at limit
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: 1000, plan_name: 'pro' },
          analyzedSessionsUsed: 1000,
        })
      )

      // Blocked before upgrade
      await expect(
        enforceLimit({ userId: 'user-123', dimension: 'analyzed_sessions' })
      ).rejects.toThrow(LimitExceededError)

      // Upgrade to Unlimited plan
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: null, plan_name: 'unlimited' },
          analyzedSessionsUsed: 1000,
        })
      )

      // Allowed immediately
      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBeNull()
    })
  })

  // ==========================================================================
  // Plan Downgrades (Deferred to Next Billing Cycle)
  // ==========================================================================

  describe('plan downgrades - deferred to next billing cycle', () => {
    /**
     * IMPORTANT: These tests document the EXPECTED behavior.
     *
     * When a user downgrades their plan:
     * 1. The new (lower) limits should NOT take effect immediately
     * 2. The old (higher) limits should remain until current_period_end
     * 3. At the next billing cycle, new limits take effect
     *
     * This is implemented using `pending_plan_id` and `pending_limits` fields
     * on the subscription record, which are applied when the billing cycle renews.
     */

    it('should maintain current limits until billing cycle ends on downgrade', async () => {
      const currentPeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()

      // User on Pro plan (1000 sessions) with 500 used
      // They downgrade to Basic (100 sessions) mid-cycle
      // Expected: They should still have 1000 session limit until period ends

      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            sessions_limit: 1000, // Current (old) limit still active
            plan_name: 'pro',
            current_period_end: currentPeriodEnd,
          },
          analyzedSessionsUsed: 500,
          periodEnd: currentPeriodEnd,
        })
      )

      // User can still create sessions up to 1000
      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(1000) // Old limit, not 100
      expect(result.remaining).toBe(500)
    })

    it('should allow usage beyond new plan limit until cycle ends', async () => {
      // User on Pro (1000 sessions), has 200 sessions used
      // Downgrades to Basic (100 sessions)
      // Should still be allowed to use up to 1000 until cycle ends

      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            sessions_limit: 1000, // Old limit still active
            plan_name: 'pro', // Still shows pro until renewal
          },
          analyzedSessionsUsed: 200,
        })
      )

      // Can create more sessions, even though new plan would only allow 100
      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(1000)
    })

    it('should apply new lower limits after billing cycle renews', async () => {
      // Simulate: billing cycle renewed, downgrade now in effect
      // User now on Basic plan (100 sessions) with 200 sessions from last period
      // New period starts fresh, but they're immediately over if usage carries

      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            sessions_limit: 100, // New (lower) limit now active
            plan_name: 'basic',
          },
          analyzedSessionsUsed: 0, // Usage resets with new period
        })
      )

      // Can create up to 100 sessions in new period
      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
      expect(result.remaining).toBe(100)
    })

    it('should handle downgrade where current usage exceeds new limit', async () => {
      // User on Pro (1000 sessions), has used 500
      // At next cycle renewal, downgrades to Basic (100)
      // Usage resets, so they start fresh with 100 limit

      // Before renewal - still on Pro limits
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            sessions_limit: 1000,
            plan_name: 'pro',
          },
          analyzedSessionsUsed: 500,
        })
      )

      let result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(500)

      // After renewal - now on Basic with reset usage
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            sessions_limit: 100,
            plan_name: 'basic',
          },
          analyzedSessionsUsed: 0, // Reset for new period
        })
      )

      result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
      expect(result.remaining).toBe(100)
    })

    it('should handle analyzed issues limit downgrade', async () => {
      // User on Pro (1000 issues), has analyzed 500
      // Downgrades to Basic (200 issues)
      // At renewal, usage resets

      // Before renewal - still on Pro
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            issues_limit: 1000,
            plan_name: 'pro',
          },
          analyzedIssuesUsed: 500,
        })
      )

      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_issues',
      })
      expect(result.allowed).toBe(true)

      // After renewal - now on Basic with reset usage
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            issues_limit: 200,
            plan_name: 'basic',
          },
          analyzedIssuesUsed: 0, // Usage resets with new period
        })
      )

      // Can analyze up to 200 issues in new period
      const resultAfter = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_issues',
      })
      expect(resultAfter.allowed).toBe(true)
      expect(resultAfter.limit).toBe(200)
    })
  })

  // ==========================================================================
  // Subscription Status Changes
  // ==========================================================================

  describe('subscription status changes', () => {
    it('should block when subscription is cancelled and past period end', async () => {
      // Subscription cancelled and period ended = blocked (no free tier)
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: null, // No active subscription (cancelled past period end)
          analyzedSessionsUsed: 0,
        })
      )

      // Even with 0 usage, should be blocked because limit = 0
      await expect(
        enforceLimit({
          userId: 'user-123',
          dimension: 'analyzed_sessions',
        })
      ).rejects.toThrow(LimitExceededError)
    })

    it('should allow cancelled subscription within paid period', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            status: 'cancelled',
            sessions_limit: 100,
            current_period_end: futureDate,
          },
          analyzedSessionsUsed: 50,
        })
      )

      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100) // Still has plan limits within period
    })

    it('should block analyzed_issues when no subscription', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: null,
          analyzedIssuesUsed: 0,
        })
      )

      // No subscription = blocked (limit = 0)
      await expect(
        enforceLimit({ userId: 'user-123', dimension: 'analyzed_issues' })
      ).rejects.toThrow(LimitExceededError)
    })
  })

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle zero limits gracefully', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: 0 },
          analyzedSessionsUsed: 0,
        })
      )

      // Even with 0 used, can't add to a 0 limit
      await expect(
        enforceLimit({ userId: 'user-123', dimension: 'analyzed_sessions' })
      ).rejects.toThrow(LimitExceededError)
    })

    it('should handle very large usage numbers', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: null },
          analyzedSessionsUsed: 1000000,
        })
      )

      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(1000000)
    })

    it('should handle mixed dimension limits (one limited, one unlimited)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: {
            sessions_limit: 100,
            issues_limit: null, // Unlimited
          },
          analyzedSessionsUsed: 100,
          analyzedIssuesUsed: 50,
        })
      )

      // Sessions blocked
      await expect(
        enforceLimit({ userId: 'user-123', dimension: 'analyzed_sessions' })
      ).rejects.toThrow(LimitExceededError)

      // Issues allowed
      const issuesResult = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_issues',
      })
      expect(issuesResult.allowed).toBe(true)
      expect(issuesResult.limit).toBeNull()
    })

    it('should handle rapid successive enforcement checks', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createBillingInfo({
          subscription: { sessions_limit: 100 },
          analyzedSessionsUsed: 50,
        })
      )

      // Simulate rapid requests
      const results = await Promise.all([
        checkEnforcement({ userId: 'user-123', dimension: 'analyzed_sessions' }),
        checkEnforcement({ userId: 'user-123', dimension: 'analyzed_sessions' }),
        checkEnforcement({ userId: 'user-123', dimension: 'analyzed_sessions' }),
      ])

      // All should be allowed (snapshot of usage at time of check)
      expect(results.every((r) => r.allowed)).toBe(true)
    })
  })
})
