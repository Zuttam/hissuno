'use client'

import { useState, useCallback, useEffect } from 'react'
import type { IssueWithProject, IssueFilters } from '@/types/issue'
import type { ProjectWithCodebase } from '@/lib/projects/queries'
import { useIssues } from '@/hooks/use-issues'
import { IssuesFilters } from './issues-filters'
import { IssuesTable } from './issues-table'
import { IssueSidebar } from './issue-sidebar'

interface IssuesPageContentProps {
  initialIssues: IssueWithProject[]
  projects: ProjectWithCodebase[]
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

  // Find initial issue from list to get projectId
  const initialSelectedIssue = initialIssueId
    ? (() => {
        const issue = initialIssues.find(i => i.id === initialIssueId)
        return issue ? { id: issue.id, projectId: issue.project_id } : null
      })()
    : null

  const [selectedIssue, setSelectedIssue] = useState<{ id: string; projectId: string } | null>(initialSelectedIssue)

  const { issues, isLoading, error, refresh } = useIssues({
    initialIssues,
    filters,
  })

  // Update URL when selectedIssue changes
  useEffect(() => {
    if (selectedIssue) {
      window.history.pushState(null, '', `/issues/${selectedIssue.id}`)
    } else {
      // Only push if we're not already on /issues
      if (window.location.pathname !== '/issues') {
        window.history.pushState(null, '', '/issues')
      }
    }
  }, [selectedIssue])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/^\/issues\/([^/]+)$/)
      if (match) {
        const issueId = match[1]
        const issue = issues.find(i => i.id === issueId)
        if (issue) {
          setSelectedIssue({ id: issue.id, projectId: issue.project_id })
        } else {
          setSelectedIssue(null)
        }
      } else {
        setSelectedIssue(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [issues])

  const handleFilterChange = useCallback((newFilters: IssueFilters) => {
    setFilters(newFilters)
  }, [])

  const handleIssueSelect = useCallback((issue: IssueWithProject) => {
    setSelectedIssue({
      id: issue.id,
      projectId: issue.project_id,
    })
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSelectedIssue(null)
  }, [])

  const handleIssueUpdated = useCallback(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[color:var(--background)] px-8 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col justify-between gap-6 rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-8 md:flex-row md:items-center">
          <div className="space-y-2">
            <h1 className="font-mono text-3xl font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              Issues
            </h1>
            <p className="max-w-2xl text-sm text-[color:var(--text-secondary)]">
              View and manage issues, feature requests, and bugs identified from user sessions. 
              Issues are automatically created when the PM Agent detects actionable feedback.
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
            selectedIssueId={selectedIssue?.id ?? null}
            onSelectIssue={handleIssueSelect}
          />
        )}
      </div>

      {selectedIssue && (
        <IssueSidebar
          projectId={selectedIssue.projectId}
          issueId={selectedIssue.id}
          onClose={handleCloseSidebar}
          onIssueUpdated={handleIssueUpdated}
        />
      )}
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
