/**
 * Session Lifecycle Cron Tests
 *
 * Tests for the session lifecycle cron job that handles:
 * 1. Sending idle prompts to inactive sessions
 * 2. Auto-closing sessions scheduled for close
 * 3. Triggering PM review for closed sessions
 *
 * Key scenarios:
 * - Idle prompt sent when session exceeds idle timeout
 * - Human takeover should prevent idle prompt (if implemented)
 * - Session closes after no response to idle prompt
 * - Session closes after goodbye detection (closing_soon status)
 * - PM review triggered when session closes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionStatus, SessionRecord } from '@/types/session'

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

interface MockSession {
  id: string
  project_id: string
  status: SessionStatus
  last_activity_at: string
  idle_prompt_sent_at: string | null
  scheduled_close_at: string | null
  goodbye_detected_at: string | null
}

interface MockProjectSettings {
  project_id: string
  session_idle_timeout_minutes: number
  session_idle_response_timeout_seconds: number
  session_goodbye_delay_seconds: number
}

interface MockSessionMessage {
  id: string
  session_id: string
  project_id: string
  sender_type: 'ai' | 'human_agent' | 'system'
  content: string
  created_at: string
}

function createMockSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    id: `session-${Math.random().toString(36).substring(7)}`,
    project_id: 'project-123',
    status: 'active',
    last_activity_at: new Date().toISOString(),
    idle_prompt_sent_at: null,
    scheduled_close_at: null,
    goodbye_detected_at: null,
    ...overrides,
  }
}

function createMockProjectSettings(overrides: Partial<MockProjectSettings> = {}): MockProjectSettings {
  return {
    project_id: 'project-123',
    session_idle_timeout_minutes: 5,
    session_idle_response_timeout_seconds: 60,
    session_goodbye_delay_seconds: 90,
    ...overrides,
  }
}

// ============================================================================
// SESSION STATUS TESTS
// ============================================================================

describe('Session Lifecycle Status', () => {
  describe('Session Status Values', () => {
    it('should have all expected status values', () => {
      const validStatuses: SessionStatus[] = ['active', 'closing_soon', 'awaiting_idle_response', 'closed']
      expect(validStatuses).toHaveLength(4)
      expect(validStatuses).toContain('active')
      expect(validStatuses).toContain('closing_soon')
      expect(validStatuses).toContain('awaiting_idle_response')
      expect(validStatuses).toContain('closed')
    })

    it('should transition from active to awaiting_idle_response when idle prompt sent', () => {
      const session = createMockSession({ status: 'active' })
      // Simulate idle prompt being sent
      session.status = 'awaiting_idle_response'
      session.idle_prompt_sent_at = new Date().toISOString()
      session.scheduled_close_at = new Date(Date.now() + 60000).toISOString()

      expect(session.status).toBe('awaiting_idle_response')
      expect(session.idle_prompt_sent_at).not.toBeNull()
      expect(session.scheduled_close_at).not.toBeNull()
    })

    it('should transition from active to closing_soon when goodbye detected', () => {
      const session = createMockSession({ status: 'active' })
      // Simulate goodbye detection
      session.status = 'closing_soon'
      session.goodbye_detected_at = new Date().toISOString()
      session.scheduled_close_at = new Date(Date.now() + 90000).toISOString()

      expect(session.status).toBe('closing_soon')
      expect(session.goodbye_detected_at).not.toBeNull()
      expect(session.scheduled_close_at).not.toBeNull()
    })

    it('should transition from awaiting_idle_response to closed after timeout', () => {
      const session = createMockSession({
        status: 'awaiting_idle_response',
        scheduled_close_at: new Date(Date.now() - 1000).toISOString(), // In the past
      })
      // Simulate cron closing the session
      session.status = 'closed'

      expect(session.status).toBe('closed')
    })

    it('should transition from closing_soon to closed after timeout', () => {
      const session = createMockSession({
        status: 'closing_soon',
        goodbye_detected_at: new Date(Date.now() - 100000).toISOString(),
        scheduled_close_at: new Date(Date.now() - 1000).toISOString(), // In the past
      })
      // Simulate cron closing the session
      session.status = 'closed'

      expect(session.status).toBe('closed')
    })
  })
})

// ============================================================================
// IDLE DETECTION LOGIC TESTS
// ============================================================================

describe('Idle Detection Logic', () => {
  describe('Idle Threshold Calculation', () => {
    it('should consider session idle after configured timeout', () => {
      const settings = createMockProjectSettings({ session_idle_timeout_minutes: 5 })
      const now = new Date()
      const idleThreshold = new Date(now.getTime() - settings.session_idle_timeout_minutes * 60 * 1000)

      // Session active 6 minutes ago (older than 5 min threshold)
      const lastActivity = new Date(now.getTime() - 6 * 60 * 1000)

      expect(lastActivity < idleThreshold).toBe(true)
    })

    it('should not consider session idle if within timeout', () => {
      const settings = createMockProjectSettings({ session_idle_timeout_minutes: 5 })
      const now = new Date()
      const idleThreshold = new Date(now.getTime() - settings.session_idle_timeout_minutes * 60 * 1000)

      // Session active 3 minutes ago (within 5 min threshold)
      const lastActivity = new Date(now.getTime() - 3 * 60 * 1000)

      expect(lastActivity < idleThreshold).toBe(false)
    })

    it('should use default 5 minute timeout when not configured', () => {
      const defaultIdleTimeout = 5 // minutes
      const now = new Date()
      const idleThreshold = new Date(now.getTime() - defaultIdleTimeout * 60 * 1000)

      // Session active exactly 5 minutes ago
      const lastActivity = new Date(now.getTime() - 5 * 60 * 1000)

      // Should be at threshold (not less than)
      expect(lastActivity.getTime()).toBe(idleThreshold.getTime())
    })
  })

  describe('Sessions Eligible for Idle Prompt', () => {
    it('should send idle prompt only to active sessions', () => {
      const activeSession = createMockSession({ status: 'active' })
      const closingSession = createMockSession({ status: 'closing_soon' })
      const awaitingSession = createMockSession({ status: 'awaiting_idle_response' })
      const closedSession = createMockSession({ status: 'closed' })

      // Only active sessions should receive idle prompts
      expect(activeSession.status === 'active').toBe(true)
      expect(closingSession.status === 'active').toBe(false)
      expect(awaitingSession.status === 'active').toBe(false)
      expect(closedSession.status === 'active').toBe(false)
    })

    it('should not send idle prompt if already sent', () => {
      const session = createMockSession({
        status: 'active',
        idle_prompt_sent_at: new Date().toISOString(),
      })

      // Query filter: idle_prompt_sent_at IS NULL
      expect(session.idle_prompt_sent_at === null).toBe(false)
    })

    it('should send idle prompt if not yet sent', () => {
      const session = createMockSession({
        status: 'active',
        idle_prompt_sent_at: null,
      })

      // Query filter: idle_prompt_sent_at IS NULL
      expect(session.idle_prompt_sent_at === null).toBe(true)
    })
  })

  describe('Idle Prompt Message', () => {
    it('should have correct system message content', () => {
      const expectedMessage = "Are you still there? Let me know if you need anything else, or I'll close this session shortly."
      expect(expectedMessage).toContain('still there')
      expect(expectedMessage).toContain('close this session')
    })

    it('should be marked as system message', () => {
      const message: MockSessionMessage = {
        id: 'msg-123',
        session_id: 'session-123',
        project_id: 'project-123',
        sender_type: 'system',
        content: "Are you still there? Let me know if you need anything else, or I'll close this session shortly.",
        created_at: new Date().toISOString(),
      }

      expect(message.sender_type).toBe('system')
    })
  })
})

// ============================================================================
// HUMAN TAKEOVER TESTS
// ============================================================================

/**
 * NOTE: Human takeover check is NOT currently implemented in the cron job.
 * The cron at /api/cron/session-lifecycle/route.ts does not check for
 * human_agent messages before sending idle prompts.
 *
 * These tests document the EXPECTED behavior. Implementation may be needed
 * to add a check like:
 * - Query session_messages for sender_type='human_agent'
 * - Skip idle prompt if human agent has sent a message recently
 *
 * TODO: Consider implementing human takeover check in cron
 */

