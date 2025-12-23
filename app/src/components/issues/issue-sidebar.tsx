'use client'

import { useState, useCallback } from 'react'
import { Badge, Spinner, Select } from '@/components/ui'
import type { IssueWithSessions, IssueStatus, IssuePriority } from '@/types/issue'
import { useIssueDetail } from '@/hooks/use-issues'
import { ProductSpecView } from './product-spec-view'

interface IssueSidebarProps {
  projectId: string
  issueId: string
  onClose: () => void
  onIssueUpdated?: () => void
}

export function IssueSidebar({
  projectId,
  issueId,
  onClose,
  onIssueUpdated,
}: IssueSidebarProps) {
  const {
    issue,
    isLoading,
    updateIssue,
    generateSpec,
  } = useIssueDetail({ projectId, issueId })

  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false)

  const handleStatusChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as IssueStatus
    await updateIssue({ status: newStatus })
    onIssueUpdated?.()
  }, [updateIssue, onIssueUpdated])

  const handlePriorityChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPriority = e.target.value as IssuePriority
    await updateIssue({ priority: newPriority, priority_manual_override: true })
    onIssueUpdated?.()
  }, [updateIssue, onIssueUpdated])

  const handleGenerateSpec = useCallback(async () => {
    setIsGeneratingSpec(true)
    try {
      await generateSpec()
      onIssueUpdated?.()
    } finally {
      setIsGeneratingSpec(false)
    }
  }, [generateSpec, onIssueUpdated])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] p-4">
          <h2 className="font-mono text-lg font-bold uppercase tracking-tight text-[color:var(--foreground)]">
            Issue Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : issue ? (
          <div className="flex-1 overflow-y-auto">
            {/* Issue Header */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <IssueHeader
                issue={issue}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
              />
            </div>

            {/* Description */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-sm text-[color:var(--foreground)]">
                {issue.description}
              </p>
            </div>

            {/* Linked Sessions */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                Linked Sessions ({issue.sessions?.length || 0})
              </h3>
              {issue.sessions && issue.sessions.length > 0 ? (
                <div className="space-y-2">
                  {issue.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-[color:var(--foreground)]">
                          {session.id.slice(0, 12)}...
                        </span>
                        <span className="text-xs text-[color:var(--text-secondary)]">
                          {session.message_count} messages
                        </span>
                      </div>
                      {session.page_url && (
                        <a
                          href={session.page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block truncate text-xs text-[color:var(--accent-primary)] hover:underline"
                        >
                          {session.page_url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[color:var(--text-secondary)]">
                  No linked sessions
                </p>
              )}
            </div>

            {/* Product Spec */}
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Product Specification
                </h3>
                {!issue.product_spec && (
                  <button
                    type="button"
                    onClick={handleGenerateSpec}
                    disabled={isGeneratingSpec}
                    className="rounded-[4px] border-2 border-[color:var(--accent-primary)] bg-transparent px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--accent-primary)] transition hover:bg-[color:var(--accent-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGeneratingSpec ? 'Generating...' : 'Generate Spec'}
                  </button>
                )}
              </div>

              {issue.product_spec ? (
                <ProductSpecView
                  spec={issue.product_spec}
                  generatedAt={issue.product_spec_generated_at}
                />
              ) : (
                <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-6 text-center">
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    {isGeneratingSpec
                      ? 'Generating product specification...'
                      : 'No product specification yet. Click "Generate Spec" to create one.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[color:var(--text-secondary)]">Issue not found</p>
          </div>
        )}
      </aside>
    </>
  )
}

interface IssueHeaderProps {
  issue: IssueWithSessions
  onStatusChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onPriorityChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

function IssueHeader({ issue, onStatusChange, onPriorityChange }: IssueHeaderProps) {
  const typeLabels = {
    bug: 'Bug',
    feature_request: 'Feature Request',
    change_request: 'Change Request',
  }

  const typeVariants = {
    bug: 'danger' as const,
    feature_request: 'info' as const,
    change_request: 'warning' as const,
  }

  return (
    <div className="space-y-4">
      {/* Title and Type */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={typeVariants[issue.type]}>{typeLabels[issue.type]}</Badge>
          <span className="font-mono text-sm text-[color:var(--text-secondary)]">
            {issue.project?.name || 'Unknown Project'}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
          {issue.title}
        </h3>
      </div>

      {/* Status and Priority Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Status
          </label>
          <Select value={issue.status} onChange={onStatusChange} className="w-full">
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Priority {issue.priority_manual_override && '(Manual)'}
          </label>
          <Select value={issue.priority} onChange={onPriorityChange} className="w-full">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl font-bold text-[color:var(--foreground)]">
            {issue.upvote_count}
          </p>
          <p className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">
            Upvotes
          </p>
        </div>
        <div className="h-8 w-px bg-[color:var(--border-subtle)]" />
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl font-bold text-[color:var(--foreground)]">
            {issue.sessions?.length || 0}
          </p>
          <p className="font-mono text-xs uppercase text-[color:var(--text-secondary)]">
            Sessions
          </p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Created
          </label>
          <p className="text-[color:var(--foreground)]">
            {formatDateTime(issue.created_at)}
          </p>
        </div>
        <div className="space-y-1">
          <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Updated
          </label>
          <p className="text-[color:var(--foreground)]">
            {formatDateTime(issue.updated_at)}
          </p>
        </div>
      </div>
    </div>
  )
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
