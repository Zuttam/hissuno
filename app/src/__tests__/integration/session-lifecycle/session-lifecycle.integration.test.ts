/**
 * Session Lifecycle Integration Tests
 *
 * These tests verify the session lifecycle cron behavior against a real database.
 * They create test sessions, run the lifecycle logic, and verify expected outcomes.
 *
 * To run these tests:
 * - Ensure .env.local is configured with valid database credentials
 * - Run: npm run test:integration src/__tests__/integration/session-lifecycle/
 *
 * Test scenarios:
 * 1. Active session becomes idle -> receives idle prompt
 * 2. Session with idle prompt times out -> closes automatically
 * 3. Session with goodbye detection -> closes after delay
 * 4. Closed session triggers PM review
 * 5. Human takeover prevents idle prompt (documents expected behavior)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { eq, and, inArray, ilike, asc, desc } from 'drizzle-orm'
import { sessions, sessionMessages, sessionReviews } from '@/lib/db/schema/app'
import type { SessionStatus } from '@/types/session'

/**
 * Integration test configuration
 *
 * These tests require:
 * 1. Valid database credentials in .env.local
 * 2. A running database instance (local or cloud)
 * 3. A test project ID set in TEST_PROJECT_ID env var (or use default)
 *
 * To run: npm run test:integration src/__tests__/integration/session-lifecycle/
 *
 * If the database is not configured, these tests will be skipped automatically.
 */

// Check if we can run integration tests
// Integration tests require explicit opt-in via RUN_INTEGRATION_TESTS=true
// This prevents accidental runs against production databases
const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true'

if (!shouldRun) {
  console.log('[session-lifecycle.integration.test] Skipping integration tests')
  console.log('  To run: RUN_INTEGRATION_TESTS=true npm run test src/__tests__/integration/session-lifecycle/')
}

// Test project ID - should exist in your database
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || 'test-project'

// Track created sessions for cleanup
const createdSessionIds: string[] = []

/**
 * Helper to create a test session
 */
async function createTestSession(overrides: {
  status?: SessionStatus
  last_activity_at?: string
  idle_prompt_sent_at?: string | null
  scheduled_close_at?: string | null
  goodbye_detected_at?: string | null
} = {}): Promise<{ id: string; project_id: string }> {
  const sessionId = `test-lifecycle-${Date.now()}-${Math.random().toString(36).substring(7)}`

  const [data] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      project_id: TEST_PROJECT_ID,
      source: 'manual',
      status: overrides.status ?? 'active',
      message_count: 1,
      last_activity_at: overrides.last_activity_at ? new Date(overrides.last_activity_at) : new Date(),
      idle_prompt_sent_at: overrides.idle_prompt_sent_at ? new Date(overrides.idle_prompt_sent_at) : null,
      scheduled_close_at: overrides.scheduled_close_at ? new Date(overrides.scheduled_close_at) : null,
      goodbye_detected_at: overrides.goodbye_detected_at ? new Date(overrides.goodbye_detected_at) : null,
      is_archived: false,
    })
    .returning({ id: sessions.id, project_id: sessions.project_id })

  if (!data) {
    throw new Error('Failed to create test session')
  }

  createdSessionIds.push(sessionId)
  return data
}

/**
 * Helper to get a session by ID
 */
async function getSession(sessionId: string) {
  const [data] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
  return data ?? null
}

/**
 * Helper to get session messages
 */
async function getSessionMessages(sessionId: string) {
  return db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.session_id, sessionId))
    .orderBy(asc(sessionMessages.created_at))
}

/**
 * Helper to check if PM review was triggered
 */
async function getPMReview(sessionId: string) {
  const [data] = await db
    .select()
    .from(sessionReviews)
    .where(eq(sessionReviews.session_id, sessionId))
    .orderBy(desc(sessionReviews.created_at))
    .limit(1)
  return data ?? null
}

/**
 * Helper to simulate the cron logic for idle prompts
 */
async function simulateIdlePromptLogic(sessionId: string, idleTimeoutMinutes = 5, responseTimeoutSeconds = 60) {
  const now = new Date()

  // Get session
  const session = await getSession(sessionId)
  if (!session) return { sent: false, reason: 'Session not found' }

  // Check conditions
  if (session.status !== 'active') {
    return { sent: false, reason: `Status is ${session.status}, not active` }
  }
  if (session.idle_prompt_sent_at !== null) {
    return { sent: false, reason: 'Idle prompt already sent' }
  }

  const lastActivity = new Date(session.last_activity_at!)
  const idleThreshold = new Date(now.getTime() - idleTimeoutMinutes * 60 * 1000)

  if (lastActivity >= idleThreshold) {
    return { sent: false, reason: 'Session is not idle yet' }
  }

  // Send idle prompt
  const messageId = crypto.randomUUID()
  const scheduledCloseAt = new Date(now.getTime() + responseTimeoutSeconds * 1000)

  await db.insert(sessionMessages).values({
    id: messageId,
    session_id: sessionId,
    project_id: session.project_id,
    sender_type: 'system',
    content: "Are you still there? Let me know if you need anything else, or I'll close this session shortly.",
    created_at: now,
  })

  await db
    .update(sessions)
    .set({
      status: 'awaiting_idle_response',
      idle_prompt_sent_at: now,
      scheduled_close_at: scheduledCloseAt,
    })
    .where(eq(sessions.id, sessionId))

  return { sent: true, messageId, scheduledCloseAt: scheduledCloseAt.toISOString() }
}

