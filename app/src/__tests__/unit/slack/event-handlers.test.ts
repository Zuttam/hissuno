/**
 * Slack Event Handlers Tests
 *
 * Tests the event routing logic in handleSlackEvent():
 * - DM reply to notification thread → handleHumanAgentReply
 * - Interactive mode: threaded message → decideIfShouldRespond
 * - Human takeover phrase bridges to session flag
 * - Bot's own messages are ignored
 * - Passive mode captures without responding
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS
// ============================================================================

// --- Drizzle db ---
vi.mock('@/lib/db', () => ({
  db: {},
}))

// --- Slack index helpers ---
const mockGetSlackBotToken = vi.fn()
const mockGetSlackChannelWithMode = vi.fn()
const mockGetOrCreateSlackChannel = vi.fn()
const mockGetThreadSession = vi.fn()
const mockUpdateThreadSessionResponder = vi.fn()
const mockGetNotificationThreadSession = vi.fn()

vi.mock('@/lib/integrations/slack/index', () => ({
  getSlackBotToken: (...args: unknown[]) => mockGetSlackBotToken(...args),
  getSlackChannelWithMode: (...args: unknown[]) => mockGetSlackChannelWithMode(...args),
  getOrCreateSlackChannel: (...args: unknown[]) => mockGetOrCreateSlackChannel(...args),
  getThreadSession: (...args: unknown[]) => mockGetThreadSession(...args),
  updateThreadSessionResponder: (...args: unknown[]) => mockUpdateThreadSessionResponder(...args),
  getNotificationThreadSession: (...args: unknown[]) => mockGetNotificationThreadSession(...args),
}))

// --- Slack client ---
vi.mock('@/lib/integrations/slack/client', async () => {
  const { vi: viInline } = await import('vitest')
  return {
    SlackClient: class {
      postMessage = viInline.fn().mockResolvedValue({ ok: true, ts: '1234.5678' })
      getChannelInfo = viInline.fn().mockResolvedValue({ name: 'general', is_private: false })
      getUserInfo = viInline.fn().mockResolvedValue(null)
      getUserEmail = viInline.fn().mockResolvedValue(null)
      getThreadMessages = viInline.fn().mockResolvedValue([])
    },
  }
})

// --- Message processor ---
const mockProcessSlackMention = vi.fn().mockResolvedValue(undefined)
const mockProcessSlackMessage = vi.fn().mockResolvedValue(undefined)
const mockProcessPassiveThreadCapture = vi.fn().mockResolvedValue(undefined)
const mockProcessSlackThreadResponse = vi.fn().mockResolvedValue(undefined)
const mockHandleHumanAgentReply = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/integrations/slack/message-processor', () => ({
  processSlackMention: (...args: unknown[]) => mockProcessSlackMention(...args),
  processSlackMessage: (...args: unknown[]) => mockProcessSlackMessage(...args),
  processPassiveThreadCapture: (...args: unknown[]) => mockProcessPassiveThreadCapture(...args),
  processSlackThreadResponse: (...args: unknown[]) => mockProcessSlackThreadResponse(...args),
  handleHumanAgentReply: (...args: unknown[]) => mockHandleHumanAgentReply(...args),
}))

// --- Response decision ---
const mockDecideIfShouldRespond = vi.fn()

vi.mock('@/lib/integrations/slack/response-decision', () => ({
  decideIfShouldRespond: (...args: unknown[]) => mockDecideIfShouldRespond(...args),
}))

// --- Sessions ---
const mockSetSessionHumanTakeover = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/db/queries/sessions', () => ({
  setSessionHumanTakeover: (...args: unknown[]) => mockSetSessionHumanTakeover(...args),
}))

// Import after mocks
import { handleSlackEvent, type SlackEventPayload } from '@/lib/integrations/slack/event-handlers'

// ============================================================================
// HELPERS
// ============================================================================

const TEAM_ID = 'T_WORKSPACE_1'
const BOT_USER_ID = 'U_BOT_123'
const PROJECT_ID = 'proj-123'
const CHANNEL_ID = 'C_CHANNEL_1'
const CHANNEL_DB_ID = 'channel-db-id-1'

function createPayload(event: SlackEventPayload['event']): SlackEventPayload {
  return {
    teamId: TEAM_ID,
    event,
    eventId: 'evt-1',
    eventTime: Date.now(),
  }
}

function setupBotToken() {
  mockGetSlackBotToken.mockResolvedValue({
    token: 'xoxb-bot-token',
    botUserId: BOT_USER_ID,
    projectId: PROJECT_ID,
  })
}

function setupChannel(mode: 'interactive' | 'passive' = 'interactive') {
  mockGetSlackChannelWithMode.mockResolvedValue({
    id: CHANNEL_DB_ID,
    channelId: CHANNEL_ID,
    channelName: 'general',
    channelType: 'channel',
    channelMode: mode,
    captureScope: 'external_only',
    workspaceTokenId: 'wt-1',
    workspacePrimaryDomain: 'company.com',
  })
}

// ============================================================================
// TESTS
// ============================================================================

describe('handleSlackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupBotToken()
    setupChannel('interactive')
    mockGetNotificationThreadSession.mockResolvedValue(null)
    mockGetThreadSession.mockResolvedValue(null)
  })

  // --------------------------------------------------------------------------
  // Bot's own messages are ignored
  // --------------------------------------------------------------------------
  describe('self-message filtering', () => {
    it('should ignore messages from the bot itself', async () => {
      await handleSlackEvent(
        createPayload({
          type: 'message',
          user: BOT_USER_ID,
          channel: CHANNEL_ID,
          ts: '1234.5678',
          text: 'I am the bot',
        })
      )

      expect(mockProcessSlackMention).not.toHaveBeenCalled()
      expect(mockHandleHumanAgentReply).not.toHaveBeenCalled()
    })

    it('should ignore messages with bot_id', async () => {
      await handleSlackEvent(
        createPayload({
          type: 'message',
          user: 'U_SOME_OTHER',
          bot_id: 'B_BOT_1',
          channel: CHANNEL_ID,
          ts: '1234.5678',
          text: 'Bot message',
        })
      )

      expect(mockProcessSlackMention).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // No token found
  // --------------------------------------------------------------------------
  describe('no workspace token', () => {
    it('should exit early when no bot token found', async () => {
      mockGetSlackBotToken.mockResolvedValue(null)

      await handleSlackEvent(
        createPayload({
          type: 'app_mention',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '1234.5678',
          text: '<@U_BOT_123> help',
        })
      )

      expect(mockProcessSlackMention).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // app_mention → processSlackMention (interactive mode)
  // --------------------------------------------------------------------------
  describe('app_mention handling', () => {
    it('should route app_mention to processSlackMention in interactive mode', async () => {
      await handleSlackEvent(
        createPayload({
          type: 'app_mention',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '1234.5678',
          text: '<@U_BOT_123> help me',
        })
      )

      expect(mockProcessSlackMention).toHaveBeenCalledTimes(1)
      const args = mockProcessSlackMention.mock.calls[0][0]
      expect(args.projectId).toBe(PROJECT_ID)
      expect(args.channelId).toBe(CHANNEL_ID)
      expect(args.text).toBe('<@U_BOT_123> help me')
      expect(args.workspacePrimaryDomain).toBe('company.com')
    })

    it('should route app_mention to passive capture in passive mode', async () => {
      setupChannel('passive')

      await handleSlackEvent(
        createPayload({
          type: 'app_mention',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '1234.5678',
          text: '<@U_BOT_123> help me',
        })
      )

      expect(mockProcessSlackMention).not.toHaveBeenCalled()
      expect(mockProcessPassiveThreadCapture).toHaveBeenCalledTimes(1)
      const args = mockProcessPassiveThreadCapture.mock.calls[0][0]
      expect(args.captureMode).toBe('passive_mention')
    })
  })

  // --------------------------------------------------------------------------
  // DM reply → handleHumanAgentReply
  // --------------------------------------------------------------------------
  describe('DM notification reply routing', () => {
    it('should route DM reply to handleHumanAgentReply when notification thread found', async () => {
      mockGetNotificationThreadSession.mockResolvedValue({
        sessionId: 'session-abc',
        projectId: PROJECT_ID,
        userId: 'user-owner-1',
      })

      await handleSlackEvent(
        createPayload({
          type: 'message',
          channel_type: 'im',
          user: 'U_USER_1',
          channel: 'D_DM_CHANNEL',
          ts: '2222.3333',
          thread_ts: '1111.2222',
          text: 'Here is the answer for the customer',
        })
      )

      expect(mockHandleHumanAgentReply).toHaveBeenCalledTimes(1)
      const args = mockHandleHumanAgentReply.mock.calls[0][0]
      expect(args.sessionId).toBe('session-abc')
      expect(args.text).toBe('Here is the answer for the customer')
      expect(args.channelId).toBe('D_DM_CHANNEL')
    })

    it('should not route DM when no notification thread matches', async () => {
      mockGetNotificationThreadSession.mockResolvedValue(null)

      await handleSlackEvent(
        createPayload({
          type: 'message',
          channel_type: 'im',
          user: 'U_USER_1',
          channel: 'D_DM_CHANNEL',
          ts: '2222.3333',
          thread_ts: '1111.2222',
          text: 'Random DM',
        })
      )

      expect(mockHandleHumanAgentReply).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // Interactive mode: threaded message → decide and respond
  // --------------------------------------------------------------------------
  describe('interactive mode thread responses', () => {
    it('should respond to thread when decision is shouldRespond=true', async () => {
      const threadSession = {
        id: 'ts-1',
        sessionId: 'session-abc',
        lastResponderType: 'bot' as const,
        lastBotResponseTs: '1111.2222',
        hasExternalParticipants: false,
      }
      mockGetThreadSession.mockResolvedValue(threadSession)
      mockDecideIfShouldRespond.mockResolvedValue({
        shouldRespond: true,
        confidence: 'medium',
        reason: 'Continuing conversation',
        usedClassifier: false,
      })

      await handleSlackEvent(
        createPayload({
          type: 'message',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '3333.4444',
          thread_ts: '1111.2222',
          text: 'Tell me more about this feature',
        })
      )

      expect(mockDecideIfShouldRespond).toHaveBeenCalledTimes(1)
      expect(mockProcessSlackThreadResponse).toHaveBeenCalledTimes(1)
      const args = mockProcessSlackThreadResponse.mock.calls[0][0]
      expect(args.workspacePrimaryDomain).toBe('company.com')
    })

    it('should update responder tracking when decision is SKIP', async () => {
      const threadSession = {
        id: 'ts-1',
        sessionId: 'session-abc',
        lastResponderType: 'bot' as const,
        lastBotResponseTs: '1111.2222',
        hasExternalParticipants: false,
      }
      mockGetThreadSession.mockResolvedValue(threadSession)
      mockDecideIfShouldRespond.mockResolvedValue({
        shouldRespond: false,
        confidence: 'high',
        reason: 'Message mentions another user',
        usedClassifier: false,
      })

      await handleSlackEvent(
        createPayload({
          type: 'message',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '3333.4444',
          thread_ts: '1111.2222',
          text: '<@U_OTHER> please check this',
        })
      )

      expect(mockProcessSlackThreadResponse).not.toHaveBeenCalled()
      expect(mockUpdateThreadSessionResponder).toHaveBeenCalledWith(
        'ts-1',
        'user'
      )
    })

    it('should bridge human takeover phrase to session flag', async () => {
      const threadSession = {
        id: 'ts-1',
        sessionId: 'session-abc',
        lastResponderType: 'bot' as const,
        lastBotResponseTs: '1111.2222',
        hasExternalParticipants: false,
      }
      mockGetThreadSession.mockResolvedValue(threadSession)
      mockDecideIfShouldRespond.mockResolvedValue({
        shouldRespond: false,
        confidence: 'high',
        reason: 'Human takeover phrase detected',
        usedClassifier: false,
      })

      await handleSlackEvent(
        createPayload({
          type: 'message',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '3333.4444',
          thread_ts: '1111.2222',
          text: "I'll handle this from here",
        })
      )

      expect(mockSetSessionHumanTakeover).toHaveBeenCalledWith('session-abc', true)
    })

    it('should NOT set human takeover flag for non-takeover SKIP reasons', async () => {
      const threadSession = {
        id: 'ts-1',
        sessionId: 'session-abc',
        lastResponderType: 'bot' as const,
        lastBotResponseTs: '1111.2222',
        hasExternalParticipants: false,
      }
      mockGetThreadSession.mockResolvedValue(threadSession)
      mockDecideIfShouldRespond.mockResolvedValue({
        shouldRespond: false,
        confidence: 'high',
        reason: 'Message mentions another user',
        usedClassifier: false,
      })

      await handleSlackEvent(
        createPayload({
          type: 'message',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '3333.4444',
          thread_ts: '1111.2222',
          text: '<@U_OTHER> can you check?',
        })
      )

      expect(mockSetSessionHumanTakeover).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // Non-threaded messages fall through to external detection
  // --------------------------------------------------------------------------
  describe('non-threaded messages', () => {
    it('should skip non-threaded messages (no thread_ts)', async () => {
      await handleSlackEvent(
        createPayload({
          type: 'message',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '3333.4444',
          text: 'A top-level channel message',
        })
      )

      // No thread_ts → early return in handleMessage
      expect(mockDecideIfShouldRespond).not.toHaveBeenCalled()
      expect(mockProcessSlackThreadResponse).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // Untracked threads → external participant detection
  // --------------------------------------------------------------------------
  describe('untracked thread messages', () => {
    it('should fall through to processSlackMessage for untracked threads', async () => {
      mockGetThreadSession.mockResolvedValue(null) // Not tracked

      await handleSlackEvent(
        createPayload({
          type: 'message',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '3333.4444',
          thread_ts: '1111.2222',
          text: 'A message in an untracked thread',
        })
      )

      expect(mockProcessSlackMessage).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------------------------------------
  // Message subtypes are ignored
  // --------------------------------------------------------------------------
  describe('message subtypes', () => {
    it('should ignore message_changed subtype', async () => {
      await handleSlackEvent(
        createPayload({
          type: 'message',
          subtype: 'message_changed',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '3333.4444',
          text: 'Edited message',
        })
      )

      expect(mockDecideIfShouldRespond).not.toHaveBeenCalled()
      expect(mockProcessSlackMessage).not.toHaveBeenCalled()
    })

    it('should ignore message_deleted subtype', async () => {
      await handleSlackEvent(
        createPayload({
          type: 'message',
          subtype: 'message_deleted',
          user: 'U_USER_1',
          channel: CHANNEL_ID,
          ts: '3333.4444',
        })
      )

      expect(mockDecideIfShouldRespond).not.toHaveBeenCalled()
    })
  })
})