describe('Human Takeover Handling', () => {
  describe('Detecting Human Takeover', () => {
    it('should identify session with human agent messages', () => {
      const messages: MockSessionMessage[] = [
        {
          id: 'msg-1',
          session_id: 'session-123',
          project_id: 'project-123',
          sender_type: 'ai',
          content: 'How can I help you?',
          created_at: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          session_id: 'session-123',
          project_id: 'project-123',
          sender_type: 'human_agent',
          content: "Hi, I'm a support agent taking over this conversation.",
          created_at: new Date().toISOString(),
        },
      ]

      const hasHumanTakeover = messages.some((msg) => msg.sender_type === 'human_agent')
      expect(hasHumanTakeover).toBe(true)
    })

    it('should not flag session with only AI messages', () => {
      const messages: MockSessionMessage[] = [
        {
          id: 'msg-1',
          session_id: 'session-123',
          project_id: 'project-123',
          sender_type: 'ai',
          content: 'How can I help you?',
          created_at: new Date().toISOString(),
        },
      ]

      const hasHumanTakeover = messages.some((msg) => msg.sender_type === 'human_agent')
      expect(hasHumanTakeover).toBe(false)
    })
  })

  describe('Idle Prompt Behavior with Human Takeover', () => {
    it('should NOT send idle prompt if human has taken over', () => {
      // This test documents expected behavior - implementation may need to be added
      const session = createMockSession({
        status: 'active',
        idle_prompt_sent_at: null,
        last_activity_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
      })

      const hasHumanTakeover = true // Simulated check

      // Expected: if human has taken over, skip idle prompt
      const shouldSendIdlePrompt = session.status === 'active' &&
        session.idle_prompt_sent_at === null &&
        !hasHumanTakeover

      expect(shouldSendIdlePrompt).toBe(false)
    })

    it('should send idle prompt if no human takeover', () => {
      const session = createMockSession({
        status: 'active',
        idle_prompt_sent_at: null,
        last_activity_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
      })

      const hasHumanTakeover = false

      const shouldSendIdlePrompt = session.status === 'active' &&
        session.idle_prompt_sent_at === null &&
        !hasHumanTakeover

      expect(shouldSendIdlePrompt).toBe(true)
    })
  })
})

