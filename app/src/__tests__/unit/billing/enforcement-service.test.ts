/**
 * Enforcement Service Tests
 *
 * Tests for subscription-based limit enforcement including:
 * - Hard enforcement (blocking) for manual creation
 * - Soft enforcement (flagging) for external channels
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

const mockGetBillingInfo = vi.fn<[string], Promise<BillingInfo>>()
const mockSendLimitNotificationIfNeeded = vi.fn()

vi.mock('@/lib/billing/billing-service', () => ({
  getBillingInfo: (userId: string) => mockGetBillingInfo(userId),
}))

vi.mock('@/lib/billing/limit-notifications', () => ({
  sendLimitNotificationIfNeeded: (...args: unknown[]) => mockSendLimitNotificationIfNeeded(...args),
}))

// Import after mocks are set up
import {
  checkEnforcement,
  enforceLimit,
  checkSessionLimitSoft,
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
    projects_limit: 5,
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
    sessionsUsed: 0,
    sessionsLimit: 100,
    projectsUsed: 0,
    projectsLimit: 5,
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
  // checkEnforcement - Hard Mode
  // ==========================================================================

  describe('checkEnforcement - hard mode', () => {
    it('should allow action when under limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
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
          usage: { sessionsUsed: 100 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
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
          usage: { sessionsUsed: 110 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
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
          usage: { sessionsUsed: 99 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
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
          usage: { sessionsUsed: 99 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
        increment: 2,
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
    })

    it('should work with projects dimension', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { projects_limit: 5 },
          usage: { projectsUsed: 5 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'projects',
        mode: 'hard',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.dimension).toBe('projects')
      expect(result.current).toBe(5)
      expect(result.limit).toBe(5)
    })

    it('should include upgradeUrl when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { sessionsUsed: 10 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(result.isOverLimit).toBe(true)
      expect(result.upgradeUrl).toBe('/account/billing')
    })

    it('should trigger notification when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { sessionsUsed: 10 },
        })
      )

      await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(mockSendLimitNotificationIfNeeded).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ isOverLimit: true })
      )
    })
  })

  // ==========================================================================
  // checkEnforcement - Soft Mode
  // ==========================================================================

  describe('checkEnforcement - soft mode', () => {
    it('should allow action when under limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'soft',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
    })

    it('should allow but flag when at limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 100 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'soft',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(true)
    })

    it('should allow but flag when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 150 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'soft',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(true)
    })

    it('should still trigger notification in soft mode when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { sessionsUsed: 10 },
        })
      )

      await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'soft',
      })

      expect(mockSendLimitNotificationIfNeeded).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Edge Case: No Subscription (Blocked - No Free Tier)
  // ==========================================================================

  describe('edge cases - no subscription (blocked)', () => {
    it('should block sessions when no subscription (limit = 0)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: null,
          usage: { sessionsUsed: 0, sessionsLimit: null },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.limit).toBe(0)
      expect(result.remaining).toBe(0)
    })

    it('should block projects when no subscription (limit = 0)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: null,
          usage: { projectsUsed: 0, projectsLimit: null },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'projects',
        mode: 'hard',
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
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
    })

    it('should allow on_trial subscription', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'on_trial', sessions_limit: 100 },
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
    })

    it('should allow past_due subscription (grace period)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'past_due', sessions_limit: 100 },
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
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
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
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
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.limit).toBe(0)
    })

    it('should block paused subscription', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'paused', sessions_limit: 100 },
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
      expect(result.limit).toBe(0)
    })

    it('should block expired subscription', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { status: 'expired', sessions_limit: 100 },
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
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
    it('should allow unlimited sessions when sessions_limit is null', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: null },
          usage: { sessionsUsed: 10000 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
      expect(result.limit).toBeNull()
      expect(result.remaining).toBeNull()
      expect(result.message).toBe('Unlimited')
    })

    it('should allow unlimited projects when projects_limit is null', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { projects_limit: null },
          usage: { projectsUsed: 1000 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'projects',
        mode: 'hard',
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
          usage: { sessionsUsed: 10000 },
        })
      )

      await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(mockSendLimitNotificationIfNeeded).not.toHaveBeenCalled()
    })

    it('should handle mixed limits (sessions limited, projects unlimited)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100, projects_limit: null },
          usage: { sessionsUsed: 100, projectsUsed: 50 },
        })
      )

      const sessionsResult = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
      })

      expect(sessionsResult.allowed).toBe(false)
      expect(sessionsResult.isOverLimit).toBe(true)
      expect(sessionsResult.limit).toBe(100)

      const projectsResult = await checkEnforcement({
        userId: 'user-123',
        dimension: 'projects',
        mode: 'hard',
      })

      expect(projectsResult.allowed).toBe(true)
      expect(projectsResult.isOverLimit).toBe(false)
      expect(projectsResult.limit).toBeNull()
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
          usage: { sessionsUsed: 9 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
        // no increment specified
      })

      expect(result.allowed).toBe(true) // 9 + 1 = 10, does not exceed
    })

    it('should allow when increment would reach but not exceed', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { sessionsUsed: 5 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
        increment: 5, // 5 + 5 = 10, exactly at limit
      })

      expect(result.allowed).toBe(true)
    })

    it('should block when increment would exceed', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { sessionsUsed: 6 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
        increment: 5, // 6 + 5 = 11, exceeds
      })

      expect(result.allowed).toBe(false)
      expect(result.isOverLimit).toBe(true)
    })

    it('should handle large increment values', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 0 },
        })
      )

      const result = await checkEnforcement({
        userId: 'user-123',
        dimension: 'sessions',
        mode: 'hard',
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
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await enforceLimit({
        userId: 'user-123',
        dimension: 'sessions',
      })

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
    })

    it('should throw LimitExceededError when at limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 100 },
        })
      )

      await expect(
        enforceLimit({
          userId: 'user-123',
          dimension: 'sessions',
        })
      ).rejects.toThrow(LimitExceededError)
    })

    it('should throw LimitExceededError when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 110 },
        })
      )

      await expect(
        enforceLimit({
          userId: 'user-123',
          dimension: 'sessions',
        })
      ).rejects.toThrow(LimitExceededError)
    })

    it('should throw with correct dimension in error', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { projects_limit: 5 },
          usage: { projectsUsed: 5 },
        })
      )

      try {
        await enforceLimit({
          userId: 'user-123',
          dimension: 'projects',
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LimitExceededError)
        expect((error as LimitExceededError).dimension).toBe('projects')
      }
    })
  })

  // ==========================================================================
  // checkSessionLimitSoft Function
  // ==========================================================================

  describe('checkSessionLimitSoft', () => {
    it('should always return allowed: true', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 10 },
          usage: { sessionsUsed: 100 },
        })
      )

      const result = await checkSessionLimitSoft('user-123', 'project-123')

      expect(result.allowed).toBe(true)
    })

    it('should return isOverLimit: false when under limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 50 },
        })
      )

      const result = await checkSessionLimitSoft('user-123', 'project-123')

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
    })

    it('should return isOverLimit: true when at limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 100 },
        })
      )

      const result = await checkSessionLimitSoft('user-123', 'project-123')

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(true)
    })

    it('should return isOverLimit: true when over limit', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: 100 },
          usage: { sessionsUsed: 150 },
        })
      )

      const result = await checkSessionLimitSoft('user-123', 'project-123')

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(true)
    })

    it('should return isOverLimit: false for unlimited plans', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: { sessions_limit: null },
          usage: { sessionsUsed: 10000 },
        })
      )

      const result = await checkSessionLimitSoft('user-123', 'project-123')

      expect(result.allowed).toBe(true)
      expect(result.isOverLimit).toBe(false)
    })

    it('should be over limit when no subscription (blocked)', async () => {
      mockGetBillingInfo.mockResolvedValue(
        createMockBillingInfo({
          subscription: null,
          usage: { sessionsUsed: 0, sessionsLimit: null },
        })
      )

      const result = await checkSessionLimitSoft('user-123', 'project-123')

      expect(result.allowed).toBe(true) // soft enforcement always allows
      expect(result.isOverLimit).toBe(true) // but flags as over limit (0 >= 0)
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
      dimension: 'sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Sessions limit reached (100/100). Upgrade your plan to continue.',
    }

    const error = new LimitExceededError(result)

    expect(error.status).toBe(429)
  })

  it('should set code to LIMIT_EXCEEDED', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Sessions limit reached',
    }

    const error = new LimitExceededError(result)

    expect(error.code).toBe('LIMIT_EXCEEDED')
  })

  it('should set dimension from result', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'projects',
      current: 5,
      limit: 5,
      remaining: 0,
      message: 'Projects limit reached',
    }

    const error = new LimitExceededError(result)

    expect(error.dimension).toBe('projects')
  })

  it('should set message from result', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'sessions',
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
      dimension: 'sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Sessions limit reached',
      upgradeUrl: '/account/billing',
    }

    const error = new LimitExceededError(result)

    expect(error.result).toEqual(result)
  })

  it('should return proper API response format', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Sessions limit reached (100/100). Upgrade your plan to continue.',
      upgradeUrl: '/account/billing',
    }

    const error = new LimitExceededError(result)
    const response = error.toResponse()

    expect(response).toEqual({
      error: 'Sessions limit reached (100/100). Upgrade your plan to continue.',
      code: 'LIMIT_EXCEEDED',
      details: result,
    })
  })

  it('should be instanceof Error', () => {
    const result: EnforcementResult = {
      allowed: false,
      isOverLimit: true,
      dimension: 'sessions',
      current: 100,
      limit: 100,
      remaining: 0,
      message: 'Sessions limit reached',
    }

    const error = new LimitExceededError(result)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('LimitExceededError')
  })
})
