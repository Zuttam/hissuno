/**
 * Response Decision Service Tests
 *
 * Tests the heuristic-based decision engine that determines
 * whether the bot should respond to messages in subscribed threads.
 *
 * Decision flow:
 * 0. Session in human takeover mode → SKIP
 * 1. Bot directly mentioned → RESPOND
 * 2. Another user mentioned → SKIP
 * 3. Human takeover phrase detected → SKIP
 * 4. Bot was last responder → RESPOND
 * 5. Uncertain → Call classifier agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS
// ============================================================================

const mockDbSelect = vi.fn()
const mockDbFrom = vi.fn()
const mockDbWhere = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}))

const mockGetAgent = vi.fn()

vi.mock('@/mastra', () => ({
  mastra: {
    getAgent: (name: string) => mockGetAgent(name),
  },
}))

// Import after mocks
import { decideIfShouldRespond, type ResponseDecision } from '@/lib/integrations/slack/response-decision'

// ============================================================================
// HELPERS
// ============================================================================

function setupDbMock(sessionData: { is_human_takeover: boolean } | null) {
  // Drizzle chain: db.select({...}).from(sessions).where(eq(...)) returns array
  const result = sessionData ? [sessionData] : []
  mockDbWhere.mockResolvedValue(result)
  mockDbFrom.mockReturnValue({ where: mockDbWhere })
  mockDbSelect.mockReturnValue({ from: mockDbFrom })
}

function setupClassifierMock(response: string) {
  mockGetAgent.mockReturnValue({
    generate: vi.fn().mockResolvedValue({ text: response }),
  })
}

// ============================================================================
// TESTS
// ============================================================================

describe('decideIfShouldRespond', () => {
  const BOT_USER_ID = 'UBOT12345'

  beforeEach(() => {
    vi.clearAllMocks()
    setupDbMock({ is_human_takeover: false })
  })

  // --------------------------------------------------------------------------
  // Priority 0: Session in human takeover mode
  // --------------------------------------------------------------------------
  describe('human takeover mode (priority 0)', () => {
    it('should SKIP when session is in human takeover mode', async () => {
      setupDbMock({ is_human_takeover: true })

      const result = await decideIfShouldRespond({
        text: `<@${BOT_USER_ID}> help me please`,
        botUserId: BOT_USER_ID,
        lastResponderType: 'bot',
        sessionId: 'session-123',
      })

      expect(result.shouldRespond).toBe(false)
      expect(result.confidence).toBe('high')
      expect(result.reason).toContain('human takeover')
      expect(result.usedClassifier).toBe(false)
    })

    it('should SKIP even when bot is directly mentioned in human takeover mode', async () => {
      setupDbMock({ is_human_takeover: true })

      const result = await decideIfShouldRespond({
        text: `<@${BOT_USER_ID}> can you answer this?`,
        botUserId: BOT_USER_ID,
        lastResponderType: null,
        sessionId: 'session-123',
      })

      expect(result.shouldRespond).toBe(false)
      expect(result.confidence).toBe('high')
    })

    it('should skip the session check when no sessionId is provided', async () => {
      const result = await decideIfShouldRespond({
        text: `<@${BOT_USER_ID}> hello`,
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      // No sessionId → skip DB check, fall through to mention check → RESPOND
      expect(result.shouldRespond).toBe(true)
      expect(mockDbSelect).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // Priority 1: Bot directly mentioned
  // --------------------------------------------------------------------------
  describe('bot directly mentioned (priority 1)', () => {
    it('should RESPOND when bot is @mentioned', async () => {
      const result = await decideIfShouldRespond({
        text: `<@${BOT_USER_ID}> what is the status?`,
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      expect(result.shouldRespond).toBe(true)
      expect(result.confidence).toBe('high')
      expect(result.reason).toContain('Bot directly mentioned')
      expect(result.usedClassifier).toBe(false)
    })

    it('should RESPOND when bot is mentioned among other text', async () => {
      const result = await decideIfShouldRespond({
        text: `Hey <@${BOT_USER_ID}> can you help with this issue?`,
        botUserId: BOT_USER_ID,
        lastResponderType: 'user',
      })

      expect(result.shouldRespond).toBe(true)
      expect(result.confidence).toBe('high')
    })
  })

  // --------------------------------------------------------------------------
  // Priority 2: Another user mentioned
  // --------------------------------------------------------------------------
  describe('another user mentioned (priority 2)', () => {
    it('should SKIP when another user is @mentioned', async () => {
      const result = await decideIfShouldRespond({
        text: '<@UOTHER0456> can you take a look?',
        botUserId: BOT_USER_ID,
        lastResponderType: 'bot',
      })

      expect(result.shouldRespond).toBe(false)
      expect(result.confidence).toBe('high')
      expect(result.reason).toContain('mentions another user')
      expect(result.usedClassifier).toBe(false)
    })

    it('should SKIP when multiple other users are mentioned', async () => {
      const result = await decideIfShouldRespond({
        text: '<@UOTHER001> <@UOTHER002> please review',
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      expect(result.shouldRespond).toBe(false)
      expect(result.confidence).toBe('high')
    })

    it('should not treat bot mention as "other user" mention', async () => {
      // Only the bot is mentioned — should fall through to priority 1 and RESPOND
      const result = await decideIfShouldRespond({
        text: `<@${BOT_USER_ID}> help`,
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      expect(result.shouldRespond).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Priority 3: Human takeover phrases
  // --------------------------------------------------------------------------
  describe('human takeover phrases (priority 3)', () => {
    const takeoverPhrases = [
      "i'll handle this",
      'i will handle this',
      'let me take over',
      "i'll take over",
      "i've got this",
      'i got this',
      "i'll respond",
      'let me respond',
      "i'll take it from here",
      'human here',
      'taking over',
      'thanks hissuno',
      'thank you hissuno',
      'got it from here',
    ]

    for (const phrase of takeoverPhrases) {
      it(`should SKIP for phrase: "${phrase}"`, async () => {
        const result = await decideIfShouldRespond({
          text: phrase,
          botUserId: BOT_USER_ID,
          lastResponderType: 'bot',
        })

        expect(result.shouldRespond).toBe(false)
        expect(result.confidence).toBe('high')
        expect(result.reason).toContain('Human takeover phrase')
        expect(result.usedClassifier).toBe(false)
      })
    }

    it('should detect takeover phrase case-insensitively', async () => {
      const result = await decideIfShouldRespond({
        text: "I'LL HANDLE THIS from now on",
        botUserId: BOT_USER_ID,
        lastResponderType: 'bot',
      })

      expect(result.shouldRespond).toBe(false)
    })

    it('should detect takeover phrase embedded in longer message', async () => {
      const result = await decideIfShouldRespond({
        text: 'Hey everyone, I got this. Will follow up shortly.',
        botUserId: BOT_USER_ID,
        lastResponderType: 'bot',
      })

      expect(result.shouldRespond).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Priority 4: Bot was last responder (continuation)
  // --------------------------------------------------------------------------
  describe('bot was last responder (priority 4)', () => {
    it('should RESPOND when bot was the last responder', async () => {
      const result = await decideIfShouldRespond({
        text: 'That makes sense, can you tell me more?',
        botUserId: BOT_USER_ID,
        lastResponderType: 'bot',
      })

      expect(result.shouldRespond).toBe(true)
      expect(result.confidence).toBe('medium')
      expect(result.reason).toContain('Continuing conversation')
      expect(result.usedClassifier).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Priority 5: Ambiguous → classifier fallback
  // --------------------------------------------------------------------------
  describe('classifier fallback (priority 5)', () => {
    it('should use classifier when no heuristic matches and lastResponderType is user', async () => {
      setupClassifierMock('RESPOND - The user is asking a question')

      const result = await decideIfShouldRespond({
        text: 'Can someone explain how the API works?',
        botUserId: BOT_USER_ID,
        lastResponderType: 'user',
      })

      expect(result.shouldRespond).toBe(true)
      expect(result.confidence).toBe('low')
      expect(result.usedClassifier).toBe(true)
      expect(mockGetAgent).toHaveBeenCalledWith('responseClassifierAgent')
    })

    it('should use classifier when lastResponderType is null', async () => {
      setupClassifierMock('SKIP - Message is not directed at the bot')

      const result = await decideIfShouldRespond({
        text: 'Just commenting on the thread',
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      expect(result.shouldRespond).toBe(false)
      expect(result.confidence).toBe('low')
      expect(result.usedClassifier).toBe(true)
    })

    it('should default to RESPOND when classifier agent is not found', async () => {
      mockGetAgent.mockReturnValue(null)

      const result = await decideIfShouldRespond({
        text: 'some ambiguous message',
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      expect(result.shouldRespond).toBe(true)
      expect(result.usedClassifier).toBe(true)
    })

    it('should default to RESPOND when classifier throws an error', async () => {
      mockGetAgent.mockReturnValue({
        generate: vi.fn().mockRejectedValue(new Error('Agent error')),
      })

      const result = await decideIfShouldRespond({
        text: 'some ambiguous message',
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      expect(result.shouldRespond).toBe(true)
      expect(result.usedClassifier).toBe(true)
    })

    it('should pass thread history to classifier', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({ text: 'RESPOND - question' })
      mockGetAgent.mockReturnValue({ generate: mockGenerate })

      const threadHistory = [
        { user: 'UUSER0001', text: 'How do I reset my password?', type: 'message' as const, ts: '1700000001.000000' },
        { user: BOT_USER_ID, text: 'You can reset it at...', type: 'message' as const, bot_id: 'B123', ts: '1700000002.000000' },
        { user: 'UUSER0002', text: 'I have the same question', type: 'message' as const, ts: '1700000003.000000' },
      ]

      await decideIfShouldRespond({
        text: 'I have the same question',
        botUserId: BOT_USER_ID,
        lastResponderType: null,
        threadHistory,
      })

      expect(mockGenerate).toHaveBeenCalledTimes(1)
      const prompt = mockGenerate.mock.calls[0][0][0].content
      expect(prompt).toContain('Recent thread context')
    })
  })

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle empty text', async () => {
      setupClassifierMock('SKIP - Empty message')

      const result = await decideIfShouldRespond({
        text: '',
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      // Empty text → no mention, no phrase → falls to classifier
      expect(result.usedClassifier).toBe(true)
    })

    it('should handle text with only whitespace', async () => {
      setupClassifierMock('SKIP')

      const result = await decideIfShouldRespond({
        text: '   ',
        botUserId: BOT_USER_ID,
        lastResponderType: null,
      })

      expect(result.usedClassifier).toBe(true)
    })
  })
})