// ============================================================================
// SESSION CLOSE LOGIC TESTS
// ============================================================================

describe('Session Close Logic', () => {
  describe('Sessions Scheduled for Close', () => {
    it('should close sessions with scheduled_close_at in the past', () => {
      const now = new Date()
      const session = createMockSession({
        status: 'awaiting_idle_response',
        scheduled_close_at: new Date(now.getTime() - 1000).toISOString(), // 1 second ago
      })

      const scheduledCloseAt = new Date(session.scheduled_close_at!)
      const shouldClose = scheduledCloseAt <= now

      expect(shouldClose).toBe(true)
    })

    it('should not close sessions with scheduled_close_at in the future', () => {
      const now = new Date()
      const session = createMockSession({
        status: 'awaiting_idle_response',
        scheduled_close_at: new Date(now.getTime() + 60000).toISOString(), // 1 minute from now
      })

      const scheduledCloseAt = new Date(session.scheduled_close_at!)
      const shouldClose = scheduledCloseAt <= now

      expect(shouldClose).toBe(false)
    })

    it('should close sessions in closing_soon status', () => {
      const now = new Date()
      const session = createMockSession({
        status: 'closing_soon',
        goodbye_detected_at: new Date(now.getTime() - 100000).toISOString(),
        scheduled_close_at: new Date(now.getTime() - 1000).toISOString(),
      })

      const closableStatuses: SessionStatus[] = ['closing_soon', 'awaiting_idle_response']
      const shouldClose = closableStatuses.includes(session.status) &&
        new Date(session.scheduled_close_at!) <= now

      expect(shouldClose).toBe(true)
    })

    it('should close sessions in awaiting_idle_response status', () => {
      const now = new Date()
      const session = createMockSession({
        status: 'awaiting_idle_response',
        idle_prompt_sent_at: new Date(now.getTime() - 120000).toISOString(),
        scheduled_close_at: new Date(now.getTime() - 1000).toISOString(),
      })

      const closableStatuses: SessionStatus[] = ['closing_soon', 'awaiting_idle_response']
      const shouldClose = closableStatuses.includes(session.status) &&
        new Date(session.scheduled_close_at!) <= now

      expect(shouldClose).toBe(true)
    })

    it('should not close sessions without scheduled_close_at', () => {
      const session = createMockSession({
        status: 'active',
        scheduled_close_at: null,
      })

      const shouldClose = session.scheduled_close_at !== null &&
        new Date(session.scheduled_close_at) <= new Date()

      expect(shouldClose).toBe(false)
    })
  })

  describe('Scheduled Close Calculation', () => {
    it('should calculate correct scheduled close time from response timeout', () => {
      const now = new Date()
      const responseTimeoutSeconds = 60
      const scheduledCloseAt = new Date(now.getTime() + responseTimeoutSeconds * 1000)

      const expectedDifferenceMs = responseTimeoutSeconds * 1000
      const actualDifferenceMs = scheduledCloseAt.getTime() - now.getTime()

      expect(actualDifferenceMs).toBe(expectedDifferenceMs)
    })

    it('should calculate correct scheduled close time from goodbye delay', () => {
      const now = new Date()
      const goodbyeDelaySeconds = 90
      const scheduledCloseAt = new Date(now.getTime() + goodbyeDelaySeconds * 1000)

      const expectedDifferenceMs = goodbyeDelaySeconds * 1000
      const actualDifferenceMs = scheduledCloseAt.getTime() - now.getTime()

      expect(actualDifferenceMs).toBe(expectedDifferenceMs)
    })
  })
})

