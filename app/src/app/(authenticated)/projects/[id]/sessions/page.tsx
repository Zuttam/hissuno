'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { SessionWithProject, SessionFilters } from '@/types/session'
import { useProject } from '@/components/providers/project-provider'
import { useSessions, useSessionDetail } from '@/hooks/use-sessions'
import { SessionsFilters } from '@/components/sessions/sessions-filters'
import { SessionsTable } from '@/components/sessions/sessions-table'
import { SessionSidebar } from '@/components/sessions/session-sidebar'
import { CreateSessionDialog } from '@/components/sessions/create-session-dialog'
import { SessionsSettingsDialog } from '@/components/projects/edit-dialogs/sessions-settings-dialog'
import { Button, PageHeader, Spinner } from '@/components/ui'
import { FloatingCard } from '@/components/ui/floating-card'
import { AnalyticsStrip } from '@/components/analytics'
import { generateCSV, formatDateForCSV, formatArrayForCSV, type CSVColumn } from '@/lib/utils/csv'
import { downloadAsCSV, generateExportFilename } from '@/lib/utils/download'

type SessionView = 'messages' | 'details'

export default function ProjectSessionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [filters, setFilters] = useState<SessionFilters>({})
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [view, setView] = useState<SessionView>('messages')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  // Auto-open dialog based on URL param
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog === 'settings') {
      setShowSettingsDialog(true)
    } else if (dialog === 'create') {
      setShowCreateDialog(true)
    }
  }, [searchParams])

  // Clear URL param when dialog closes
  const handleCloseSettingsDialog = () => {
    setShowSettingsDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/sessions`)
    }
  }

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/sessions`)
    }
  }

  // Set project filter when projectId becomes available
  useEffect(() => {
    if (projectId) {
      setFilters(prev => ({ ...prev, projectId }))
    }
  }, [projectId])

  // Update URL when selectedSessionId or view changes
  useEffect(() => {
    if (!projectId) return
    if (selectedSessionId) {
      const basePath = `/projects/${projectId}/sessions`
      const path = view === 'messages'
        ? `${basePath}/${selectedSessionId}/messages`
        : `${basePath}/${selectedSessionId}`
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path)
      }
    } else {
      const basePath = `/projects/${projectId}/sessions`
      if (window.location.pathname !== basePath) {
        window.history.pushState(null, '', basePath)
      }
    }
  }, [selectedSessionId, view, projectId])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/projects\/[^/]+\/sessions\/([^/]+)(\/messages)?$/)
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
    filters,
  })

  const {
    session: selectedSession,
    messages,
    isLoading: isLoadingDetail,
    refresh: refreshSessionDetail,
    updateSession,
  } = useSessionDetail({
    sessionId: selectedSessionId,
  })

  const handleFilterChange = useCallback((newFilters: SessionFilters) => {
    // Keep project filter fixed
    if (projectId) {
      setFilters({ ...newFilters, projectId })
    }
  }, [projectId])

  const handleSessionSelect = useCallback((session: SessionWithProject) => {
    setSelectedSessionId(session.id)
    setView('details')
  }, [])

  const handleOpenMessages = useCallback((session: SessionWithProject) => {
    setSelectedSessionId(session.id)
    setView('messages')
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

  const handleExportCSV = useCallback(() => {
    if (sessions.length === 0) return

    const columns: CSVColumn<SessionWithProject>[] = [
      { key: 'id', header: 'Session ID' },
      { key: 'name', header: 'Name', transform: (v) => (v as string) || '' },
      { key: 'user_id', header: 'User ID', transform: (v) => (v as string) || '' },
      { key: 'project.name', header: 'Project', transform: (v) => (v as string) || '' },
      { key: 'source', header: 'Source' },
      { key: 'page_url', header: 'Page URL', transform: (v) => (v as string) || '' },
      { key: 'page_title', header: 'Page Title', transform: (v) => (v as string) || '' },
      { key: 'message_count', header: 'Messages', transform: (v) => String(v ?? 0) },
      { key: 'tags', header: 'Tags', transform: (v) => formatArrayForCSV(v as string[]) },
      { key: 'status', header: 'Status' },
      { key: 'is_archived', header: 'Archived', transform: (v) => v ? 'Yes' : 'No' },
      { key: 'created_at', header: 'Created', transform: (v) => formatDateForCSV(v as string) },
      { key: 'last_activity_at', header: 'Last Activity', transform: (v) => formatDateForCSV(v as string) },
    ]

    const csv = generateCSV(sessions, columns)
    const filename = generateExportFilename('sessions', project?.name)
    downloadAsCSV(csv, filename)
  }, [sessions, project?.name])

  // Handlers for opening dialogs - updates URL for consistent tracking
  const handleOpenSettingsDialog = () => {
    router.push(`/projects/${projectId}/sessions?dialog=settings`)
  }

  const handleOpenCreateDialog = () => {
    router.push(`/projects/${projectId}/sessions?dialog=create`)
  }

  // Show loading state
  if (isLoadingProject || !project || !projectId) {
    return (
      <>
        <PageHeader title="Sessions" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Sessions"
        onRefresh={() => void refresh()}
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={handleExportCSV}
              disabled={sessions.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={handleOpenSettingsDialog}
            >
              Settings
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenCreateDialog}
            >
              Create
            </Button>
          </>
        }
      />

      <AnalyticsStrip type="sessions" projectId={projectId} />

      <FloatingCard floating="gentle" variant="default" className="flex flex-col gap-6">
        <SessionsFilters
          projects={[project]} // Single project only
          filters={filters}
          onFilterChange={handleFilterChange}
          hideProjectFilter // Hide project dropdown since it's implicit
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
          onUpdateSession={updateSession}
          view={view}
          onViewChange={handleViewChange}
        />
      )}

      <CreateSessionDialog
        open={showCreateDialog}
        onClose={handleCloseCreateDialog}
        projects={[project]}
        onCreateSession={createSession}
      />

      <SessionsSettingsDialog
        open={showSettingsDialog}
        onClose={handleCloseSettingsDialog}
        projectId={projectId}
      />
    </>
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
