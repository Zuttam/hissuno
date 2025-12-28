'use client'

import { useState, useCallback } from 'react'
import type { SessionWithProject, SessionFilters } from '@/types/session'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { useSessions, useSessionDetail } from '@/hooks/use-sessions'
import { SessionsFilters } from './sessions-filters'
import { SessionsTable } from './sessions-table'
import { SessionSidebar } from './session-sidebar'

interface SessionsPageProps {
  initialSessions: SessionWithProject[]
  projects: ProjectWithCodebase[]
  initialProjectFilter?: string
  initialSessionId?: string
}

export function SessionsPage({
  initialSessions,
  projects,
  initialProjectFilter,
  initialSessionId,
}: SessionsPageProps) {
  const [filters, setFilters] = useState<SessionFilters>({
    projectId: initialProjectFilter,
  })
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId ?? null)

  const { sessions, isLoading, error, refresh } = useSessions({
    initialSessions,
    filters,
  })

  const { session: selectedSession, messages, isLoading: isLoadingDetail } = useSessionDetail({
    sessionId: selectedSessionId,
  })

  const handleFilterChange = useCallback((newFilters: SessionFilters) => {
    setFilters(newFilters)
  }, [])

  const handleSessionSelect = useCallback((session: SessionWithProject) => {
    setSelectedSessionId(session.id)
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSelectedSessionId(null)
  }, [])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[color:var(--background)] px-8 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col justify-between gap-6 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-8 md:flex-row md:items-center">
          <div className="space-y-2">
            <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              Sessions
            </h1>
            <p className="max-w-2xl text-sm text-[color:var(--text-secondary)]">
              View and analyze conversations from your support widget. Click on a session to see the full conversation.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-5 py-3 font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
            >
              Refresh
            </button>
          </div>
        </header>

        <SessionsFilters
          projects={projects}
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
            {error}
          </div>
        )}

        {isLoading && sessions.length === 0 ? (
          <SessionsSkeleton />
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <SessionsTable
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={handleSessionSelect}
          />
        )}
      </div>

      {selectedSessionId && (
        <SessionSidebar
          session={selectedSession}
          messages={messages}
          isLoading={isLoadingDetail}
          onClose={handleCloseSidebar}
        />
      )}
    </div>
  )
}

function SessionsSkeleton() {
  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)]">
      <div className="animate-pulse">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-16 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface)]"
          />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-10 py-14 text-center">
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="font-mono text-2xl font-bold uppercase text-[color:var(--foreground)]">
          No sessions yet
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          Sessions will appear here when users interact with your support widget.
          Make sure you have the widget integrated in your app.
        </p>
      </div>
    </div>
  )
}