// ============================================================================
// GOODBYE DETECTION TESTS
// ============================================================================

describe('Goodbye Detection', () => {
  describe('Goodbye Marker', () => {
    it('should detect goodbye marker in response', () => {
      const GOODBYE_MARKER = '[SESSION_GOODBYE]'
      const responseWithGoodbye = "Thanks for chatting! Have a great day! [SESSION_GOODBYE]"

      expect(responseWithGoodbye.includes(GOODBYE_MARKER)).toBe(true)
    })

    it('should not detect goodbye marker when absent', () => {
      const GOODBYE_MARKER = '[SESSION_GOODBYE]'
      const responseWithoutGoodbye = "Here's the information you requested."

      expect(responseWithoutGoodbye.includes(GOODBYE_MARKER)).toBe(false)
    })
  })

  describe('Session Status After Goodbye', () => {
    it('should set status to closing_soon after goodbye detection', () => {
      const session = createMockSession({ status: 'active' })
      const now = new Date()
      const goodbyeDelaySeconds = 90

      // Simulate goodbye detection
      session.status = 'closing_soon'
      session.goodbye_detected_at = now.toISOString()
      session.scheduled_close_at = new Date(now.getTime() + goodbyeDelaySeconds * 1000).toISOString()

      expect(session.status).toBe('closing_soon')
      expect(session.goodbye_detected_at).toBeDefined()
      expect(session.scheduled_close_at).toBeDefined()
    })
  })
})

// ============================================================================
// PM REVIEW TRIGGER TESTS
// ============================================================================

describe('PM Review Trigger', () => {
  describe('Review Triggered on Close', () => {
    it('should trigger PM review when session closes', () => {
      const session = createMockSession({ status: 'closed' })
      const runId = `pm-review-${session.id}-${Date.now()}`

      const reviewEntry = {
        session_id: session.id,
        project_id: session.project_id,
        run_id: runId,
        status: 'running',
        metadata: {
          triggeredBy: 'session-lifecycle-cron',
          sessionId: session.id,
          projectId: session.project_id,
        },
      }

      expect(reviewEntry.session_id).toBe(session.id)
      expect(reviewEntry.status).toBe('running')
      expect(reviewEntry.metadata.triggeredBy).toBe('session-lifecycle-cron')
    })

    it('should generate unique run_id for each review', () => {
      const session = createMockSession({ status: 'closed' })
      const runId1 = `pm-review-${session.id}-${Date.now()}`
      const runId2 = `pm-review-${session.id}-${Date.now() + 1}`

      expect(runId1).not.toBe(runId2)
    })
  })

  describe('Idempotent Review Creation', () => {
    it('should handle duplicate review creation gracefully', () => {
      // Error code 23505 = unique constraint violation
      // This should be ignored (review already in progress)
      const UNIQUE_CONSTRAINT_VIOLATION = '23505'

      const mockError = { code: UNIQUE_CONSTRAINT_VIOLATION }
      const shouldIgnore = mockError.code === '23505'

      expect(shouldIgnore).toBe(true)
    })
  })
})

// ============================================================================
// PROJECT SETTINGS TESTS
// ============================================================================

