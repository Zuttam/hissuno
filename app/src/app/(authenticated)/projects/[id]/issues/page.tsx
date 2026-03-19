'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { IssueWithProject, IssueFilters } from '@/types/issue'
import { useProject } from '@/components/providers/project-provider'
import { useIssues } from '@/hooks/use-issues'
import { useProductScopes } from '@/hooks/use-product-scopes'
import { useTableSelection } from '@/hooks/use-table-selection'
import { useBatchAsync } from '@/hooks/use-batch-async'
import { IssuesFilters } from '@/components/issues/issues-filters'
import { IssuesTable } from '@/components/issues/issues-table'
import { IssueSidebar } from '@/components/issues/issue-sidebar'
import { CreateIssueDialog } from '@/components/issues/create-issue-dialog'
import { Button, PageHeader, Pagination, Spinner } from '@/components/ui'
import { Card } from '@/components/ui/card'
import { BatchActionBar } from '@/components/ui/batch-action-bar'
import { BatchProgressBar } from '@/components/ui/batch-progress-bar'
import { AnalyticsStrip } from '@/components/analytics'
import { generateCSV, formatDateForCSV, type CSVColumn } from '@/lib/utils/csv'
import { downloadAsCSV, generateExportFilename } from '@/lib/utils/download'
import { calculateRICEScore } from '@/lib/issues/rice'
import { startAnalysis, issueAnalyzeStreamUrl, generateBrief, generateBriefStreamUrl } from '@/lib/api/issues'
const PAGE_SIZE = 25

