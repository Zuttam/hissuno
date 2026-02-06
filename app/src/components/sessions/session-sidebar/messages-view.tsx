'use client'

import { useState, useCallback } from 'react'
import type { SessionWithProject, ChatMessage } from '@/types/session'
import { SessionChat } from '../session-chat'

interface MessagesViewProps {
  session: SessionWithProject
  messages: ChatMessage[]
  onMessageSent?: () => void
}

export function MessagesView({ session, messages, onMessageSent }: MessagesViewProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSessionActive = session.status !== 'closed'

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const content = input.trim()
      if (!content || isSending || !isSessionActive) return

      setError(null)
      setIsSending(true)

      try {
        const response = await fetch(`/api/projects/${session.project_id}/sessions/${session.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to send message')
        }

        setInput('')
        onMessageSent?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message')
      } finally {
        setIsSending(false)
      }
    },
    [input, isSending, isSessionActive, session.id, onMessageSent]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e)
      }
    },
    [handleSubmit]
  )

  return (
    <>
      {/* Human Takeover Banner */}
      {session.is_human_takeover && isSessionActive && (
        <div className="border-b border-[color:var(--border-subtle)] bg-[color:var(--accent-warning)]/10 px-4 py-2 text-center text-sm font-medium text-[color:var(--accent-warning)]">
          AI is paused &mdash; Human takeover is active
        </div>
      )}

      {/* Chat Content */}
      <div className="flex-1 overflow-hidden">
        <SessionChat messages={messages} />
      </div>

      {/* Reply Input */}
      {isSessionActive && (
        <div className="border-t-2 border-[color:var(--border-subtle)] p-4">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-2 rounded-[4px] bg-red-500/10 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply as human agent..."
                  disabled={isSending}
                  rows={2}
                  className="w-full resize-none rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[color:var(--accent-primary)] text-white transition hover:bg-[color:var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {isSending ? (
                  <svg
                    className="h-5 w-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
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
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--text-tertiary)]">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </div>
      )}

      {/* Closed session notice */}
      {!isSessionActive && (
        <div className="border-t-2 border-[color:var(--border-subtle)] p-4">
          <div className="rounded-[4px] bg-[color:var(--surface)] p-3 text-center text-sm text-[color:var(--text-secondary)]">
            This session is closed. You cannot send new messages.
          </div>
        </div>
      )}
    </>
  )
}
