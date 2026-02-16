/**
 * MCP Tools Tests
 *
 * Tests the ask_hissuno tool:
 * - Invokes support agent with correct user-mode context
 * - Invokes support agent with correct contact-mode context
 * - Returns agent response text
 * - Returns error when agent is not available
 * - Returns error when agent throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpContext } from '@/mcp/context'

// ============================================================================
// MOCKS
// ============================================================================

const mockGenerate = vi.fn()
const mockGetAgent = vi.fn()

vi.mock('@/mastra', () => ({
  mastra: {
    getAgent: (...args: unknown[]) => mockGetAgent(...args),
  },
}))

// Capture the tool handler registered via registerTools
let capturedHandler: (params: Record<string, unknown>) => Promise<unknown>

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(),
}))

// Mock context module to control getContext()
const mockGetContext = vi.fn<() => McpContext>()
vi.mock('@/mcp/context', () => ({
  getContext: () => mockGetContext(),
}))

// ============================================================================
// IMPORT & SETUP
// ============================================================================

import { registerTools } from '@/mcp/tools'

function setupTools() {
  const fakeServer = {
    registerTool: vi.fn((_name: string, _config: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler
    }),
  } as unknown as McpServer

  registerTools(fakeServer)
  expect(fakeServer.registerTool).toHaveBeenCalledWith('ask_hissuno', expect.any(Object), expect.any(Function))
}

// ============================================================================
// TESTS
// ============================================================================

describe('ask_hissuno tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTools()
  })

  it('invokes support agent in user mode with correct context', async () => {
    mockGetContext.mockReturnValue({
      mode: 'user',
      projectId: 'proj-1',
      keyId: 'key-1',
      createdByUserId: 'user-1',
    })

    mockGetAgent.mockReturnValue({ generate: mockGenerate })
    mockGenerate.mockResolvedValue({ text: 'Top issues are X, Y, Z' })

    const result = await capturedHandler({ question: 'What are the top issues?' })

    expect(mockGetAgent).toHaveBeenCalledWith('supportAgent')
    expect(mockGenerate).toHaveBeenCalledWith(
      [{ role: 'user', content: 'What are the top issues?' }],
      expect.objectContaining({
        runtimeContext: expect.any(Object),
        toolsets: expect.objectContaining({
          dataTools: expect.any(Object),
        }),
        memory: expect.objectContaining({
          resource: 'user-1',
        }),
      }),
    )

    // Verify runtime context values
    const runtimeContext = mockGenerate.mock.calls[0][1].runtimeContext
    expect(runtimeContext.get('projectId')).toBe('proj-1')
    expect(runtimeContext.get('userId')).toBe('user-1')
    expect(runtimeContext.get('userMetadata')).toBeNull()
    expect(runtimeContext.get('namedPackageId')).toBeNull()
    expect(runtimeContext.get('contactToken')).toBeNull()
    expect(runtimeContext.get('contactId')).toBeNull()

    // Verify user-mode toolset includes list-issues (a user-only tool)
    const toolsets = mockGenerate.mock.calls[0][1].toolsets
    expect(toolsets.dataTools).toHaveProperty('list-issues')
    expect(toolsets.dataTools).not.toHaveProperty('my-issues')

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Top issues are X, Y, Z' }],
    })
  })

  it('invokes support agent in contact mode with correct context and scoped toolset', async () => {
    mockGetContext.mockReturnValue({
      mode: 'contact',
      projectId: 'proj-1',
      keyId: 'key-1',
      createdByUserId: 'user-1',
      contactId: 'contact-1',
      contactEmail: 'jane@example.com',
    })

    mockGetAgent.mockReturnValue({ generate: mockGenerate })
    mockGenerate.mockResolvedValue({ text: 'Your recent issues are...' })

    const result = await capturedHandler({ question: 'Show my issues' })

    // Verify runtime context has contact-specific values
    const runtimeContext = mockGenerate.mock.calls[0][1].runtimeContext
    expect(runtimeContext.get('userId')).toBe('jane@example.com')
    expect(runtimeContext.get('userMetadata')).toEqual({ email: 'jane@example.com' })
    expect(runtimeContext.get('contactId')).toBe('contact-1')

    // Verify contact-mode toolset includes my-issues (a contact-only tool) and not list-issues
    const toolsets = mockGenerate.mock.calls[0][1].toolsets
    expect(toolsets.dataTools).toHaveProperty('my-issues')
    expect(toolsets.dataTools).not.toHaveProperty('list-issues')

    // Verify memory uses contact email as resource
    expect(mockGenerate.mock.calls[0][1].memory.resource).toBe('jane@example.com')

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Your recent issues are...' }],
    })
  })

  it('passes thread_id for conversation continuity', async () => {
    mockGetContext.mockReturnValue({
      mode: 'user',
      projectId: 'proj-1',
      keyId: 'key-1',
      createdByUserId: 'user-1',
    })

    mockGetAgent.mockReturnValue({ generate: mockGenerate })
    mockGenerate.mockResolvedValue({ text: 'Continuing...' })

    await capturedHandler({ question: 'Follow up', thread_id: 'thread-123' })

    const runtimeContext = mockGenerate.mock.calls[0][1].runtimeContext
    expect(runtimeContext.get('sessionId')).toBe('thread-123')
    expect(mockGenerate.mock.calls[0][1].memory.thread).toBe('thread-123')
  })

  it('returns error when support agent is not available', async () => {
    mockGetContext.mockReturnValue({
      mode: 'user',
      projectId: 'proj-1',
      keyId: 'key-1',
      createdByUserId: 'user-1',
    })

    mockGetAgent.mockReturnValue(undefined)

    const result = await capturedHandler({ question: 'Hello' })

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Hissuno support agent is not available.' }],
      isError: true,
    })
  })

  it('returns error when agent.generate throws', async () => {
    mockGetContext.mockReturnValue({
      mode: 'user',
      projectId: 'proj-1',
      keyId: 'key-1',
      createdByUserId: 'user-1',
    })

    mockGetAgent.mockReturnValue({ generate: mockGenerate })
    mockGenerate.mockRejectedValue(new Error('Model overloaded'))

    const result = await capturedHandler({ question: 'Hello' })

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: Model overloaded' }],
      isError: true,
    })
  })
})
