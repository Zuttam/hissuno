/**
 * Notification Flow Tests
 *
 * Tests sendHumanNeededNotification() which:
 * - Sends Slack DM when preference enabled
 * - Records notification thread info on session
 * - Deduplicates notifications
 * - Sends email when preference enabled
 * - Skips channels when preference disabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS
// ============================================================================

// --- Supabase ---
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

// --- Notification service ---
const mockShouldSendNotification = vi.fn()
const mockRecordNotification = vi.fn().mockResolvedValue(undefined)
const mockGetUserProfile = vi.fn()

vi.mock('@/lib/notifications/notification-service', () => ({
  shouldSendNotification: (...args: unknown[]) => mockShouldSendNotification(...args),
  recordNotification: (...args: unknown[]) => mockRecordNotification(...args),
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
}))

// --- Slack notifications ---
const mockResolveSlackUserId = vi.fn()
const mockSendSlackDM = vi.fn()

vi.mock('@/lib/notifications/slack-notifications', () => ({
  resolveSlackUserId: (...args: unknown[]) => mockResolveSlackUserId(...args),
  sendSlackDM: (...args: unknown[]) => mockSendSlackDM(...args),
}))

// --- Slack index (setSessionHumanTakeoverNotification) ---
const mockSetSessionHumanTakeoverNotification = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/integrations/slack', () => ({
  setSessionHumanTakeoverNotification: (...args: unknown[]) =>
    mockSetSessionHumanTakeoverNotification(...args),
}))

// --- Email ---
const mockRender = vi.fn().mockResolvedValue('<html>email</html>')

vi.mock('@react-email/components', () => ({
  render: (...args: unknown[]) => mockRender(...args),
}))

const mockResendSend = vi.fn().mockResolvedValue({ id: 'email-1' })

vi.mock('@/lib/email/resend', () => ({
  getResendClient: () => ({
    emails: { send: mockResendSend },
  }),
  getFromAddress: () => 'noreply@hissuno.com',
  isResendConfigured: () => true,
}))

vi.mock('@/lib/email/templates/human-needed', () => ({
  HumanNeededEmail: vi.fn().mockReturnValue(null),
}))

// Import after mocks
import { sendHumanNeededNotification } from '@/lib/notifications/human-needed-notifications'

// ============================================================================
// HELPERS
// ============================================================================

function setupProjectLookup(userId: string, projectName: string) {
  mockSingle.mockResolvedValue({
    data: { user_id: userId, name: projectName },
    error: null,
  })
  mockEq.mockReturnValue({ single: mockSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ============================================================================
// TESTS
// ============================================================================

describe('sendHumanNeededNotification', () => {
  const SESSION_ID = 'session-abc'
  const PROJECT_ID = 'proj-1'
  const USER_ID = 'user-owner-1'

  beforeEach(() => {
    vi.clearAllMocks()
    setupProjectLookup(USER_ID, 'My Project')
    mockGetUserProfile.mockResolvedValue({
      email: 'owner@company.com',
      fullName: 'Jane Owner',
    })
    // Default: both channels enabled
    mockShouldSendNotification.mockResolvedValue(true)
  })

  // --------------------------------------------------------------------------
  // Slack DM notification
  // --------------------------------------------------------------------------
  describe('Slack DM notification', () => {
    it('should send Slack DM when preference is enabled', async () => {
      mockResolveSlackUserId.mockResolvedValue({
        slackUserId: 'U_OWNER_SLACK',
        botToken: 'xoxb-token',
      })
      mockSendSlackDM.mockResolvedValue({
        ok: true,
        channelId: 'D_DM_CHANNEL',
        messageTs: '5555.6666',
      })

      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        sessionName: 'Help with billing',
      })

      expect(mockResolveSlackUserId).toHaveBeenCalledWith(USER_ID)
      expect(mockSendSlackDM).toHaveBeenCalledWith({
        slackUserId: 'U_OWNER_SLACK',
        botToken: 'xoxb-token',
        text: expect.stringContaining('customer conversation needs your attention'),
      })
    })

    it('should include session name and project name in DM', async () => {
      mockResolveSlackUserId.mockResolvedValue({
        slackUserId: 'U_OWNER_SLACK',
        botToken: 'xoxb-token',
      })
      mockSendSlackDM.mockResolvedValue({
        ok: true,
        channelId: 'D_DM_CHANNEL',
        messageTs: '5555.6666',
      })

      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        sessionName: 'Help with billing',
      })

      const dmText = mockSendSlackDM.mock.calls[0][0].text
      expect(dmText).toContain('Help with billing')
      expect(dmText).toContain('My Project')
      expect(dmText).toContain('Reply to this message')
    })

    it('should record notification thread info on session', async () => {
      mockResolveSlackUserId.mockResolvedValue({
        slackUserId: 'U_OWNER_SLACK',
        botToken: 'xoxb-token',
      })
      mockSendSlackDM.mockResolvedValue({
        ok: true,
        channelId: 'D_DM_CHANNEL',
        messageTs: '5555.6666',
      })

      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
      })

      expect(mockSetSessionHumanTakeoverNotification).toHaveBeenCalledWith(
        expect.anything(), // supabase client
        {
          sessionId: SESSION_ID,
          slackChannelId: 'D_DM_CHANNEL',
          slackThreadTs: '5555.6666',
          userId: USER_ID,
        }
      )
    })

    it('should record deduplication entry for Slack', async () => {
      mockResolveSlackUserId.mockResolvedValue({
        slackUserId: 'U_OWNER_SLACK',
        botToken: 'xoxb-token',
      })
      mockSendSlackDM.mockResolvedValue({
        ok: true,
        channelId: 'D_DM_CHANNEL',
        messageTs: '5555.6666',
      })

      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
      })

      expect(mockRecordNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          type: 'human_needed',
          channel: 'slack',
          dedupKey: `human_needed:${SESSION_ID}:slack`,
        })
      )
    })

    it('should skip Slack when preference is disabled', async () => {
      // Email enabled, Slack disabled
      mockShouldSendNotification.mockImplementation(
        async (_userId: string, _type: string, channel: string) => channel === 'email'
      )

      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
      })

      expect(mockResolveSlackUserId).not.toHaveBeenCalled()
      expect(mockSendSlackDM).not.toHaveBeenCalled()
    })

    it('should handle Slack user resolution failure gracefully', async () => {
      mockResolveSlackUserId.mockResolvedValue(null)

      // Should not throw
      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
      })

      expect(mockSendSlackDM).not.toHaveBeenCalled()
      expect(mockSetSessionHumanTakeoverNotification).not.toHaveBeenCalled()
    })

    it('should handle Slack DM send failure gracefully', async () => {
      mockResolveSlackUserId.mockResolvedValue({
        slackUserId: 'U_OWNER_SLACK',
        botToken: 'xoxb-token',
      })
      mockSendSlackDM.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      })

      // Should not throw
      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
      })

      expect(mockSetSessionHumanTakeoverNotification).not.toHaveBeenCalled()
      // No dedup record for failed send
      expect(mockRecordNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'slack' })
      )
    })
  })

  // --------------------------------------------------------------------------
  // Email notification
  // --------------------------------------------------------------------------
  describe('email notification', () => {
    it('should send email when preference is enabled', async () => {
      // Disable Slack to focus on email
      mockShouldSendNotification.mockImplementation(
        async (_userId: string, _type: string, channel: string) => channel === 'email'
      )
      mockResolveSlackUserId.mockResolvedValue(null)

      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        sessionName: 'Help with billing',
      })

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@company.com',
          subject: 'A customer conversation needs your attention',
        })
      )
    })

    it('should record deduplication entry for email', async () => {
      mockShouldSendNotification.mockImplementation(
        async (_userId: string, _type: string, channel: string) => channel === 'email'
      )

      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
      })

      expect(mockRecordNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'human_needed',
          channel: 'email',
          dedupKey: `human_needed:${SESSION_ID}:email`,
        })
      )
    })

    it('should skip email when preference is disabled', async () => {
      mockShouldSendNotification.mockImplementation(
        async (_userId: string, _type: string, channel: string) => channel === 'slack'
      )
      // Set up Slack to succeed so the function continues
      mockResolveSlackUserId.mockResolvedValue({
        slackUserId: 'U_OWNER_SLACK',
        botToken: 'xoxb-token',
      })
      mockSendSlackDM.mockResolvedValue({
        ok: true,
        channelId: 'D_DM_CHANNEL',
        messageTs: '5555.6666',
      })

      await sendHumanNeededNotification({
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
      })

      expect(mockResendSend).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------
  describe('error handling', () => {
    it('should not throw when project lookup fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

      await expect(
        sendHumanNeededNotification({
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
        })
      ).resolves.not.toThrow()
    })

    it('should not throw when user has no email', async () => {
      mockGetUserProfile.mockResolvedValue({ email: null, fullName: null })

      await expect(
        sendHumanNeededNotification({
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
        })
      ).resolves.not.toThrow()
    })
  })
})
