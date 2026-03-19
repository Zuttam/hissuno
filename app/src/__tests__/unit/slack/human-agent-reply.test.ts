/**
 * Human Agent Reply Tests
 *
 * Tests handleHumanAgentReply() which processes a human agent's
 * Slack DM reply and saves it to session_messages for delivery
 * to the customer widget.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCKS
// ============================================================================

const mockSaveSessionMessage = vi.fn()
const mockUpdateSessionActivity = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/db/queries/session-messages', () => ({
  saveSessionMessage: (...args: unknown[]) => mockSaveSessionMessage(...args),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  updateSessionActivity: (...args: unknown[]) => mockUpdateSessionActivity(...args),
  upsertSession: vi.fn(),
}))

// Mock Mastra (message-processor imports it at top level)
vi.mock('@/mastra', () => ({
  mastra: {
    getAgent: vi.fn().mockReturnValue(null),
  },
}))

// Mock chat-run-service (message-processor imports it)
vi.mock('@/lib/agent/chat-run-service', () => ({
  triggerChatRun: vi.fn(),
  updateChatRunStatus: vi.fn(),
}))

// Mock slack index helpers (message-processor imports them)
vi.mock('@/lib/integrations/slack/index', () => ({
  getOrCreateThreadSession: vi.fn(),
  updateThreadSessionLastMessage: vi.fn(),
  updateThreadSessionResponder: vi.fn(),
}))

// Import after mocks
import { handleHumanAgentReply } from '@/lib/integrations/slack/message-processor'

// ============================================================================
// HELPERS
// ============================================================================

function createMockSlackClient() {
  return {
    postMessage: vi.fn().mockResolvedValue({ ok: true, ts: '9999.0000' }),
    getUserInfo: vi.fn().mockResolvedValue(null),
    getUserEmail: vi.fn().mockResolvedValue(null),
    getChannelInfo: vi.fn().mockResolvedValue(null),
    getThreadMessages: vi.fn().mockResolvedValue([]),
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('handleHumanAgentReply', () => {
  let slackClient: ReturnType<typeof createMockSlackClient>

  beforeEach(() => {
    vi.clearAllMocks()
    slackClient = createMockSlackClient()
  })

  it('should save message with sender_type = human_agent', async () => {
    mockSaveSessionMessage.mockResolvedValue({
      id: 'msg-1',
      session_id: 'session-abc',
      project_id: 'proj-1',
      sender_type: 'human_agent',
      content: 'Hello, let me help you with that.',
      created_at: new Date().toISOString(),
    })

    await handleHumanAgentReply({
      sessionId: 'session-abc',
      projectId: 'proj-1',
      text: 'Hello, let me help you with that.',
      slackClient: slackClient as any,
      channelId: 'D_DM_CHANNEL',
      threadTs: '1111.2222',
    })

    expect(mockSaveSessionMessage).toHaveBeenCalledWith({
      sessionId: 'session-abc',
      projectId: 'proj-1',
      senderType: 'human_agent',
      content: 'Hello, let me help you with that.',
    })
  })

  it('should confirm in Slack thread with checkmark after saving', async () => {
    mockSaveSessionMessage.mockResolvedValue({
      id: 'msg-1',
      session_id: 'session-abc',
      project_id: 'proj-1',
      sender_type: 'human_agent',
      content: 'Test reply',
      created_at: new Date().toISOString(),
    })

    await handleHumanAgentReply({
      sessionId: 'session-abc',
      projectId: 'proj-1',
      text: 'Test reply',
      slackClient: slackClient as any,
      channelId: 'D_DM_CHANNEL',
      threadTs: '1111.2222',
    })

    // Should post confirmation in the DM thread
    expect(slackClient.postMessage).toHaveBeenCalledWith({
      channel: 'D_DM_CHANNEL',
      threadTs: '1111.2222',
      text: expect.stringContaining('Message sent to customer'),
    })
  })

  it('should update session activity after saving', async () => {
    mockSaveSessionMessage.mockResolvedValue({
      id: 'msg-1',
      session_id: 'session-abc',
      project_id: 'proj-1',
      sender_type: 'human_agent',
      content: 'Test',
      created_at: new Date().toISOString(),
    })

    await handleHumanAgentReply({
      sessionId: 'session-abc',
      projectId: 'proj-1',
      text: 'Test',
      slackClient: slackClient as any,
      channelId: 'D_DM_CHANNEL',
      threadTs: '1111.2222',
    })

    expect(mockUpdateSessionActivity).toHaveBeenCalledWith('session-abc')
  })

  it('should post error message to Slack when save fails', async () => {
    mockSaveSessionMessage.mockResolvedValue(null)

    await handleHumanAgentReply({
      sessionId: 'session-abc',
      projectId: 'proj-1',
      text: 'This will fail to save',
      slackClient: slackClient as any,
      channelId: 'D_DM_CHANNEL',
      threadTs: '1111.2222',
    })

    // Should post failure message
    expect(slackClient.postMessage).toHaveBeenCalledWith({
      channel: 'D_DM_CHANNEL',
      threadTs: '1111.2222',
      text: expect.stringContaining('Failed to send message'),
    })

    // Should NOT update session activity on failure
    expect(mockUpdateSessionActivity).not.toHaveBeenCalled()
  })

  it('should handle empty text', async () => {
    mockSaveSessionMessage.mockResolvedValue({
      id: 'msg-2',
      session_id: 'session-abc',
      project_id: 'proj-1',
      sender_type: 'human_agent',
      content: '',
      created_at: new Date().toISOString(),
    })

    await handleHumanAgentReply({
      sessionId: 'session-abc',
      projectId: 'proj-1',
      text: '',
      slackClient: slackClient as any,
      channelId: 'D_DM_CHANNEL',
      threadTs: '1111.2222',
    })

    expect(mockSaveSessionMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: '' })
    )
  })
})
