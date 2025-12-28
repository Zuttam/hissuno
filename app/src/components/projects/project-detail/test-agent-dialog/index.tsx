'use client'

import { useRef, useEffect, type KeyboardEvent, type FormEvent } from 'react'
import { Button, Input } from '@/components/ui'
import { useHissunoChat, type ChatMessage } from '@hissuno/widget'
import { useUser } from '@/components/providers/auth-provider'
import type { ProjectWithCodebase } from '@/lib/projects/queries'

interface TestAgentDialogProps {
  project: ProjectWithCodebase & {
    public_key?: string | null
  }
  onClose: () => void
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
  const publicKey = project.public_key
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useUser()

  const { messages, input, setInput, handleSubmit, isLoading, error, clearHistory } =
    useHissunoChat({
      publicKey: publicKey ?? '',
      initialMessage: 'Hi! How can I help you today?',
      userId: user?.id,
      userMetadata: user ? {
        email: user.email ?? '',
        ...(user.user_metadata?.full_name && { name: user.user_metadata.full_name }),
      } : undefined,
    })

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

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

  // Show loading when the last message is from user (waiting for assistant response)
  const showLoading =
    isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user'

  if (!publicKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--background)]/80 backdrop-blur-sm">
        <div className="w-full max-w-md space-y-6 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-8">
          <div className="space-y-2">
            <h2 className="font-mono text-lg font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
              Public Key Required
            </h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              A public key must be generated before testing the agent. Please
              ensure the project has a public key configured.
            </p>
          </div>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--background)]/80 backdrop-blur-sm">
      <div className="flex h-[600px] w-full max-w-lg flex-col rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] px-6 py-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
            Test: {project.name}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearHistory}
              className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              aria-label="Clear chat history"
              title="Clear chat history"
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
                <polyline points="3,6 5,6 21,6" />
                <path d="M19,6v14a2,2 0,0 1,-2,2H7a2,2 0,0 1,-2,-2V6m3,0V4a2,2 0,0 1,2,-2h4a2,2 0,0 1,2,2v2" />
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
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {showLoading && <LoadingIndicator />}
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
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} loading={isLoading}>
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}
