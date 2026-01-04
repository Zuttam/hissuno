/**
 * Session Creation Limit Integration Tests
 *
 * Tests the full flow from subscription state through session creation limit enforcement.
 * Simulates the webhook → database → enforcement flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Subscription, UsageMetrics, BillingInfo, Plan } from '@/types/billing'

// ============================================================================
// MOCK STATE - Simulates database after webhook updates
// ============================================================================

interface MockDatabaseState {
  subscription: Subscription | null
  usage: {
    sessionsUsed: number
    projectsUsed: number
  }
  currentUser: { id: string; email: string } | null
}

let mockDb: MockDatabaseState

function resetMockDatabase() {
  mockDb = {
    subscription: null,
    usage: {
      sessionsUsed: 0,
      projectsUsed: 0,
    },
    currentUser: null,
  }
}

// ============================================================================
// HELPER: Simulate webhook updating subscription
// ============================================================================

function simulateWebhookSubscriptionCreated(subscription: Partial<Subscription>) {
  mockDb.subscription = {
    id: `sub-${Date.now()}`,
    user_id: mockDb.currentUser?.id ?? 'user-123',
    plan_id: 'plan-pro',
    plan_name: 'pro',
    sessions_limit: 100,
    projects_limit: 10,
    status: 'active',
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lemon_squeezy_subscription_id: 'ls-123',
    lemon_squeezy_customer_id: 'cust-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...subscription,
  }
}

function simulateWebhookSubscriptionUpdated(updates: Partial<Subscription>) {
  if (mockDb.subscription) {
    mockDb.subscription = {
      ...mockDb.subscription,
      ...updates,
      updated_at: new Date().toISOString(),
    }
  }
}

function simulateWebhookSubscriptionCancelled(endsAt: string) {
  if (mockDb.subscription) {
    mockDb.subscription = {
      ...mockDb.subscription,
      status: 'cancelled',
      current_period_end: endsAt,
      updated_at: new Date().toISOString(),
    }
  }
}

// ============================================================================
// MOCKS
// ============================================================================

// Mock billing service
vi.mock('@/lib/billing/billing-service', () => ({
  getBillingInfo: vi.fn(async (userId: string): Promise<BillingInfo> => {
    const subscription = mockDb.subscription
    const periodStart = subscription?.current_period_end
      ? new Date(new Date(subscription.current_period_end).getTime() - 30 * 24 * 60 * 60 * 1000)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    return {
      subscription,
      plan: subscription
        ? ({ id: subscription.plan_id, name: subscription.plan_name } as Plan)
        : null,
      usage: {
        sessionsUsed: mockDb.usage.sessionsUsed,
        sessionsLimit: subscription?.sessions_limit ?? null,
        projectsUsed: mockDb.usage.projectsUsed,
        projectsLimit: subscription?.projects_limit ?? null,
        periodStart: periodStart.toISOString(),
        periodEnd: subscription?.current_period_end ?? null,
      },
      customerPortalUrl: subscription ? 'https://billing.example.com' : null,
    }
  }),
}))

// Mock limit notifications (fire and forget)
vi.mock('@/lib/billing/limit-notifications', () => ({
  sendLimitNotificationIfNeeded: vi.fn(),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockDb.currentUser },
        error: mockDb.currentUser ? null : new Error('Not authenticated'),
      })),
    },
  })),
  createAdminClient: vi.fn(() => ({})),
}))

// Mock session creation
const mockCreateManualSession = vi.fn()
vi.mock('@/lib/supabase/sessions', () => ({
  listSessions: vi.fn(async () => []),
  getProjectIntegrationStats: vi.fn(async () => ({})),
  createManualSession: (...args: unknown[]) => mockCreateManualSession(...args),
}))

// Import after mocks
import { POST } from '@/app/api/sessions/route'

// ============================================================================
// TESTS
// ============================================================================

describe('Session Creation Limit Integration', () => {
  beforeEach(() => {
    resetMockDatabase()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ==========================================================================
  // Subscription Scenarios
  // ==========================================================================

  describe('with active subscription', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
      simulateWebhookSubscriptionCreated({
        status: 'active',
        sessions_limit: 100,
      })
    })

    it('should allow session creation when under limit', async () => {
      mockDb.usage.sessionsUsed = 50
      mockCreateManualSession.mockResolvedValue({ id: 'session-123' })

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.session).toEqual({ id: 'session-123' })
      expect(mockCreateManualSession).toHaveBeenCalled()
    })

    it('should block session creation when at limit', async () => {
      mockDb.usage.sessionsUsed = 100

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.code).toBe('LIMIT_EXCEEDED')
      expect(data.details.dimension).toBe('sessions')
      expect(mockCreateManualSession).not.toHaveBeenCalled()
    })

    it('should block session creation when over limit', async () => {
      mockDb.usage.sessionsUsed = 150

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(429)
      expect(mockCreateManualSession).not.toHaveBeenCalled()
    })
  })

  describe('with on_trial subscription', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
      simulateWebhookSubscriptionCreated({
        status: 'on_trial',
        sessions_limit: 50,
      })
    })

    it('should allow session creation during trial', async () => {
      mockDb.usage.sessionsUsed = 25
      mockCreateManualSession.mockResolvedValue({ id: 'session-trial' })

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockCreateManualSession).toHaveBeenCalled()
    })

    it('should enforce trial limits', async () => {
      mockDb.usage.sessionsUsed = 50

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(429)
    })
  })

  describe('with past_due subscription (grace period)', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
      simulateWebhookSubscriptionCreated({
        status: 'past_due',
        sessions_limit: 100,
      })
    })

    it('should allow session creation during grace period', async () => {
      mockDb.usage.sessionsUsed = 50
      mockCreateManualSession.mockResolvedValue({ id: 'session-grace' })

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockCreateManualSession).toHaveBeenCalled()
    })
  })

  describe('with cancelled subscription', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
    })

    it('should allow session creation within paid period', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      simulateWebhookSubscriptionCreated({
        status: 'cancelled',
        sessions_limit: 100,
        current_period_end: futureDate,
      })
      mockDb.usage.sessionsUsed = 50
      mockCreateManualSession.mockResolvedValue({ id: 'session-cancelled-valid' })

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockCreateManualSession).toHaveBeenCalled()
    })

    it('should block session creation after period ends', async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      simulateWebhookSubscriptionCreated({
        status: 'cancelled',
        sessions_limit: 100,
        current_period_end: pastDate,
      })
      mockDb.usage.sessionsUsed = 0

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.details.limit).toBe(0) // Blocked - no free tier
      expect(mockCreateManualSession).not.toHaveBeenCalled()
    })
  })

  describe('with paused subscription', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
      simulateWebhookSubscriptionCreated({
        status: 'paused',
        sessions_limit: 100,
      })
    })

    it('should block session creation when paused', async () => {
      mockDb.usage.sessionsUsed = 0

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.details.limit).toBe(0) // Blocked
      expect(mockCreateManualSession).not.toHaveBeenCalled()
    })
  })

  describe('with expired subscription', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
      simulateWebhookSubscriptionCreated({
        status: 'expired',
        sessions_limit: 100,
      })
    })

    it('should block session creation when expired', async () => {
      mockDb.usage.sessionsUsed = 0

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.details.limit).toBe(0) // Blocked
      expect(mockCreateManualSession).not.toHaveBeenCalled()
    })
  })

  describe('with no subscription', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
      mockDb.subscription = null
    })

    it('should block session creation with no subscription (no free tier)', async () => {
      mockDb.usage.sessionsUsed = 0

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.code).toBe('LIMIT_EXCEEDED')
      expect(data.details.limit).toBe(0) // Blocked - no free tier
      expect(mockCreateManualSession).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Plan Change Scenarios (simulating webhook updates)
  // ==========================================================================

  describe('plan changes via webhook', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
    })

    it('should immediately enforce new limits after upgrade', async () => {
      // Start with starter plan (50 sessions)
      simulateWebhookSubscriptionCreated({
        plan_id: 'starter',
        plan_name: 'starter',
        sessions_limit: 50,
      })
      mockDb.usage.sessionsUsed = 50

      // At starter limit - should be blocked
      let request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })
      let response = await POST(request)
      expect(response.status).toBe(429)

      // Simulate webhook: upgraded to pro (100 sessions)
      simulateWebhookSubscriptionUpdated({
        plan_id: 'pro',
        plan_name: 'pro',
        sessions_limit: 100,
      })
      mockCreateManualSession.mockResolvedValue({ id: 'session-after-upgrade' })

      // Now should be allowed
      request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })
      response = await POST(request)
      expect(response.status).toBe(201)
    })

    it('should immediately enforce new limits after downgrade', async () => {
      // Start with pro plan (100 sessions)
      simulateWebhookSubscriptionCreated({
        plan_id: 'pro',
        plan_name: 'pro',
        sessions_limit: 100,
      })
      mockDb.usage.sessionsUsed = 75
      mockCreateManualSession.mockResolvedValue({ id: 'session-before-downgrade' })

      // Under pro limit - should be allowed
      let request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })
      let response = await POST(request)
      expect(response.status).toBe(201)

      // Simulate webhook: downgraded to starter (50 sessions)
      simulateWebhookSubscriptionUpdated({
        plan_id: 'starter',
        plan_name: 'starter',
        sessions_limit: 50,
      })

      // Now over limit - should be blocked
      request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })
      response = await POST(request)
      expect(response.status).toBe(429)
    })

    it('should handle cancellation with grace period', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      simulateWebhookSubscriptionCreated({
        status: 'active',
        sessions_limit: 100,
      })
      mockDb.usage.sessionsUsed = 50
      mockCreateManualSession.mockResolvedValue({ id: 'session-before-cancel' })

      // Active - should be allowed
      let request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })
      let response = await POST(request)
      expect(response.status).toBe(201)

      // Simulate webhook: subscription cancelled (but within period)
      simulateWebhookSubscriptionCancelled(futureDate)
      mockCreateManualSession.mockResolvedValue({ id: 'session-after-cancel' })

      // Still within period - should be allowed
      request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })
      response = await POST(request)
      expect(response.status).toBe(201)
    })
  })

  // ==========================================================================
  // Unlimited Plans
  // ==========================================================================

  describe('with unlimited plan', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
      simulateWebhookSubscriptionCreated({
        plan_id: 'enterprise',
        plan_name: 'enterprise',
        sessions_limit: null, // Unlimited
      })
    })

    it('should allow unlimited session creation', async () => {
      mockDb.usage.sessionsUsed = 10000
      mockCreateManualSession.mockResolvedValue({ id: 'session-unlimited' })

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockCreateManualSession).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Authentication
  // ==========================================================================

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockDb.currentUser = null

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: 'project-123' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(mockCreateManualSession).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Validation
  // ==========================================================================

  describe('validation', () => {
    beforeEach(() => {
      mockDb.currentUser = { id: 'user-123', email: 'test@example.com' }
      simulateWebhookSubscriptionCreated({
        status: 'active',
        sessions_limit: 100,
      })
    })

    it('should return 400 when project_id is missing', async () => {
      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(mockCreateManualSession).not.toHaveBeenCalled()
    })
  })
})
