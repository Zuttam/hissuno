'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { SessionWithProject, SessionFilters, SessionSource } from '@/types/session'
import { useProject } from '@/components/providers/project-provider'
import { useSessions, useSessionDetail } from '@/hooks/use-sessions'
import { useCompanies } from '@/hooks/use-companies'
import { useContacts } from '@/hooks/use-contacts'
import { useTableSelection } from '@/hooks/use-table-selection'
import { useBatchAsync } from '@/hooks/use-batch-async'
import { SessionsFilters } from '@/components/sessions/sessions-filters'
import { SessionsTable } from '@/components/sessions/sessions-table'
import { SessionSidebar } from '@/components/sessions/session-sidebar'
import { CreateSessionDialog } from '@/components/sessions/create-session-dialog'
import { ContactPickerDialog } from '@/components/sessions/contact-picker-dialog'
import { SessionsSettingsDialog } from '@/components/projects/edit-dialogs/sessions-settings-dialog'
import { Button, PageHeader, Pagination, Spinner } from '@/components/ui'
import { FloatingCard } from '@/components/ui/floating-card'
import { BatchActionBar } from '@/components/ui/batch-action-bar'
import { BatchProgressBar } from '@/components/ui/batch-progress-bar'
import { AnalyticsStrip } from '@/components/analytics'
import { generateCSV, formatDateForCSV, formatArrayForCSV, type CSVColumn } from '@/lib/utils/csv'
import { downloadAsCSV, generateExportFilename } from '@/lib/utils/download'

const PAGE_SIZE = 25