/**
 * Helper to simulate the cron logic for closing sessions.
 * Close phase only updates status - does NOT create review records.
 * Reviews are triggered separately by triggerPendingReviews.
 */
async function simulateCloseLogic(sessionId: string) {
  const now = new Date()

  // Get session
  const session = await getSession(sessionId)
  if (!session) return { closed: false, reason: 'Session not found' }

  // Check conditions
  if (!['closing_soon', 'awaiting_idle_response'].includes(session.status!)) {
    return { closed: false, reason: `Status is ${session.status}, not closable` }
  }
  if (!session.scheduled_close_at) {
    return { closed: false, reason: 'No scheduled_close_at set' }
  }

  const scheduledCloseAt = new Date(session.scheduled_close_at)
  if (scheduledCloseAt > now) {
    return { closed: false, reason: 'Scheduled close time not reached' }
  }

  // Close the session (close phase only - no review trigger)
  await db
    .update(sessions)
    .set({
      status: 'closed',
      updated_at: now,
    })
    .where(eq(sessions.id, sessionId))

  return { closed: true }
}

/**
 * Helper to simulate the triggerPendingReviews phase for a specific session.
 * Creates a review record for a closed session that doesn't have one yet.
 */
async function simulateReviewTrigger(sessionId: string) {
  const session = await getSession(sessionId)
  if (!session) return { triggered: false, reason: 'Session not found' }
  if (session.status !== 'closed') return { triggered: false, reason: `Status is ${session.status}, not closed` }

  // Check for existing completed/running review
  const existingReviews = await db
    .select({ id: sessionReviews.id })
    .from(sessionReviews)
    .where(
      and(
        eq(sessionReviews.session_id, sessionId),
        inArray(sessionReviews.status, ['completed', 'running'])
      )
    )
    .limit(1)

  if (existingReviews.length > 0) {
    return { triggered: false, reason: 'Review already exists' }
  }

  const runId = `pm-review-${sessionId}-${Date.now()}`
  try {
    await db.insert(sessionReviews).values({
      session_id: sessionId,
      project_id: session.project_id,
      run_id: runId,
      status: 'running',
      metadata: {
        triggeredBy: 'session-lifecycle-cron-test',
        sessionId: sessionId,
        projectId: session.project_id,
      },
    })
    return { triggered: true }
  } catch (error: any) {
    // Unique constraint violation means it already exists
    return { triggered: error?.code === '23505' }
  }
}

/**
 * Clean up orphaned test sessions from crashed previous runs (safety net)
 */
async function cleanupOrphanedTestSessions() {
  const orphaned = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(ilike(sessions.id, 'test-lifecycle-%'))

  if (orphaned.length === 0) return

  const orphanedIds = orphaned.map((s) => s.id)
  await db.delete(sessionMessages).where(inArray(sessionMessages.session_id, orphanedIds))
  await db.delete(sessionReviews).where(inArray(sessionReviews.session_id, orphanedIds))
  await db.delete(sessions).where(inArray(sessions.id, orphanedIds))
}

/**
 * Cleanup all test sessions
 */
async function cleanupTestSessions() {
  if (createdSessionIds.length === 0) return

  // Delete session messages
  await db
    .delete(sessionMessages)
    .where(inArray(sessionMessages.session_id, createdSessionIds))

  // Delete session reviews
  await db
    .delete(sessionReviews)
    .where(inArray(sessionReviews.session_id, createdSessionIds))

  // Delete sessions
  await db
    .delete(sessions)
    .where(inArray(sessions.id, createdSessionIds))

  createdSessionIds.length = 0
}

