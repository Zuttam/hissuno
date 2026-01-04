'use client'

import { Badge } from '@/components/ui'
import type { SessionWithProject } from '@/types/session'
import { SessionTagList } from './session-tag-badge'

interface SessionsTableProps {
  sessions: SessionWithProject[]
  selectedSessionId: string | null
  onSelectSession: (session: SessionWithProject) => void
  onOpenMessages: (session: SessionWithProject) => void
}

export function SessionsTable({
  sessions,
  selectedSessionId,
  onSelectSession,
  onOpenMessages,
}: SessionsTableProps) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-[color:var(--border-subtle)] bg-[color:var(--surface)]">
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Session
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              User
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Project
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Page
            </th>
            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Messages
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Tags
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Status
            </th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Last Activity
            </th>
            <th className="w-12 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onSelect={() => onSelectSession(session)}
              onOpenMessages={() => onOpenMessages(session)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface SessionRowProps {
  session: SessionWithProject
  isSelected: boolean
  onSelect: () => void
  onOpenMessages: () => void
}

function SessionRow({ session, isSelected, onSelect, onOpenMessages }: SessionRowProps) {
  const truncatedId = session.id.length > 12 ? `${session.id.slice(0, 12)}...` : session.id
  const truncatedPage = session.page_title
    ? session.page_title.length > 30
      ? `${session.page_title.slice(0, 30)}...`
      : session.page_title
    : getPathFromUrl(session.page_url)

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-[color:var(--border-subtle)] transition-colors ${
        isSelected
          ? 'bg-[color:var(--accent-primary)]/10'
          : 'hover:bg-[color:var(--surface-hover)]'
      }`}
    >
      <td className="px-3 py-2">
        <span className="text-[color:var(--foreground)]" title={session.id}>
          {truncatedId}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="text-[color:var(--text-secondary)]">
          {session.user_id || '-'}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="text-[color:var(--foreground)]">
          {session.project?.name || '-'}
        </span>
      </td>
      <td className="px-3 py-2">
        <span
          className="text-[color:var(--text-secondary)]"
          title={session.page_url || undefined}
        >
          {truncatedPage || '-'}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className="text-[color:var(--foreground)]">
          {session.message_count}
        </span>
      </td>
      <td className="px-3 py-2">
        {session.tags && session.tags.length > 0 ? (
          <SessionTagList tags={session.tags} size="sm" emptyText="" />
        ) : (
          <span className="text-[color:var(--text-tertiary)]">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        <Badge variant={session.status === 'active' ? 'success' : 'default'}>
          {session.status}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <span className="text-[color:var(--text-secondary)]">
          {formatRelativeTime(session.last_activity_at)}
        </span>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpenMessages()
          }}
          className="rounded-[4px] p-1.5 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-primary)]"
          aria-label="View messages"
          title="View messages"
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
          </svg>
        </button>
      </td>
    </tr>
  )
}

function getPathFromUrl(url: string | null): string {
  if (!url) return ''
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.pathname.length > 30
      ? `${parsedUrl.pathname.slice(0, 30)}...`
      : parsedUrl.pathname
  } catch {
    return url.length > 30 ? `${url.slice(0, 30)}...` : url
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return 'Just now'
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}
