'use client'

import { Badge } from '@/components/ui'
import type { SessionWithProject } from '@/types/session'

interface SessionsTableProps {
  sessions: SessionWithProject[]
  selectedSessionId: string | null
  onSelectSession: (session: SessionWithProject) => void
}

export function SessionsTable({
  sessions,
  selectedSessionId,
  onSelectSession,
}: SessionsTableProps) {
  return (
    <div className="overflow-hidden rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)]">
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Session
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              User
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Project
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Page
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Messages
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
              Last Activity
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
}

function SessionRow({ session, isSelected, onSelect }: SessionRowProps) {
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
      <td className="px-4 py-3">
        <span className="text-[color:var(--foreground)]" title={session.id}>
          {truncatedId}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[color:var(--text-secondary)]">
          {session.user_id || '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[color:var(--foreground)]">
          {session.project?.name || '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className="text-[color:var(--text-secondary)]"
          title={session.page_url || undefined}
        >
          {truncatedPage || '-'}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-[color:var(--foreground)]">
          {session.message_count}
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge variant={session.status === 'active' ? 'success' : 'default'}>
          {session.status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <span className="text-[color:var(--text-secondary)]">
          {formatRelativeTime(session.last_activity_at)}
        </span>
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
