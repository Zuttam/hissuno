'use client'

import { useEffect, useState } from 'react'
import { useSessions } from '@/hooks/use-sessions'
import type { SessionWithProject } from '@/types/session'

interface SessionListSidebarProps {
  projectId: string
  userId?: string
  currentSessionId: string | null
  isOpen: boolean
  onToggle: () => void
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
}

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

export function SessionListSidebar({
  projectId,
  userId,
  currentSessionId,
  isOpen,
  onToggle,
  onSelectSession,
  onNewSession,
}: SessionListSidebarProps) {
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const { sessions, isLoading, error, refresh } = useSessions({
    filters: {
      projectId,
      userId: userId || undefined,
      limit: 20,
    },
  })

  // Auto-collapse on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      onToggle()
    }
    // Only run when isMobile changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile])

  if (!isOpen) {
    return null
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] px-4 py-3">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--foreground)]">
          Sessions
        </h3>
        <button
          type="button"
          onClick={onNewSession}
          className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          aria-label="New thread"
          title="New thread"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--accent)]" />
          </div>
        ) : error ? (
          <div className="p-3 text-center">
            <p className="text-xs text-[color:var(--accent-danger)]">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-2 text-xs text-[color:var(--accent)] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-3 text-center">
            <p className="text-xs text-[color:var(--text-secondary)]">
              No previous sessions
            </p>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
              Start chatting to create your first session
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                onClick={() => onSelectSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