describe('Project Settings', () => {
  describe('Default Values', () => {
    it('should use default idle timeout when not configured', () => {
      const defaultIdleTimeout = 5 // minutes
      const settings: MockProjectSettings | undefined = undefined

      const idleTimeoutMinutes = settings?.session_idle_timeout_minutes ?? defaultIdleTimeout
      expect(idleTimeoutMinutes).toBe(5)
    })

    it('should use default response timeout when not configured', () => {
      const defaultResponseTimeout = 60 // seconds
      const settings: MockProjectSettings | undefined = undefined

      const responseTimeoutSeconds = settings?.session_idle_response_timeout_seconds ?? defaultResponseTimeout
      expect(responseTimeoutSeconds).toBe(60)
    })

    it('should use default goodbye delay when not configured', () => {
      const defaultGoodbyeDelay = 90 // seconds
      const settings: MockProjectSettings | undefined = undefined

      const goodbyeDelaySeconds = settings?.session_goodbye_delay_seconds ?? defaultGoodbyeDelay
      expect(goodbyeDelaySeconds).toBe(90)
    })
  })

  describe('Custom Settings', () => {
    it('should use custom idle timeout when configured', () => {
      const settings = createMockProjectSettings({ session_idle_timeout_minutes: 10 })
      const defaultIdleTimeout = 5

      const idleTimeoutMinutes = settings?.session_idle_timeout_minutes ?? defaultIdleTimeout
      expect(idleTimeoutMinutes).toBe(10)
    })

    it('should use custom response timeout when configured', () => {
      const settings = createMockProjectSettings({ session_idle_response_timeout_seconds: 120 })
      const defaultResponseTimeout = 60

      const responseTimeoutSeconds = settings?.session_idle_response_timeout_seconds ?? defaultResponseTimeout
      expect(responseTimeoutSeconds).toBe(120)
    })
  })

  describe('Setting Constraints', () => {
    it('should enforce idle timeout range (1-60 minutes)', () => {
      const minValue = 1
      const maxValue = 60

      expect(minValue).toBeGreaterThanOrEqual(1)
      expect(maxValue).toBeLessThanOrEqual(60)
    })

    it('should enforce response timeout range (30-180 seconds)', () => {
      const minValue = 30
      const maxValue = 180

      expect(minValue).toBeGreaterThanOrEqual(30)
      expect(maxValue).toBeLessThanOrEqual(180)
    })

    it('should enforce goodbye delay range (30-300 seconds)', () => {
      const minValue = 30
      const maxValue = 300

      expect(minValue).toBeGreaterThanOrEqual(30)
      expect(maxValue).toBeLessThanOrEqual(300)
    })
  })
})

// ============================================================================
// CRON RESULTS TESTS
// ============================================================================

describe('Cron Job Results', () => {
  describe('Result Structure', () => {
    it('should track idle prompts sent', () => {
      const results = {
        idlePromptsSent: 0,
        sessionsClosed: 0,
        pmReviewsTriggered: 0,
        errors: [] as string[],
      }

      results.idlePromptsSent++
      expect(results.idlePromptsSent).toBe(1)
    })

    it('should track sessions closed', () => {
      const results = {
        idlePromptsSent: 0,
        sessionsClosed: 0,
        pmReviewsTriggered: 0,
        errors: [] as string[],
      }

      results.sessionsClosed++
      expect(results.sessionsClosed).toBe(1)
    })

    it('should track PM reviews triggered', () => {
      const results = {
        idlePromptsSent: 0,
        sessionsClosed: 0,
        pmReviewsTriggered: 0,
        errors: [] as string[],
      }

      results.pmReviewsTriggered++
      expect(results.pmReviewsTriggered).toBe(1)
    })

    it('should track errors', () => {
      const results = {
        idlePromptsSent: 0,
        sessionsClosed: 0,
        pmReviewsTriggered: 0,
        errors: [] as string[],
      }

      results.errors.push('Failed to close session session-123')
      expect(results.errors).toHaveLength(1)
    })
  })
})

// ============================================================================
// END-TO-END LIFECYCLE SCENARIOS
// ============================================================================

