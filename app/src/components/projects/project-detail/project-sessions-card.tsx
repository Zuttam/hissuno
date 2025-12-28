'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import type { SessionWithProject } from '@/types/session'

interface ProjectSessionsCardProps {
  projectId: string
}

export function ProjectSessionsCard({ projectId }: ProjectSessionsCardProps) {
  const [sessions, setSessions] = useState<SessionWithProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/sessions?projectId=${projectId}&limit=5`, {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error('Failed to load sessions')
      }
      const data = await response.json()
      setSessions(data.sessions ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  return (
    <Card className="lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-lg font-bold uppercase tracking-tight text-[color:var(--foreground)]">
          Recent Sessions
        </h3>
        <Link
          href={`/sessions?project=${projectId}`}
          className="font-mono text-sm text-[color:var(--accent-primary)] hover:underline"
        >
          View all sessions →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-6 text-center">
          <p className="text-sm text-[color:var(--text-secondary)]">
            No sessions yet. Sessions will appear here when users interact with your widget.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </Card>
  )
}

interface SessionRowProps {
  session: SessionWithProject
}

function SessionRow({ session }: SessionRowProps) {
  const truncatedId = session.id.length > 16 ? `${session.id.slice(0, 16)}...` : session.id
  
  // Get user display info from metadata or user_id
  const userDisplayName = session.user_metadata?.name || 
    session.user_metadata?.email || 
    session.user_id
  const truncatedUser = userDisplayName 
    ? (userDisplayName.length > 20 ? `${userDisplayName.slice(0, 20)}...` : userDisplayName)
    : null

  return (
    <Link
      href={`/sessions?project=${session.project_id}`}
      className="flex items-center justify-between rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--surface)] border border-[color:var(--border-subtle)]">
          <span className="text-xs font-medium text-[color:var(--text-secondary)]">
            {truncatedUser ? truncatedUser.charAt(0).toUpperCase() : '?'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[color:var(--foreground)]" title={userDisplayName || 'Anonymous'}>
            {truncatedUser || 'Anonymous'}
          </span>
          <span className="font-mono text-xs text-[color:var(--text-tertiary)]" title={session.id}>
            {truncatedId}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[color:var(--text-secondary)]">
          {session.message_count} messages
        </span>
        <Badge variant={session.status === 'active' ? 'success' : 'default'}>
          {session.status}
        </Badge>
        <span className="text-xs text-[color:var(--text-tertiary)]">
          {formatRelativeTime(session.last_activity_at)}
        </span>
      </div>
    </Link>
  )
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