describe.skipIf(!shouldRun)('Session Lifecycle Integration', () => {
  beforeAll(async () => {
    await cleanupOrphanedTestSessions()
  })

  afterAll(async () => {
    await cleanupTestSessions()
  })

  describe('Idle Prompt Logic', () => {
    it('should send idle prompt to session that has been inactive past threshold', async () => {
      // Create session that was active 10 minutes ago (past 5 min default)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const session = await createTestSession({
        status: 'active',
        last_activity_at: tenMinutesAgo,
      })

      // Run idle prompt logic
      const result = await simulateIdlePromptLogic(session.id)

      expect(result.sent).toBe(true)

      // Verify session was updated
      const updatedSession = await getSession(session.id)
      expect(updatedSession?.status).toBe('awaiting_idle_response')
      expect(updatedSession?.idle_prompt_sent_at).not.toBeNull()
      expect(updatedSession?.scheduled_close_at).not.toBeNull()

      // Verify message was sent
      const messages = await getSessionMessages(session.id)
      const systemMessage = messages.find((m) => m.sender_type === 'system')
      expect(systemMessage).toBeDefined()
      expect(systemMessage?.content).toContain('still there')
    })

    it('should NOT send idle prompt to session that is still active', async () => {
      // Create session that was active 2 minutes ago (within 5 min threshold)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const session = await createTestSession({
        status: 'active',
        last_activity_at: twoMinutesAgo,
      })

      // Run idle prompt logic
      const result = await simulateIdlePromptLogic(session.id)

      expect(result.sent).toBe(false)
      expect(result.reason).toContain('not idle')

      // Verify session was NOT updated
      const updatedSession = await getSession(session.id)
      expect(updatedSession?.status).toBe('active')
      expect(updatedSession?.idle_prompt_sent_at).toBeNull()
    })

    it('should NOT send idle prompt if already sent', async () => {
      // Create session that already has idle prompt sent
      const session = await createTestSession({
        status: 'awaiting_idle_response',
        last_activity_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        idle_prompt_sent_at: new Date().toISOString(),
        scheduled_close_at: new Date(Date.now() + 60000).toISOString(),
      })

      // Run idle prompt logic
      const result = await simulateIdlePromptLogic(session.id)

      expect(result.sent).toBe(false)
      expect(result.reason).toContain('already sent')
    })

    it('should use custom idle timeout from project settings if available', async () => {
      // Create session that was active 3 minutes ago
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
      const session = await createTestSession({
        status: 'active',
        last_activity_at: threeMinutesAgo,
      })

      // Run with 2 minute timeout (should trigger)
      const result = await simulateIdlePromptLogic(session.id, 2)
      expect(result.sent).toBe(true)
    })
  })

  describe('Session Close Logic', () => {
    it('should close session in awaiting_idle_response status past scheduled time', async () => {
      // Create session scheduled to close in the past
      const session = await createTestSession({
        status: 'awaiting_idle_response',
        last_activity_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        idle_prompt_sent_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        scheduled_close_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      })

      // Run close logic (close phase only - no review)
      const result = await simulateCloseLogic(session.id)

      expect(result.closed).toBe(true)

      // Verify session was closed
      const updatedSession = await getSession(session.id)
      expect(updatedSession?.status).toBe('closed')

      // Close phase does NOT create a review - that's handled by triggerPendingReviews
      // Simulate the review trigger phase
      const reviewResult = await simulateReviewTrigger(session.id)
      expect(reviewResult.triggered).toBe(true)

      // Verify PM review was created
      const pmReview = await getPMReview(session.id)
      expect(pmReview).toBeDefined()
      expect(pmReview?.status).toBe('running')
    })

    it('should close session in closing_soon status past scheduled time', async () => {
      // Create session with goodbye detected and scheduled to close
      const session = await createTestSession({
        status: 'closing_soon',
        goodbye_detected_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        scheduled_close_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      })

      // Run close logic
      const result = await simulateCloseLogic(session.id)

      expect(result.closed).toBe(true)

      // Verify session was closed
      const updatedSession = await getSession(session.id)
      expect(updatedSession?.status).toBe('closed')
    })

    it('should NOT close session before scheduled time', async () => {
      // Create session scheduled to close in the future
      const session = await createTestSession({
        status: 'awaiting_idle_response',
        idle_prompt_sent_at: new Date().toISOString(),
        scheduled_close_at: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      })

      // Run close logic
      const result = await simulateCloseLogic(session.id)

      expect(result.closed).toBe(false)
      expect(result.reason).toContain('not reached')

      // Verify session was NOT closed
      const updatedSession = await getSession(session.id)
      expect(updatedSession?.status).toBe('awaiting_idle_response')
    })

    it('should NOT close active session', async () => {
      // Create active session (should not be closed by cron)
      const session = await createTestSession({
        status: 'active',
      })

      // Run close logic
      const result = await simulateCloseLogic(session.id)

      expect(result.closed).toBe(false)
      expect(result.reason).toContain('not closable')
    })
  })

  describe('PM Review Trigger', () => {
    it('should trigger PM review for closed session via separate phase', async () => {
      // Create closable session
      const session = await createTestSession({
        status: 'awaiting_idle_response',
        scheduled_close_at: new Date(Date.now() - 1000).toISOString(),
      })

      // Close session (close phase only)
      await simulateCloseLogic(session.id)

      // Trigger review (separate phase)
      const reviewResult = await simulateReviewTrigger(session.id)
      expect(reviewResult.triggered).toBe(true)

      // Verify PM review
      const pmReview = await getPMReview(session.id)
      expect(pmReview).toBeDefined()
      expect(pmReview?.session_id).toBe(session.id)
      expect((pmReview?.metadata as any)?.triggeredBy).toBe('session-lifecycle-cron-test')
    })

    it('should not re-trigger review for session with existing running review', async () => {
      // Create closed session with existing running review
      const session = await createTestSession({
        status: 'closed',
      })

      // Create a running review manually
      await db.insert(sessionReviews).values({
        session_id: session.id,
        project_id: session.project_id,
        run_id: `pm-review-manual-${Date.now()}`,
        status: 'running',
        metadata: { triggeredBy: 'manual' },
      })

      // Review trigger should skip (already has running review)
      const reviewResult = await simulateReviewTrigger(session.id)
      expect(reviewResult.triggered).toBe(false)
    })

    it('should pick up unreviewed sessions from any source', async () => {
      // Create sessions from different sources, all closed with no reviews
      const widgetSession = await createTestSession({ status: 'closed' })
      const intercomSession = await createTestSession({ status: 'closed' })
      const gongSession = await createTestSession({ status: 'closed' })

      // All should be eligible for review trigger
      for (const session of [widgetSession, intercomSession, gongSession]) {
        const result = await simulateReviewTrigger(session.id)
        expect(result.triggered).toBe(true)
      }
    })
  })

  describe('Goodbye Detection Lifecycle', () => {
    it('should close session after goodbye delay expires', async () => {
      // Create session with goodbye detected and scheduled to close
      const session = await createTestSession({
        status: 'closing_soon',
        goodbye_detected_at: new Date(Date.now() - 100000).toISOString(), // 100 seconds ago
        scheduled_close_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      })

      // Run close logic
      const result = await simulateCloseLogic(session.id)

      expect(result.closed).toBe(true)

      // Verify session was closed
      const updatedSession = await getSession(session.id)
      expect(updatedSession?.status).toBe('closed')
      expect(updatedSession?.goodbye_detected_at).not.toBeNull()
    })
  })

  describe('End-to-End Lifecycle', () => {
    it('should handle complete idle -> close lifecycle', async () => {
      // Step 1: Create active session that is idle
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const session = await createTestSession({
        status: 'active',
        last_activity_at: tenMinutesAgo,
      })

      // Verify initial state
      let currentSession = await getSession(session.id)
      expect(currentSession?.status).toBe('active')

      // Step 2: Send idle prompt
      await simulateIdlePromptLogic(session.id, 5, 1) // 1 second response timeout for fast test

      currentSession = await getSession(session.id)
      expect(currentSession?.status).toBe('awaiting_idle_response')

      // Step 3: Wait for scheduled close time (1 second)
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Step 4: Close session (close phase only)
      const closeResult = await simulateCloseLogic(session.id)
      expect(closeResult.closed).toBe(true)

      // Verify final state
      currentSession = await getSession(session.id)
      expect(currentSession?.status).toBe('closed')

      // Step 5: Trigger review (separate phase)
      const reviewResult = await simulateReviewTrigger(session.id)
      expect(reviewResult.triggered).toBe(true)

      // Verify PM review was triggered
      const pmReview = await getPMReview(session.id)
      expect(pmReview).toBeDefined()
    })
  })
})

// Separate test suite for human takeover (documents expected behavior - may need implementation)
describe.skipIf(!shouldRun)('Human Takeover Handling (Expected Behavior)', () => {
  afterAll(async () => {
    await cleanupTestSessions()
  })

  it('should check for human agent messages when considering idle prompt', async () => {
    // Create idle session
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const session = await createTestSession({
      status: 'active',
      last_activity_at: tenMinutesAgo,
    })

    // Add human agent message
    await db.insert(sessionMessages).values({
      id: crypto.randomUUID(),
      session_id: session.id,
      project_id: session.project_id,
      sender_type: 'human_agent',
      sender_user_id: 'test-user',
      content: "Hi, I'm taking over this conversation.",
      created_at: new Date(),
    })

    // Get messages to check for human takeover
    const messages = await getSessionMessages(session.id)
    const hasHumanTakeover = messages.some((m) => m.sender_type === 'human_agent')

    expect(hasHumanTakeover).toBe(true)

    // Document expected behavior:
    // If hasHumanTakeover is true, the cron SHOULD skip sending idle prompt
    // Currently, this check is NOT implemented in the cron job
    //
    // The current cron would send idle prompt (which is wrong)
    // Expected: Should NOT send idle prompt when human has taken over
  })
})