export default function ProjectSessionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [filters, setFilters] = useState<SessionFilters>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [expandMessages, setExpandMessages] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  // Auto-open dialog or sidebar based on URL params
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog === 'settings') {
      setShowSettingsDialog(true)
    } else if (dialog === 'create') {
      setShowCreateDialog(true)
    }
    const sessionParam = searchParams.get('session')
    if (sessionParam) {
      setSelectedSessionId(sessionParam)
    }
    const sourceParam = searchParams.get('source')
    if (sourceParam) {
      setFilters(prev => ({ ...prev, source: sourceParam as SessionSource }))
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

  // Update URL when selectedSessionId changes
  useEffect(() => {
    if (!projectId) return
    if (selectedSessionId) {
      const path = `/projects/${projectId}/sessions/${selectedSessionId}`
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path)
      }
    } else {
      const basePath = `/projects/${projectId}/sessions`
      if (window.location.pathname !== basePath) {
        window.history.pushState(null, '', basePath)
      }
    }
  }, [selectedSessionId, projectId])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/projects\/[^/]+\/sessions\/([^/]+)/)
      if (match) {
        setSelectedSessionId(match[1])
      } else {
        setSelectedSessionId(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const paginatedFilters = {
    ...filters,
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
  }

  const { sessions, total, isLoading, error, refresh, createSession, archiveSession, batchArchive, batchSetCustomer } = useSessions({
    filters: paginatedFilters,
  })

  const { companies } = useCompanies({ filters: { projectId: projectId ?? undefined } })
  const { contacts } = useContacts({ filters: { projectId: projectId ?? undefined } })

  const selection = useTableSelection(sessions)
  const batchAsync = useBatchAsync()
  const [showContactPicker, setShowContactPicker] = useState(false)

  const {
    session: selectedSession,
    messages,
    isLoading: isLoadingDetail,
    refresh: refreshSessionDetail,
    updateSession,
  } = useSessionDetail({
    projectId,
    sessionId: selectedSessionId,
  })

  const handleFilterChange = useCallback((newFilters: SessionFilters) => {
    // Keep project filter fixed
    if (projectId) {
      setFilters({ ...newFilters, projectId })
      setCurrentPage(1)
    }
  }, [projectId])

  const handleSessionSelect = useCallback((session: SessionWithProject) => {
    setSelectedSessionId(session.id)
    setExpandMessages(false)
  }, [])

  const handleOpenMessages = useCallback((session: SessionWithProject) => {
    setSelectedSessionId(session.id)
    setExpandMessages(true)
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

  // Batch action handlers
  const handleBatchArchive = useCallback(async () => {
    const ids = [...selection.selectedIds]
    const success = await batchArchive(ids, true)
    if (success) selection.clearSelection()
  }, [selection, batchArchive])

  const handleBatchUnarchive = useCallback(async () => {
    const ids = [...selection.selectedIds]
    const success = await batchArchive(ids, false)
    if (success) selection.clearSelection()
  }, [selection, batchArchive])

  const handleBatchSetCustomer = useCallback(async (contactId: string): Promise<{ success: boolean; error?: string }> => {
    const ids = [...selection.selectedIds]
    const result = await batchSetCustomer(ids, contactId)
    if (result.success) selection.clearSelection()
    return result
  }, [selection, batchSetCustomer])

  const handleBatchAnalyze = useCallback(async () => {
    const items = selection.selectedItems
    await batchAsync.executeBatch(items, async (session, signal) => {
      // Trigger the review
      const res = await fetch(`/api/projects/${projectId}/sessions/${session.id}/review`, {
        method: 'POST',
        signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to trigger review')
      }

      // Connect to SSE stream and wait for completion
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`/api/projects/${projectId}/sessions/${session.id}/review/stream`)

        const cleanup = () => es.close()
        signal.addEventListener('abort', cleanup)

        es.addEventListener('review-complete', () => {
          signal.removeEventListener('abort', cleanup)
          es.close()
          resolve()
        })

        es.addEventListener('review-error', (event) => {
          signal.removeEventListener('abort', cleanup)
          es.close()
          try {
            const data = JSON.parse(event.data)
            reject(new Error(data.error ?? 'Review failed'))
          } catch {
            reject(new Error('Review failed'))
          }
        })

        es.onerror = () => {
          signal.removeEventListener('abort', cleanup)
          es.close()
          reject(new Error('SSE connection error'))
        }
      })
    })
    selection.clearSelection()
    void refresh()
  }, [selection, batchAsync, projectId, refresh])

  const handleExportCSV = useCallback(() => {
    const itemsToExport = selection.selectedCount > 0 ? selection.selectedItems : sessions
    const columns: CSVColumn<SessionWithProject>[] = [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'source', header: 'Source' },
      { key: 'status', header: 'Status' },
      { key: 'message_count', header: 'Messages' },
      { key: 'tags', header: 'Tags', transform: (v) => formatArrayForCSV(v as string[]) },
      { key: 'page_url', header: 'Page URL' },
      { key: 'is_archived', header: 'Archived', transform: (v) => (v ? 'Yes' : 'No') },
      { key: 'created_at', header: 'Created', transform: (v) => formatDateForCSV(v as string) },
      { key: 'last_activity_at', header: 'Last Activity', transform: (v) => formatDateForCSV(v as string) },
    ]
    const csv = generateCSV(itemsToExport, columns)
    downloadAsCSV(csv, generateExportFilename('feedback', project?.name))
  }, [sessions, selection, project])

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
        <PageHeader title="Feedback" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Feedback"
        onRefresh={() => void refresh()}
        actions={
          <>
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

      <FloatingCard floating="gentle" variant="default" className="relative flex flex-col gap-6">
        <SessionsFilters
          projects={[project]} // Single project only
          filters={filters}
          onFilterChange={handleFilterChange}
          hideProjectFilter // Hide project dropdown since it's implicit
          companies={companies.map(c => ({ id: c.id, name: c.name }))}
          contacts={contacts.map(c => ({ id: c.id, name: c.name }))}
        />

        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
            {error}
          </div>
        )}

        <BatchActionBar
          selectedCount={selection.selectedCount}
          totalCount={sessions.length}
          isAllSelected={selection.isAllSelected}
          onSelectAll={selection.selectAll}
          onClearSelection={selection.clearSelection}
          progressSlot={
            batchAsync.isRunning ? (
              <BatchProgressBar
                label="Analyzing"
                currentIndex={batchAsync.currentIndex}
                total={batchAsync.total}
                onCancel={batchAsync.cancel}
              />
            ) : undefined
          }
          actions={[
            {
              label: 'Customer',
              icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
              onClick: () => setShowContactPicker(true),
            },
            {
              label: 'Analyze',
              icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>,
              onClick: () => void handleBatchAnalyze(),
              disabled: batchAsync.isRunning || selection.selectedCount > 20,
            },
            {
              label: 'Export',
              icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
              onClick: handleExportCSV,
            },
            {
              label: 'Archive',
              icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="5" rx="2" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></svg>,
              dropdown: [
                { label: 'Archive', onClick: () => void handleBatchArchive() },
                { label: 'Unarchive', onClick: () => void handleBatchUnarchive() },
              ],
            },
          ]}
        />

        {isLoading && sessions.length === 0 ? (
          <SessionsSkeleton />
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <SessionsTable
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              onSelectSession={handleSessionSelect}
              onOpenMessages={handleOpenMessages}
              onArchive={handleArchiveSession}
              selectedIds={selection.selectedIds}
              onToggleSelect={selection.toggleItem}
              onToggleAll={selection.toggleAll}
              isAllSelected={selection.isAllSelected}
              isIndeterminate={selection.isIndeterminate}
            />
            <Pagination
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </FloatingCard>

      {selectedSessionId && (
        <SessionSidebar
          session={selectedSession}
          messages={messages}
          isLoading={isLoadingDetail}
          expandMessages={expandMessages}
          onClose={handleCloseSidebar}
          onSessionUpdated={handleSessionUpdated}
          onUpdateSession={updateSession}
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

      <ContactPickerDialog
        open={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        projectId={projectId}
        selectedCount={selection.selectedCount}
        onSelect={handleBatchSetCustomer}
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
          No feedback yet
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          Feedback will appear here when users interact with your support widget.
          Make sure you have the widget integrated in your app.
        </p>
      </div>
    </div>
  )
}