export default function ProjectIssuesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [filters, setFilters] = useState<IssueFilters>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  // Auto-open dialog or sidebar based on URL params
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog === 'create') {
      setShowCreateDialog(true)
    }
    const issueParam = searchParams.get('issue')
    if (issueParam) {
      setSelectedIssueId(issueParam)
    }
  }, [searchParams])

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/issues`)
    }
  }

  // Set project filter when projectId becomes available
  useEffect(() => {
    if (projectId) {
      setFilters(prev => ({ ...prev, projectId }))
    }
  }, [projectId])

  const paginatedFilters = {
    ...filters,
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
  }

  const { scopes: productScopes } = useProductScopes({ projectId: projectId ?? undefined })
  const { issues, total, isLoading, error, refresh, createIssue, archiveIssue, batchArchive } = useIssues({
    filters: paginatedFilters,
  })

  const selection = useTableSelection(issues)
  const batchAsync = useBatchAsync()

  // Update URL when selectedIssueId changes
  useEffect(() => {
    if (!projectId) return
    if (selectedIssueId) {
      window.history.pushState(null, '', `/projects/${projectId}/issues/${selectedIssueId}`)
    } else {
      const basePath = `/projects/${projectId}/issues`
      if (window.location.pathname !== basePath) {
        window.history.pushState(null, '', basePath)
      }
    }
  }, [selectedIssueId, projectId])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/projects\/[^/]+\/issues\/([^/]+)$/)
      if (match) {
        const issueId = match[1]
        const issue = issues.find(i => i.id === issueId)
        if (issue) {
          setSelectedIssueId(issue.id)
        } else {
          setSelectedIssueId(null)
        }
      } else {
        setSelectedIssueId(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [issues])

  const handleFilterChange = useCallback((newFilters: IssueFilters) => {
    // Keep project filter fixed
    if (projectId) {
      setFilters({ ...newFilters, projectId })
      setCurrentPage(1)
    }
  }, [projectId])

  const handleIssueSelect = useCallback((issue: IssueWithProject) => {
    setSelectedIssueId(issue.id)
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSelectedIssueId(null)
  }, [])

  const handleIssueUpdated = useCallback(() => {
    void refresh()
  }, [refresh])

  const handleArchiveIssue = useCallback(async (issue: IssueWithProject) => {
    await archiveIssue(issue.id, !issue.is_archived)
  }, [archiveIssue])

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

  const handleBatchAnalyze = useCallback(async () => {
    const items = selection.selectedItems
    if (!projectId) return

    await batchAsync.executeBatch(items, async (issue, signal) => {
      const { runId } = await startAnalysis(projectId, issue.id, { signal })

      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(issueAnalyzeStreamUrl(projectId, issue.id, runId))

        const cleanup = () => es.close()
        signal.addEventListener('abort', cleanup)

        es.addEventListener('workflow-finish', () => {
          signal.removeEventListener('abort', cleanup)
          es.close()
          resolve()
        })

        es.addEventListener('error', (event) => {
          signal.removeEventListener('abort', cleanup)
          es.close()
          try {
            const data = JSON.parse((event as MessageEvent).data)
            reject(new Error(data.error ?? 'Analysis failed'))
          } catch {
            reject(new Error('Analysis failed'))
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

  const handleBatchGenerateBrief = useCallback(async () => {
    const items = selection.selectedItems
    if (!projectId) return

    await batchAsync.executeBatch(items, async (issue, signal) => {
      const { runId } = await generateBrief(projectId, issue.id, { signal })

      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(generateBriefStreamUrl(projectId, issue.id, runId))

        const cleanup = () => es.close()
        signal.addEventListener('abort', cleanup)

        es.addEventListener('workflow-finish', () => {
          signal.removeEventListener('abort', cleanup)
          es.close()
          resolve()
        })

        es.addEventListener('error', (event) => {
          signal.removeEventListener('abort', cleanup)
          es.close()
          try {
            const data = JSON.parse((event as MessageEvent).data)
            reject(new Error(data.error ?? 'Brief generation failed'))
          } catch {
            reject(new Error('Brief generation failed'))
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
    const itemsToExport = selection.selectedCount > 0 ? selection.selectedItems : issues
    const columns: CSVColumn<IssueWithProject>[] = [
      { key: 'id', header: 'ID' },
      { key: 'title', header: 'Title' },
      { key: 'type', header: 'Type' },
      { key: 'priority', header: 'Priority' },
      { key: 'status', header: 'Status' },
      { key: 'upvote_count', header: 'Upvotes' },
      { key: 'reach_score', header: 'Reach' },
      { key: 'impact_score', header: 'Impact' },
      { key: 'confidence_score', header: 'Confidence' },
      { key: 'effort_score', header: 'Effort' },
      { key: 'reach_score', header: 'RICE', transform: (_v, row) => {
        const score = calculateRICEScore(row.reach_score, row.impact_score, row.confidence_score, row.effort_score)
        return score != null ? score.toFixed(1) : ''
      } },
      { key: 'is_archived', header: 'Archived', transform: (v) => (v ? 'Yes' : 'No') },
      { key: 'brief', header: 'Has Brief', transform: (v) => (v ? 'Yes' : 'No') },
      { key: 'created_at', header: 'Created', transform: (v) => formatDateForCSV(v as string) },
      { key: 'updated_at', header: 'Updated', transform: (v) => formatDateForCSV(v as string) },
    ]
    const csv = generateCSV(itemsToExport, columns)
    downloadAsCSV(csv, generateExportFilename('issues', project?.name))
  }, [issues, selection, project])

  const handleOpenCreateDialog = () => {
    router.push(`/projects/${projectId}/issues?dialog=create`)
  }

  // Show loading state
  if (isLoadingProject || !project || !projectId) {
    return (
      <>
        <PageHeader title="Issues" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Issues"
        onRefresh={() => void refresh()}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreateDialog}
          >
            Create
          </Button>
        }
      />

      <AnalyticsStrip type="issues" projectId={projectId} />

      <Card className="relative flex flex-col gap-6">
        <IssuesFilters
          projects={[project]} // Single project only
          filters={filters}
          onFilterChange={handleFilterChange}
          hideProjectFilter // Hide project dropdown since it's implicit
          projectId={projectId}
        />

        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-4 font-mono text-sm text-[color:var(--foreground)]">
            {error}
          </div>
        )}

        <BatchActionBar
          selectedCount={selection.selectedCount}
          totalCount={issues.length}
          isAllSelected={selection.isAllSelected}
          onSelectAll={selection.selectAll}
          onClearSelection={selection.clearSelection}
          progressSlot={
            batchAsync.isRunning ? (
              <BatchProgressBar
                label="Processing"
                currentIndex={batchAsync.currentIndex}
                total={batchAsync.total}
                onCancel={batchAsync.cancel}
              />
            ) : undefined
          }
          actions={[
            {
              label: 'Analyze',
              icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
              onClick: () => void handleBatchAnalyze(),
              disabled: batchAsync.isRunning || selection.selectedCount > 20,
            },
            {
              label: 'Gen Brief',
              icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>,
              onClick: () => void handleBatchGenerateBrief(),
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

        {isLoading && issues.length === 0 ? (
          <IssuesSkeleton />
        ) : issues.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <IssuesTable
              issues={issues}
              selectedIssueId={selectedIssueId}
              onSelectIssue={handleIssueSelect}
              onArchive={handleArchiveIssue}
              selectedIds={selection.selectedIds}
              onToggleSelect={selection.toggleItem}
              onToggleAll={selection.toggleAll}
              isAllSelected={selection.isAllSelected}
              isIndeterminate={selection.isIndeterminate}
              productScopes={productScopes}
            />
            <Pagination
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {selectedIssueId && projectId && (
        <IssueSidebar
          projectId={projectId}
          issueId={selectedIssueId}
          onClose={handleCloseSidebar}
          onIssueUpdated={handleIssueUpdated}
        />
      )}

      <CreateIssueDialog
        open={showCreateDialog}
        onClose={handleCloseCreateDialog}
        projectId={projectId}
        projectName={project.name}
        onCreateIssue={createIssue}
      />

    </>
  )
}

function IssuesSkeleton() {
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
          No issues yet
        </h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          Issues will appear here when the PM Agent identifies actionable feedback
          from user sessions. You can also trigger a PM Review manually on any session.
        </p>
      </div>
    </div>
  )
}
