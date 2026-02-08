'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { IssueWithProject, IssueFilters } from '@/types/issue'
import { useProject } from '@/components/providers/project-provider'
import { useIssues } from '@/hooks/use-issues'
import { IssuesFilters } from '@/components/issues/issues-filters'
import { IssuesTable } from '@/components/issues/issues-table'
import { IssueSidebar } from '@/components/issues/issue-sidebar'
import { CreateIssueDialog } from '@/components/issues/create-issue-dialog'
import { IssuesSettingsDialog } from '@/components/projects/edit-dialogs/issues-settings-dialog'
import { Button, PageHeader, Pagination, Spinner } from '@/components/ui'
import { FloatingCard } from '@/components/ui/floating-card'
import { AnalyticsStrip } from '@/components/analytics'

const PAGE_SIZE = 25

export default function ProjectIssuesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [filters, setFilters] = useState<IssueFilters>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
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
    const issueParam = searchParams.get('issue')
    if (issueParam) {
      setSelectedIssueId(issueParam)
    }
  }, [searchParams])

  // Clear URL param when dialog closes
  const handleCloseSettingsDialog = () => {
    setShowSettingsDialog(false)
    if (searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/issues`)
    }
  }

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

  const { issues, total, isLoading, error, refresh, createIssue, archiveIssue } = useIssues({
    filters: paginatedFilters,
  })

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

  // Handlers for opening dialogs - updates URL for consistent tracking
  const handleOpenSettingsDialog = () => {
    router.push(`/projects/${projectId}/issues?dialog=settings`)
  }

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

      <AnalyticsStrip type="issues" projectId={projectId} />

      <FloatingCard floating="gentle" variant="default" className="flex flex-col gap-6">
        <IssuesFilters
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
        projects={[project]}
        onCreateIssue={createIssue}
      />

      <IssuesSettingsDialog
        open={showSettingsDialog}
        onClose={handleCloseSettingsDialog}
        projectId={projectId}
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
