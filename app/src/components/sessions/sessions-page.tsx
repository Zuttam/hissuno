'use client'

import { useState, useCallback, useEffect } from 'react'
import type { SessionWithProject, SessionFilters } from '@/types/session'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { useSessions, useSessionDetail } from '@/hooks/use-sessions'
import { SessionsFilters } from './sessions-filters'
import { SessionsTable } from './sessions-table'
import { SessionSidebar } from './session-sidebar'
import { CreateSessionDialog } from './create-session-dialog'
import { IconButton } from '@/components/ui/icon-button'
import { RefreshIcon } from '@/components/ui/refresh-icon'
import { Button } from '@/components/ui/button'
import { FloatingCard } from '@/components/ui/floating-card'

type SessionView = 'messages' | 'details'

interface SessionsPageProps {
  initialSessions: SessionWithProject[]
  projects: ProjectWithCodebase[]
  initialProjectFilter?: string
  initialSessionId?: string
  initialView?: SessionView
}

export function SessionsPage({
  initialSessions,
  projects,
  initialProjectFilter,
  initialSessionId,
  initialView = 'messages',
}: SessionsPageProps) {
  const [filters, setFilters] = useState<SessionFilters>({
    projectId: initialProjectFilter,
  })
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId ?? null)
  const [view, setView] = useState<SessionView>(initialView)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Update URL when selectedSessionId or view changes
  useEffect(() => {
    if (selectedSessionId) {
      const path = view === 'messages'
        ? `/sessions/${selectedSessionId}/messages`
        : `/sessions/${selectedSessionId}`
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path)
      }
    } else {
      if (window.location.pathname !== '/sessions') {
        window.history.pushState(null, '', '/sessions')
      }
    }
  }, [selectedSessionId, view])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/^\/sessions\/([^/]+)(\/messages)?$/)
      if (match) {
        setSelectedSessionId(match[1])
        setView(match[2] ? 'messages' : 'details')
      } else {
        setSelectedSessionId(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const { sessions, isLoading, error, refresh, createSession, archiveSession } = useSessions({
    initialSessions,
    filters,
  })

  const {
    session: selectedSession,
    messages,
    isLoading: isLoadingDetail,
    refresh: refreshSessionDetail,
  } = useSessionDetail({
    sessionId: selectedSessionId,
  })

  const handleFilterChange = useCallback((newFilters: SessionFilters) => {
    setFilters(newFilters)
  }, [])

  const handleSessionSelect = useCallback((session: SessionWithProject) => {
    setSelectedSessionId(session.id)
    setView('details') // Open details view when clicking row
  }, [])

  const handleOpenMessages = useCallback((session: SessionWithProject) => {
    setSelectedSessionId(session.id)
    setView('messages') // Open messages view when clicking messages icon
  }, [])

  const handleViewChange = useCallback((newView: SessionView) => {
    setView(newView)
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSelectedSessionId(null)
  }, [])

  const handleSessionUpdated = useCallback(() => {
    void refreshSessionDetail()
    void refresh()
  }, [refreshSessionDetail, refresh])

  const handleArchiveSession = useCallback(async (session: SessionWithProject) => {
    await archiveSession(session.id, !session.is_archived)
  }, [archiveSession])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <FloatingCard floating="gentle" variant="default" className="flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              Sessions
            </h1>
            <IconButton
              aria-label="Refresh sessions"
              variant="ghost"
              size="md"
              onClick={() => void refresh()}
            >
              <RefreshIcon />
            </IconButton>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          >
            Create
          </Button>
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
            onOpenMessages={handleOpenMessages}
            onArchive={handleArchiveSession}
          />
        )}
      </FloatingCard>

      {selectedSessionId && (
        <SessionSidebar
          session={selectedSession}
          messages={messages}
          isLoading={isLoadingDetail}
          onClose={handleCloseSidebar}
          onSessionUpdated={handleSessionUpdated}
          view={view}
          onViewChange={handleViewChange}
        />
      )}

      <CreateSessionDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        projects={projects}
        onCreateSession={createSession}
      />
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
