'use client'

import { useState, useCallback, useEffect } from 'react'
import type { IssueWithProject, IssueFilters } from '@/types/issue'
import type { ProjectRecord } from '@/lib/supabase/projects'
import { useIssues } from '@/hooks/use-issues'
import { IssuesFilters } from './issues-filters'
import { IssuesTable } from './issues-table'
import { IssueSidebar } from './issue-sidebar'
import { CreateIssueDialog } from './create-issue-dialog'
import { Button, PageHeader } from '@/components/ui'
import { FloatingCard } from '@/components/ui/floating-card'
import { AnalyticsStrip } from '@/components/analytics'
import { generateCSV, formatDateForCSV, formatArrayForCSV, type CSVColumn } from '@/lib/utils/csv'
import { downloadAsCSV, generateExportFilename } from '@/lib/utils/download'

interface IssuesPageContentProps {
  initialIssues: IssueWithProject[]
  projects: ProjectRecord[]
  initialProjectFilter?: string
  initialIssueId?: string
}

export function IssuesPageContent({
  initialIssues,
  projects,
  initialProjectFilter,
  initialIssueId,
}: IssuesPageContentProps) {
  const [filters, setFilters] = useState<IssueFilters>({
    projectId: initialProjectFilter,
  })

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(initialIssueId ?? null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const { issues, isLoading, error, refresh, createIssue, archiveIssue } = useIssues({
    initialIssues,
    filters,
  })

  // Update URL when selectedIssueId changes
  useEffect(() => {
    if (selectedIssueId) {
      window.history.pushState(null, '', `/issues/${selectedIssueId}`)
    } else {
      // Only push if we're not already on /issues
      if (window.location.pathname !== '/issues') {
        window.history.pushState(null, '', '/issues')
      }
    }
  }, [selectedIssueId])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/^\/issues\/([^/]+)$/)
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
    setFilters(newFilters)
  }, [])

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

  const handleExportCSV = useCallback(() => {
    if (issues.length === 0) return

    const columns: CSVColumn<IssueWithProject>[] = [
      { key: 'title', header: 'Title' },
      { key: 'type', header: 'Type' },
      { key: 'project.name', header: 'Project', transform: (v) => (v as string) || '' },
      { key: 'priority', header: 'Priority' },
      { key: 'status', header: 'Status' },
      { key: 'upvote_count', header: 'Upvotes', transform: (v) => String(v ?? 0) },
      { key: 'description', header: 'Description' },
      { key: 'affected_areas', header: 'Affected Areas', transform: (v) => formatArrayForCSV(v as string[]) },
      { key: 'impact_score', header: 'Impact Score', transform: (v) => v != null ? String(v) : '' },
      { key: 'effort_estimate', header: 'Effort Estimate', transform: (v) => (v as string) || '' },
      { key: 'is_archived', header: 'Archived', transform: (v) => v ? 'Yes' : 'No' },
      { key: 'created_at', header: 'Created', transform: (v) => formatDateForCSV(v as string) },
      { key: 'updated_at', header: 'Updated', transform: (v) => formatDateForCSV(v as string) },
    ]

    const csv = generateCSV(issues, columns)
    const selectedProject = projects.find((p) => p.id === filters.projectId)
    const filename = generateExportFilename('issues', selectedProject?.name || 'all')
    downloadAsCSV(csv, filename)
  }, [issues, filters.projectId, projects])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <PageHeader
        title="Issues"
        onRefresh={() => void refresh()}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={handleExportCSV}
              disabled={issues.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowCreateDialog(true)}
            >
              Create
            </Button>
          </div>
        }
      />

      <AnalyticsStrip type="issues" projectId={filters.projectId} />
      <FloatingCard floating="gentle" variant="default" className="flex flex-col gap-6">
        <IssuesFilters
          projects={projects}
          filters={filters}
          onFilterChange={handleFilterChange}
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
          <IssuesTable
            issues={issues}
            selectedIssueId={selectedIssueId}
            onSelectIssue={handleIssueSelect}
            onArchive={handleArchiveIssue}
          />
        )}
      </FloatingCard>

      {selectedIssueId && (
        <IssueSidebar
          issueId={selectedIssueId}
          onClose={handleCloseSidebar}
          onIssueUpdated={handleIssueUpdated}
        />
      )}

      <CreateIssueDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        projects={projects}
        onCreateIssue={createIssue}
      />
    </div>
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
