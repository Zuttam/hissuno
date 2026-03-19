'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui'
import { SessionTagList } from '@/components/sessions/session-tags'
import type { SessionWithProject } from '@/types/session'
import { listSessions } from '@/lib/api/sessions'

interface SessionPickerProps {
  projectId: string
  selectedSessionIds: string[]
  onToggleSession: (sessionId: string) => void
  excludeSessionIds?: string[]
}

export function SessionPicker({
  projectId,
  selectedSessionIds,
  onToggleSession,
  excludeSessionIds = [],
}: SessionPickerProps) {
  const [sessions, setSessions] = useState<SessionWithProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounce search input
  useEffect(() => {
    if (searchQuery === debouncedQuery) return
    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(debounceTimerRef.current)
  }, [searchQuery, debouncedQuery])

  useEffect(() => {
    if (!projectId) {
      setSessions([])
      return
    }

    const fetchSessions = async () => {
      setIsLoading(true)
      try {
        const filters: { limit: number; search?: string } = { limit: 50 }
        if (debouncedQuery.trim().length >= 2) {
          filters.search = debouncedQuery.trim()
        }
        const data = await listSessions(projectId, filters)
        setSessions(data.sessions ?? [])
      } catch {
        console.error('[SessionPicker] Failed to fetch sessions')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchSessions()
  }, [projectId, debouncedQuery])

  const excludeSet = new Set(excludeSessionIds)
  const filteredSessions = sessions.filter((s) => !excludeSet.has(s.id))

  const searchInput = (
    <div className="relative mb-2">
      <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-tertiary)]" />
      <Input
        type="text"
        placeholder="Search messages..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-7 w-full rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent pl-7 pr-2 text-xs"
      />
    </div>
  )

  if (isLoading) {
    return (
      <>
        {searchInput}
        <div className="flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading feedback...
        </div>
      </>
    )
  }

  if (filteredSessions.length === 0) {
    return (
      <>
        {searchInput}
        <p className="text-xs text-[color:var(--text-tertiary)]">
          {debouncedQuery.trim().length >= 2
            ? 'No feedback matching your search.'
            : 'No feedback found for this project.'}
        </p>
      </>
    )
  }

  return (
    <>
    {searchInput}
    <div className="max-h-48 overflow-y-auto rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)]">
      {filteredSessions.map((session) => (
        <label
          key={session.id}
          className="flex cursor-pointer items-start gap-3 border-b border-[color:var(--border-subtle)] px-3 py-2 last:border-b-0 hover:bg-[color:var(--surface-hover)]"
        >
          <input
            type="checkbox"
            checked={selectedSessionIds.includes(session.id)}
            onChange={() => onToggleSession(session.id)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[color:var(--border)] accent-[color:var(--accent-selected)]"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span
                className="truncate text-xs font-medium text-[color:var(--foreground)]"
                title={session.page_title || session.page_url || session.id}
              >
                {getSessionDisplayTitle(session)}
              </span>
              {session.tags && session.tags.length > 0 && (
                <div className="shrink-0">
                  <SessionTagList tags={session.tags} size="sm" emptyText="" />
                </div>
              )}
            </div>
            {session.page_title && session.page_url && (
              <span className="truncate text-[10px] text-[color:var(--text-tertiary)]">
                {getPathFromUrl(session.page_url)}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[10px] text-[color:var(--text-tertiary)]">
            <span>{session.message_count} msg{session.message_count !== 1 ? 's' : ''}</span>
            <span>{formatRelativeTime(session.last_activity_at)}</span>
          </div>
        </label>
      ))}
    </div>
    </>
  )
}

function getSessionDisplayTitle(session: SessionWithProject): string {
  if (session.page_title) {
    return session.page_title.length > 35
      ? `${session.page_title.slice(0, 35)}...`
      : session.page_title
  }
  const pathFromUrl = getPathFromUrl(session.page_url)
  if (pathFromUrl && pathFromUrl !== '/') {
    return pathFromUrl
  }
  return session.id.length > 16 ? `${session.id.slice(0, 8)}...${session.id.slice(-4)}` : session.id
}

function getPathFromUrl(url: string | null): string {
  if (!url) return ''
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.pathname.length > 40
      ? `${parsedUrl.pathname.slice(0, 40)}...`
      : parsedUrl.pathname
  } catch {
    return url.length > 40 ? `${url.slice(0, 40)}...` : url
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}
