'use client'

import { useRef, useEffect, useState, useCallback, type KeyboardEvent, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Input } from '@/components/ui'
import { useHissunoChat, type ChatMessage, type Message } from '@hissuno/widget'
import { useUser } from '@/components/providers/auth-provider'
import { useProjectDetail } from '@/hooks/use-projects'

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

export default function TestAgentPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useUser()
  const { project, isLoading: isLoadingProject } = useProjectDetail({ projectId })

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => generateUniqueSessionId())

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
    projectId,
    initialMessage: 'Hi! How can I help you today?',
    userId: user?.id,
    sessionId: currentSessionId,
    userMetadata: user
      ? {
          email: user.email ?? '',
          ...(user.user_metadata?.full_name && { name: user.user_metadata.full_name }),
        }
      : undefined,
  })

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
    loadSession(newSessionId, [])
  }, [loadSession])

  const handleBack = useCallback(() => {
    router.push(`/projects/${projectId}`)
  }, [router, projectId])

  // Show loading dots only when waiting for stream to start (not during streaming)
  const showLoading =
    isLoading &&
    !isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'user'

  // Show streaming content as a live message bubble
  const lastMessage = messages[messages.length - 1]
  const showStreamingBubble =
    isStreaming &&
    streamingContent &&
    !(lastMessage?.role === 'assistant' && lastMessage?.content === streamingContent)

  if (isLoadingProject) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--accent)]" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-[color:var(--text-secondary)]">Project not found</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[color:var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
            aria-label="Back to project"
            title="Back to project"
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
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
            Test Agent: {project.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleNewThread}
          className="flex items-center gap-2 rounded-[4px] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          aria-label="Start new thread"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
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
          New Thread
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
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
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-auto mb-2 max-w-3xl px-6">
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-[color:var(--accent-danger)]/10 px-4 py-2">
            <p className="text-sm text-[color:var(--accent-danger)]">
              {error.message || 'Something went wrong. Please try again.'}
            </p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t-2 border-[color:var(--border-subtle)] p-4">
        <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or report an issue..."
            disabled={isLoading}
            className="flex-1"
          />
          {isStreaming ? (
            <Button type="button" onClick={cancelChat} variant="secondary">
              Cancel
            </Button>
          ) : (
            <Button type="submit" disabled={isLoading || !input.trim()} loading={isLoading}>
              Send
            </Button>
          )}
        </form>
      </div>
    </div>
  )
}
