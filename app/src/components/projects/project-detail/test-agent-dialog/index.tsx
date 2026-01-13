'use client'

import { useRef, useEffect, useState, useCallback, type KeyboardEvent, type FormEvent } from 'react'
import { Button, Input } from '@/components/ui'
import { useHissunoChat, type ChatMessage, type Message } from '@hissuno/widget'
import { useUser } from '@/components/providers/auth-provider'
import { useSessions } from '@/hooks/use-sessions'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { SessionListSidebar } from './session-list-sidebar'

interface TestAgentDialogProps {
  project: ProjectWithCodebase
  onClose: () => void
}

function generateUniqueSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 9)
  return `session_${timestamp}_${random}`
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-[4px] px-4 py-3 ${
          isUser
            ? 'bg-[color:var(--accent-selected)] text-white'
            : 'border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[color:var(--foreground)]'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
      </div>
    </div>
  )
}

function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--text-tertiary)] [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--text-tertiary)] [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--text-tertiary)]" />
      </div>
    </div>
  )
}

export function TestAgentDialog({ project, onClose }: TestAgentDialogProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useUser()

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(true) // Start loading
  const [isInitialized, setIsInitialized] = useState(false)

  // Fetch existing sessions for this user
  const { sessions, isLoading: isLoadingSessions, refresh: refreshSessions } = useSessions({
    filters: {
      projectId: project.id,
      userId: user?.id || undefined,
      limit: 1, // We only need the most recent one for initialization
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
    clearHistory,
    loadSession,
    cancelChat,
  } = useHissunoChat({
    projectId: project.id,
    initialMessage: 'Hi! How can I help you today?',
    userId: user?.id,
    sessionId: currentSessionId || undefined,
    userMetadata: user
      ? {
          email: user.email ?? '',
          ...(user.user_metadata?.full_name && { name: user.user_metadata.full_name }),
        }
      : undefined,
  })

  // Initialize: load most recent session or create new one
  useEffect(() => {
    if (isInitialized || isLoadingSessions) return

    const initializeSession = async () => {
      if (sessions.length > 0) {
        // Load the most recent session
        const latestSession = sessions[0]
        try {
          const response = await fetch(`/api/sessions/${latestSession.id}`)
          if (response.ok) {
            const { messages: sessionMessages } = await response.json()
            const formattedMessages: Message[] = sessionMessages.map((msg: { id: string; role: string; content: string; createdAt: string }) => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              createdAt: new Date(msg.createdAt),
            }))
            setCurrentSessionId(latestSession.id)
            loadSession(latestSession.id, formattedMessages)
          } else {
            // Failed to load session - create new one
            setCurrentSessionId(generateUniqueSessionId())
          }
        } catch {
          // Error loading session - create new one
          setCurrentSessionId(generateUniqueSessionId())
        }
      } else {
        // No existing sessions - create a new one
        setCurrentSessionId(generateUniqueSessionId())
      }
      setIsLoadingSession(false)
      setIsInitialized(true)
    }

    initializeSession()
  }, [isLoadingSessions, sessions, isInitialized, loadSession])

  // Auto-scroll to bottom when messages change or streaming content updates
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
    clearHistory()
    // Refresh sessions list after first message is sent
    // The session will appear after the user sends a message
  }, [clearHistory])

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return

    setIsLoadingSession(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (!response.ok) {
        throw new Error('Failed to load session')
      }
      const { messages: sessionMessages } = await response.json()

      // Convert to Message format expected by loadSession
      const formattedMessages: Message[] = sessionMessages.map((msg: { id: string; role: string; content: string; createdAt: string }) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        createdAt: new Date(msg.createdAt),
      }))

      setCurrentSessionId(sessionId)
      loadSession(sessionId, formattedMessages)

      // Close sidebar on mobile after selection
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false)
      }
    } catch (err) {
      console.error('Failed to load session:', err)
    } finally {
      setIsLoadingSession(false)
    }
  }, [currentSessionId, loadSession])

  // Show loading dots only when waiting for stream to start (not during streaming)
  const showLoading =
    isLoading &&
    !isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'user'

  // Show streaming content as a live message bubble
  const showStreamingBubble = isStreaming && streamingContent

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--background)]/80 backdrop-blur-sm">
      <div className="flex h-[600px] w-full max-w-3xl overflow-hidden rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-lg">
        {/* Session List Sidebar */}
        <SessionListSidebar
          projectId={project.id}
          userId={user?.id}
          currentSessionId={currentSessionId}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewThread}
        />

        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] px-6 py-4">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle button */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
                aria-label={isSidebarOpen ? 'Hide session history' : 'Show session history'}
                title={isSidebarOpen ? 'Hide session history' : 'Show session history'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
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
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
                Test: {project.name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* New thread button */}
              <button
                type="button"
                onClick={handleNewThread}
                className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
                aria-label="Start new thread"
                title="Start new thread"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="8" x2="12" y2="14" />
                  <line x1="9" y1="11" x2="15" y2="11" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
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
            <div className="mx-6 mb-2 rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-[color:var(--accent-danger)]/10 px-4 py-2">
              <p className="text-sm text-[color:var(--accent-danger)]">
                {error.message || 'Something went wrong. Please try again.'}
              </p>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={onSubmit}
            className="flex gap-3 border-t-2 border-[color:var(--border-subtle)] p-4"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or report an issue..."
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
        </div>
      </div>
    </div>
  )
}
