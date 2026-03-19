'use client'

import { useRef, useEffect, useState, useCallback, type KeyboardEvent, type FormEvent } from 'react'
import { Button, Input } from '@/components/ui'
import { useHissunoChat, type ChatMessage, type Message } from '@hissuno/widget'
import { useUser } from '@/components/providers/auth-provider'
import { useProject } from '@/components/providers/project-provider'
import { useCopilot } from '@/components/providers/copilot-provider'
import { useSessions } from '@/hooks/use-sessions'
import { getSession } from '@/lib/api/sessions'
import { MessageBubble, LoadingIndicator } from '@/components/chat/message-bubble'
import type { SessionWithProject } from '@/types/session'

function generateUniqueSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 9)
  return `session_${timestamp}_${random}`
}

const INITIAL_MESSAGE = "Hi! I can help you explore project data, find feedback patterns, and take actions. What would you like to know?"

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: SessionWithProject
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[4px] p-3 text-left transition ${
        isActive
          ? 'bg-[color:var(--accent-selected)] text-white'
          : 'hover:bg-[color:var(--surface-hover)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`truncate text-xs font-medium ${
            isActive ? 'text-white' : 'text-[color:var(--foreground)]'
          }`}
        >
          {session.message_count} messages
        </span>
        <span
          className={`shrink-0 text-xs ${
            isActive ? 'text-white/70' : 'text-[color:var(--text-tertiary)]'
          }`}
        >
          {formatRelativeTime(session.last_activity_at)}
        </span>
      </div>
      {session.page_title && (
        <p
          className={`mt-1 truncate text-xs ${
            isActive ? 'text-white/80' : 'text-[color:var(--text-secondary)]'
          }`}
        >
          {session.page_title}
        </p>
      )}
    </button>
  )
}

export function CopilotSidebar() {
  const { isOpen, close } = useCopilot()
  const { project, projectId } = useProject()
  const { user } = useUser()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showSessionList, setShowSessionList] = useState(false)

  // Track project changes to reset session
  const prevProjectIdRef = useRef<string | null>(null)

  // Fetch sessions for initialization and session list view
  const { sessions, isLoading: isLoadingSessions } = useSessions({
    filters: {
      projectId: projectId || undefined,
      limit: 20,
    },
  })

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    loadSession,
    cancelChat,
  } = useHissunoChat({
    projectId: projectId || '',
    apiUrl: '/api/integrations/widget/chat',
    initialMessage: INITIAL_MESSAGE,
    userId: user?.id,
    sessionId: currentSessionId || undefined,
    userMetadata: user
      ? {
          email: user.email ?? '',
          ...(user.name && { name: user.name }),
        }
      : undefined,
  })

  // Initialize: load most recent session or create new one
  useEffect(() => {
    if (isInitialized || isLoadingSessions || !projectId) return

    const initializeSession = async () => {
      if (sessions.length > 0) {
        const latestSession = sessions[0]
        try {
          const { messages: sessionMessages } = await getSession(projectId, latestSession.id)
          const formattedMessages: Message[] = sessionMessages.map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            createdAt: new Date(msg.createdAt),
          }))
          setCurrentSessionId(latestSession.id)
          loadSession(latestSession.id, formattedMessages)
        } catch {
          setCurrentSessionId(generateUniqueSessionId())
        }
      } else {
        setCurrentSessionId(generateUniqueSessionId())
      }
      setIsLoadingSession(false)
      setIsInitialized(true)
    }

    initializeSession()
  }, [isLoadingSessions, sessions, isInitialized, loadSession, projectId])

  // Reset session when project changes
  useEffect(() => {
    if (!projectId) return

    if (prevProjectIdRef.current && prevProjectIdRef.current !== projectId) {
      const newSessionId = generateUniqueSessionId()
      setCurrentSessionId(newSessionId)
      loadSession(newSessionId, [])
      setIsInitialized(false)
      setIsLoadingSession(true)
    }

    prevProjectIdRef.current = projectId
  }, [projectId, loadSession])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, streamingContent])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSubmit(e)
  }

  const handleNewThread = useCallback(() => {
    const newSessionId = generateUniqueSessionId()
    setCurrentSessionId(newSessionId)
    loadSession(newSessionId, [])
    setShowSessionList(false)
  }, [loadSession])

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      setShowSessionList(false)
      return
    }

    setIsLoadingSession(true)
    setShowSessionList(false)
    try {
      const { messages: sessionMessages } = await getSession(projectId!, sessionId)
      const formattedMessages: Message[] = sessionMessages.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        createdAt: new Date(msg.createdAt),
      }))
      setCurrentSessionId(sessionId)
      loadSession(sessionId, formattedMessages)
    } catch (err) {
      console.error('Failed to load session:', err)
    } finally {
      setIsLoadingSession(false)
    }
  }, [projectId, currentSessionId, loadSession])

  // Show loading dots when waiting for response
  const lastMessage = messages[messages.length - 1]
  const showLoading =
    isLoading &&
    !streamingContent &&
    messages.length > 0 &&
    lastMessage?.role === 'user'

  const showStreamingBubble =
    isStreaming &&
    streamingContent &&
    !(lastMessage?.role === 'assistant' && lastMessage?.content === streamingContent)

  if (!isOpen || !projectId) return null

  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      {/* Header - matches AppHeader height: py-4 px-6 with p-1.5 / h-5 w-5 action buttons */}
      <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-6 py-4">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Co-pilot
        </h2>
        <div className="flex items-center gap-2">
          {/* Session history button */}
          <button
            type="button"
            onClick={() => setShowSessionList(!showSessionList)}
            className={`flex items-center justify-center p-1.5 transition-colors ${
              showSessionList
                ? 'text-[color:var(--foreground)]'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)]'
            }`}
            aria-label={showSessionList ? 'Back to chat' : 'Show conversation history'}
            title={showSessionList ? 'Back to chat' : 'Show conversation history'}
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          {/* New thread button */}
          <button
            type="button"
            onClick={handleNewThread}
            className="flex items-center justify-center p-1.5 text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--foreground)]"
            aria-label="Start new thread"
            title="Start new thread"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </button>
          {/* Close button */}
          <button
            type="button"
            onClick={close}
            className="flex items-center justify-center p-1.5 text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--foreground)]"
            aria-label="Close co-pilot (Esc)"
            title="Close co-pilot (Esc)"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {showSessionList ? (
        <>
          {/* Session list header */}
          <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-4 py-3">
            <button
              type="button"
              onClick={() => setShowSessionList(false)}
              className="flex items-center justify-center p-1 text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--foreground)]"
              aria-label="Back to chat"
            >
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Conversations
            </h3>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--accent)]" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-xs text-[color:var(--text-secondary)]">
                  No previous conversations
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === currentSessionId}
                    onClick={() => handleSelectSession(session.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {isLoadingSession ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--accent)]" />
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {showLoading && <LoadingIndicator />}
                {showStreamingBubble && (
                  <MessageBubble
                    message={{
                      id: 'streaming',
                      role: 'assistant',
                      content: streamingContent,
                    }}
                  />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-4 mb-2 rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-[color:var(--accent-danger)]/10 px-4 py-2">
              <p className="text-sm text-[color:var(--accent-danger)]">
                {error.message || 'Something went wrong. Please try again.'}
              </p>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={onSubmit}
            className="flex gap-2 border-t-2 border-[color:var(--border-subtle)] p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your project..."
              disabled={isLoading || isLoadingSession}
              className="flex-1"
            />
            {isStreaming ? (
              <Button type="button" onClick={cancelChat} variant="secondary">
                Cancel
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isLoading || isLoadingSession || !input.trim()}
                loading={isLoading}
              >
                Send
              </Button>
            )}
          </form>
        </>
      )}
    </aside>
  )
}
