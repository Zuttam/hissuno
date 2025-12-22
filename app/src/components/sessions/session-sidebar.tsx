'use client'

import { Badge, Spinner } from '@/components/ui'
import type { SessionWithProject, ChatMessage } from '@/types/session'
import { SessionChat } from './session-chat'

interface SessionSidebarProps {
  session: SessionWithProject | null
  messages: ChatMessage[]
  isLoading: boolean
  onClose: () => void
}

export function SessionSidebar({
  session,
  messages,
  isLoading,
  onClose,
}: SessionSidebarProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] p-4">
          <h2 className="font-mono text-lg font-bold uppercase tracking-tight text-[color:var(--foreground)]">
            Session Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
            aria-label="Close sidebar"
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

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : session ? (
          <>
            {/* Session Details */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <SessionDetails session={session} />
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-hidden">
              <SessionChat messages={messages} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[color:var(--text-secondary)]">Session not found</p>
          </div>
        )}
      </aside>
    </>
  )
}

interface SessionDetailsProps {
  session: SessionWithProject
}

function SessionDetails({ session }: SessionDetailsProps) {
  return (
    <div className="space-y-4">
      {/* Status and Project */}
      <div className="flex items-center justify-between">
        <Badge variant={session.status === 'active' ? 'success' : 'default'}>
          {session.status}
        </Badge>
        <span className="font-mono text-sm text-[color:var(--foreground)]">
          {session.project?.name || 'Unknown Project'}
        </span>
      </div>

      {/* Session ID */}
      <div className="space-y-1">
        <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          Session ID
        </label>
        <p className="break-all font-mono text-sm text-[color:var(--foreground)]">
          {session.id}
        </p>
      </div>

      {/* User */}
      {session.user_id && (
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            User ID
          </label>
          <p className="font-mono text-sm text-[color:var(--foreground)]">
            {session.user_id}
          </p>
        </div>
      )}

      {/* User Metadata */}
      {session.user_metadata && Object.keys(session.user_metadata).length > 0 && (
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            User Info
          </label>
          <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-2">
            {Object.entries(session.user_metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-[color:var(--text-secondary)]">{key}:</span>
                <span className="text-[color:var(--foreground)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page */}
      {(session.page_title || session.page_url) && (
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Page
          </label>
          {session.page_title && (
            <p className="text-sm text-[color:var(--foreground)]">
              {session.page_title}
            </p>
          )}
          {session.page_url && (
            <a
              href={session.page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-[color:var(--accent-primary)] hover:underline"
            >
              {session.page_url}
            </a>
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Created
          </label>
          <p className="text-[color:var(--foreground)]">
            {formatDateTime(session.created_at)}
          </p>
        </div>
        <div className="space-y-1">
          <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Last Activity
          </label>
          <p className="text-[color:var(--foreground)]">
            {formatDateTime(session.last_activity_at)}
          </p>
        </div>
      </div>

      {/* Message Count */}
      <div className="flex items-center justify-between rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
        <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          Total Messages
        </span>
        <span className="font-mono text-lg font-bold text-[color:var(--foreground)]">
          {session.message_count}
        </span>
      </div>
    </div>
  )
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
