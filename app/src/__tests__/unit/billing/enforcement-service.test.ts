/**
 * Enforcement Service Tests
 *
 * Tests for subscription-based limit enforcement including:
 * - Enforcement for analyzed sessions (PM reviewed sessions)
 * - No subscription (blocked - no free tier)
 * - Subscription validity (active, on_trial, cancelled, etc.)
 * - Unlimited plans (null limits)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { BillingInfo, Subscription, UsageMetrics, Plan } from '@/types/billing'
import type { EnforcementResult, LimitDimension } from '@/lib/billing/enforcement-types'

// ============================================================================
// MOCKS
// ============================================================================

const mockGetBillingInfo = vi.fn<(userId: string) => Promise<BillingInfo>>()
const mockSendLimitNotificationIfNeeded = vi.fn()

vi.mock('@/lib/billing/billing-service', () => ({
  getBillingInfo: (userId: string) => mockGetBillingInfo(userId),
}))

vi.mock('@/lib/notifications/limit-notifications', () => ({
  sendLimitNotificationIfNeeded: (...args: unknown[]) => mockSendLimitNotificationIfNeeded(...args),
}))

// Import after mocks are set up
import {
  checkEnforcement,
  enforceLimit,
  LimitExceededError,
} from '@/lib/billing/enforcement-service'

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-123',
    user_id: 'user-123',
    plan_id: 'plan-123',
    plan_name: 'pro',
    sessions_limit: 100,
    issues_limit: 100,
    status: 'active',
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lemon_squeezy_subscription_id: 'ls-123',
    lemon_squeezy_customer_id: 'cust-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function createMockUsageMetrics(overrides: Partial<UsageMetrics> = {}): UsageMetrics {
  return {
    analyzedSessionsUsed: 0,
    analyzedSessionsLimit: 100,
    analyzedIssuesUsed: 0,
    analyzedIssuesLimit: 100,
    periodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    periodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

function createMockBillingInfo(overrides: {
  subscription?: Partial<Subscription> | null
  usage?: Partial<UsageMetrics>
} = {}): BillingInfo {
  const subscription = overrides.subscription === null
    ? null
    : createMockSubscription(overrides.subscription)

  return {
    subscription,
    plan: subscription ? { id: subscription.plan_id, name: subscription.plan_name } as Plan : null,
    usage: createMockUsageMetrics(overrides.usage),
    customerPortalUrl: subscription ? 'https://billing.example.com' : null,
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Enforcement Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ==========================================================================
  // checkEnforcement
  // ==========================================================================

  describe('checkEnforcement', () => {
    it('should allow action when under limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
      expect(result.current).toBe(50)
      expect(result.limit).toBe(100)
      expect(result.remaining).toBe(50)
    })

    it('should block action when at limit exactly', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 100 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.current).toBe(100)
      expect(result.limit).toBe(100)
      expect(result.remaining).toBe(0)
    })

    it('should block action when already over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 110 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.current).toBe(110)
      expect(result.limit).toBe(100)
      expect(result.remaining).toBe(0)
    })

    it('should allow when would reach limit but not exceed', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 99 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
        increment: 1,
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
      expect(result.current).toBe(99)
      expect(result.remaining).toBe(1)
    })

    it('should block when increment would exceed limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 99 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
        increment: 2,
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
    })

    it('should work with analyzed_issues dimension', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { issues_limit: 100 },
          usage: { analyzedIssuesUsed: 100 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_issues',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.dimension).toBe('analyzed_issues')
      expect(result.current).toBe(100)
      expect(result.limit).toBe(100)
    })

    it('should include upgradeUrl when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { analyzedSessionsUsed: 10 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.isOverLimit).toBe(true)
      expect(result.upgradeUrl).toBe('/account/billing')
    })

    it('should trigger notification when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { analyzedSessionsUsed: 10 },
        })
      )

      await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(mockSendLimitNotificationIfNeeded).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ isOverLimit: true })
      )
    })
  })

  // ==========================================================================
  // Edge Case: No Subscription (Blocked - No Free Tier)
  // ==========================================================================

  describe('edge cases - no subscription (blocked)', () => {
    it('should block analyzed_sessions when no subscription (limit = 0)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: null,
          usage: { analyzedSessionsUsed: 0, analyzedSessionsLimit: null },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.limit).toBe(0)
      expect(result.remaining).toBe(0)
    })

    it('should block analyzed_issues when no subscription (limit = 0)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: null,
          usage: { analyzedIssuesUsed: 0, analyzedIssuesLimit: null },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_issues',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.limit).toBe(0)
      expect(result.remaining).toBe(0)
    })
  })

  // ==========================================================================
  // Edge Case: Subscription Validity
  // ==========================================================================

  describe('edge cases - subscription validity', () => {
    it('should allow active subscription', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'active', sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
    })

    it('should allow on_trial subscription', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'on_trial', sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
    })

    it('should allow past_due subscription (grace period)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'past_due', sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
    })

    it('should allow cancelled subscription within paid period', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: {
            status: 'cancelled',
            sessions_limit: 100,
            current_period_end: futureDate,
          },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
    })

    it('should block cancelled subscription past period end', async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: {
            status: 'cancelled',
            sessions_limit: 100,
            current_period_end: pastDate,
          },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.limit).toBe(0)
    })

    it('should block paused subscription', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'paused', sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.limit).toBe(0)
    })

    it('should block expired subscription', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'expired', sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.limit).toBe(0)
    })
  })

  // ==========================================================================
  // Edge Case: Null Limits (Unlimited)
  // ==========================================================================

  describe('edge cases - null limits (unlimited)', () => {
    it('should allow unlimited analyzed_sessions when sessions_limit is null', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: null },
          usage: { analyzedSessionsUsed: 10000 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
      expect(result.limit).toBeNull()
      expect(result.remaining).toBeNull()
      expect(result.message).toBe('Unlimited')
    })

    it('should allow unlimited analyzed_issues when issues_limit is null', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { issues_limit: null },
          usage: { analyzedIssuesUsed: 1000 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_issues',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
      expect(result.limit).toBeNull()
      expect(result.remaining).toBeNull()
    })

    it('should not trigger notification for unlimited plans', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: null },
          usage: { analyzedSessionsUsed: 10000 },
        })
      )

      await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(mockSendLimitNotificationIfNeeded).not.toHaveBeenCalled()
    })

    it('should handle mixed limits (analyzed_sessions limited, analyzed_issues unlimited)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100, issues_limit: null },
          usage: { analyzedSessionsUsed: 100, analyzedIssuesUsed: 50 },
        })
      )

      const sessionsResult = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(sessionsResult.allowed).toBe(false)
      expect(sessionsResult.isOverLimit).toBe(true)
      expect(sessionsResult.limit).toBe(100)

      const issuesResult = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_issues',
      })

      expect(issuesResult.allowed).toBe(true)
      expect(issuesResult.isOverLimit).toBe(false)
      expect(issuesResult.limit).toBeNull()
    })
  })

  // ==========================================================================
  // Edge Case: Increment Parameter
  // ==========================================================================

  describe('edge cases - increment parameter', () => {
    it('should default to increment of 1', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { analyzedSessionsUsed: 9 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
        // no increment specified
      })

      expect(result.allowed).toBe(true) // 9 + 1 = 10, does not exceed
    })

    it('should allow when increment would reach but not exceed', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { analyzedSessionsUsed: 5 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
        increment: 5, // 5 + 5 = 10, exactly at limit
      })

      expect(result.allowed).toBe(true)
    })

    it('should block when increment would exceed', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { analyzedSessionsUsed: 6 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
        increment: 5, // 6 + 5 = 11, exceeds
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
    })

    it('should handle large increment values', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 0 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
        increment: 101,
      })

      expect(result.allowed).toBe(false)
    })
  })

  // ==========================================================================
  // enforceLimit Function
  // ==========================================================================

  describe('enforceLimit', () => {
    it('should return result when under limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 50 },
        })
      )

      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'analyzed_sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
    })

    it('should throw LimitExceededError when at limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 100 },
        })
      )

      await expect(
        enforceLimit({
          userId: 'user-123',
          dimension: 'analyzed_sessions',
        })
      ).rejects.toThrow(LimitExceededError)
    })

    it('should throw LimitExceededError when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { analyzedSessionsUsed: 110 },
        })
      )

      await expect(
        enforceLimit({
          userId: 'user-123',
          dimension: 'analyzed_sessions',
        })
      ).rejects.toThrow(LimitExceededError)
    })

    it('should throw with correct dimension in error', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { issues_limit: 100 },
          usage: { analyzedIssuesUsed: 100 },
        })
      )

      try {
        await enforceLimit({
          userId: 'user-123',
          dimension: 'analyzed_issues',
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LimitExceededError)
        expect((error as LimitExceededError).dimension).toBe('analyzed_issues')
      }
    })
  })
})

// ==========================================================================
// LimitExceededError Tests
// ==========================================================================

describe('LimitExceededError', () => {
  it('should set status to 429', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'analyzed_sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Analyzed sessions limit reached (100/100). Upgrade your plan to continue.',
    }

    const error = new LimitExceededError(result)

    expect(error.status).toBe(429)
  })

  it('should set code to LIMIT_EXCEEDED', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'analyzed_sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Analyzed sessions limit reached',
    }

    const error = new LimitExceededError(result)

    expect(error.code).toBe('LIMIT_EXCEEDED')
  })

  it('should set dimension from result', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'analyzed_issues',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Analyzed issues limit reached',
    }

    const error = new LimitExceededError(result)

    expect(error.dimension).toBe('analyzed_issues')
  })

  it('should set message from result', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'analyzed_sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Custom message here',
    }

    const error = new LimitExceededError(result)

    expect(error.message).toBe('Custom message here')
  })

  it('should store full result', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'analyzed_sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Analyzed sessions limit reached',
      upgradeUrl: '/account/billing',
    }

    const error = new LimitExceededError(result)

    expect(error.result).toEqual(result)
  })

  it('should return proper API response format', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'analyzed_sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Analyzed sessions limit reached (100/100). Upgrade your plan to continue.',
      upgradeUrl: '/account/billing',
    }

    const error = new LimitExceededError(result)
    const response = error.toResponse()

    expect(response).toEqual({
      error: 'Analyzed sessions limit reached (100/100). Upgrade your plan to continue.',
      code: 'LIMIT_EXCEEDED',
      details: result,
    })
  })

  it('should be instanceof Error', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'analyzed_sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Analyzed sessions limit reached',
    }

    const error = new LimitExceededError(result)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('LimitExceededError')
  })
})
