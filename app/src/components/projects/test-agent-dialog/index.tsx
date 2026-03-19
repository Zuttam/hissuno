'use client'

import { useRef, useEffect, useState, useCallback, type KeyboardEvent, type FormEvent } from 'react'
import { Button, Input } from '@/components/ui'
import { useHissunoChat, type ChatMessage, type Message } from '@hissuno/widget'
import { useUser } from '@/components/providers/auth-provider'
import { useSessions } from '@/hooks/use-sessions'
import { getSession } from '@/lib/api/sessions'
import type { ProjectRow } from '@/lib/db/queries/projects'

interface TestAgentDialogProps {
  project: ProjectRow
  packageId?: string
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

export function TestAgentDialog({ project, packageId, onClose }: TestAgentDialogProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useUser()

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true) // Start loading
  const [isInitialized, setIsInitialized] = useState(false)

  // Fetch existing sessions for this user
  const { sessions, isLoading: isLoadingSessions, refresh: refreshSessions } = useSessions({
    filters: {
      projectId: project.id,
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
    loadSession,
    cancelChat,
  } = useHissunoChat({
    projectId: project.id,
    apiUrl: '/api/integrations/widget/chat',
    initialMessage: 'Hi! How can I help you today?',
    userId: user?.id,
    sessionId: currentSessionId || undefined,
    packageId,
    userMetadata: user
      ? {
          email: user.email ?? '',
          ...(user.name && { name: user.name }),
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
          const { messages: sessionMessages } = await getSession(project.id, latestSession.id)
          const formattedMessages: Message[] = sessionMessages.map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            createdAt: new Date(msg.createdAt),
          }))
          setCurrentSessionId(latestSession.id)
          loadSession(latestSession.id, formattedMessages)
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
    // Generate new session ID and use loadSession to properly reset
    // Don't use clearHistory() as it generates its own ID causing state mismatch
    const newSessionId = generateUniqueSessionId()
    setCurrentSessionId(newSessionId)
    loadSession(newSessionId, [])
  }, [loadSession])

  // Show loading dots when waiting for response (isLoading but no streaming content yet)
  const lastMessage = messages[messages.length - 1]
  const showLoading =
    isLoading &&
    !streamingContent &&
    messages.length > 0 &&
    lastMessage?.role === 'user'

  // Show streaming content as a live message bubble
  // Guard: don't show streaming bubble if last message already has this content (prevents brief duplicate)
  const showStreamingBubble =
    isStreaming &&
    streamingContent &&
    !(lastMessage?.role === 'assistant' && lastMessage?.content === streamingContent)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--background)]/80 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-5xl overflow-hidden rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-lg">
        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] px-6 py-4">
            <div className="flex items-center gap-3">
              {/* Back button */}
              <button
                type="button"
                onClick={onClose}
                className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
                aria-label="Back"
                title="Back"
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
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
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