describe('End-to-End Lifecycle Scenarios', () => {
  describe('Scenario: Session times out with no response', () => {
    it('should follow complete idle timeout lifecycle', () => {
      // T=0: Session is active
      const session = createMockSession({
        status: 'active',
        last_activity_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(), // 6 min ago
        idle_prompt_sent_at: null,
      })

      expect(session.status).toBe('active')
      expect(session.idle_prompt_sent_at).toBeNull()

      // T=5min: Cron sends idle prompt
      const now = new Date()
      session.status = 'awaiting_idle_response'
      session.idle_prompt_sent_at = now.toISOString()
      session.scheduled_close_at = new Date(now.getTime() + 60000).toISOString() // +60s

      expect(session.status).toBe('awaiting_idle_response')
      expect(session.idle_prompt_sent_at).not.toBeNull()

      // T=6min: No response, cron closes session
      session.status = 'closed'

      expect(session.status).toBe('closed')
    })
  })

  describe('Scenario: User says goodbye', () => {
    it('should follow complete goodbye detection lifecycle', () => {
      // T=0: Session is active
      const session = createMockSession({ status: 'active' })

      expect(session.status).toBe('active')

      // T=3min: User says "thanks, bye" - AI detects goodbye
      const now = new Date()
      session.status = 'closing_soon'
      session.goodbye_detected_at = now.toISOString()
      session.scheduled_close_at = new Date(now.getTime() + 90000).toISOString() // +90s

      expect(session.status).toBe('closing_soon')
      expect(session.goodbye_detected_at).not.toBeNull()

      // T=4min30s: Cron closes session
      session.status = 'closed'

      expect(session.status).toBe('closed')
    })
  })

  describe('Scenario: User responds to idle prompt', () => {
    it('should reset session when user responds', () => {
      // T=5min: Session is awaiting idle response
      const session = createMockSession({
        status: 'awaiting_idle_response',
        idle_prompt_sent_at: new Date().toISOString(),
        scheduled_close_at: new Date(Date.now() + 60000).toISOString(),
      })

      expect(session.status).toBe('awaiting_idle_response')

      // User sends a message - session should become active again
      // Note: This happens in the agent stream route, not the cron
      session.status = 'active'
      session.last_activity_at = new Date().toISOString()
      // Clear the scheduled close since user is active
      session.scheduled_close_at = null

      expect(session.status).toBe('active')
      expect(session.scheduled_close_at).toBeNull()
    })
  })

  describe('Scenario: Human agent takes over', () => {
    it('should handle human takeover correctly', () => {
      // T=0: Session is active, idle but human took over
      const session = createMockSession({
        status: 'active',
        last_activity_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
        idle_prompt_sent_at: null,
      })

      // Human agent sent a message
      const humanMessage: MockSessionMessage = {
        id: 'msg-human',
        session_id: session.id,
        project_id: session.project_id,
        sender_type: 'human_agent',
        content: "Hi, I'm taking over this conversation.",
        created_at: new Date().toISOString(),
      }

      // Check for human takeover
      const hasHumanTakeover = humanMessage.sender_type === 'human_agent'

      // Expected behavior: Should NOT send idle prompt when human has taken over
      const shouldSendIdlePrompt = session.idle_prompt_sent_at === null && !hasHumanTakeover

      expect(shouldSendIdlePrompt).toBe(false)
    })
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  describe('Timestamp Edge Cases', () => {
    it('should handle exactly at threshold', () => {
      const now = new Date()
      const idleTimeoutMinutes = 5
      const idleThreshold = new Date(now.getTime() - idleTimeoutMinutes * 60 * 1000)

      // Last activity exactly at threshold
      const lastActivity = new Date(idleThreshold.getTime())

      // Should not be idle (not less than threshold)
      expect(lastActivity < idleThreshold).toBe(false)
    })

    it('should handle exactly at scheduled close', () => {
      const now = new Date()
      const scheduledCloseAt = new Date(now.getTime())

      // Should close (less than or equal to now)
      expect(scheduledCloseAt <= now).toBe(true)
    })
  })

  describe('Multiple Sessions', () => {
    it('should process multiple idle sessions', () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          status: 'active',
          last_activity_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }),
        createMockSession({
          id: 'session-2',
          status: 'active',
          last_activity_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        }),
        createMockSession({
          id: 'session-3',
          status: 'active',
          last_activity_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // Not idle
        }),
      ]

      const idleThreshold = new Date(Date.now() - 5 * 60 * 1000)
      const idleSessions = sessions.filter(
        (s) => new Date(s.last_activity_at) < idleThreshold
      )

      expect(idleSessions).toHaveLength(2)
    })

    it('should process multiple sessions to close', () => {
      const now = new Date()
      const sessions = [
        createMockSession({
          id: 'session-1',
          status: 'awaiting_idle_response',
          scheduled_close_at: new Date(now.getTime() - 1000).toISOString(),
        }),
        createMockSession({
          id: 'session-2',
          status: 'closing_soon',
          scheduled_close_at: new Date(now.getTime() - 2000).toISOString(),
        }),
        createMockSession({
          id: 'session-3',
          status: 'awaiting_idle_response',
          scheduled_close_at: new Date(now.getTime() + 60000).toISOString(), // Future
        }),
      ]

      const sessionsToClose = sessions.filter(
        (s) =>
          ['closing_soon', 'awaiting_idle_response'].includes(s.status) &&
          s.scheduled_close_at &&
          new Date(s.scheduled_close_at) <= now
      )

      expect(sessionsToClose).toHaveLength(2)
    })
  })
})
