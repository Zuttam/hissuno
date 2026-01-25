'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Spinner, Select, MarkdownContent, Badge } from '@/components/ui'
import type { IssueWithSessions, IssueStatus, IssuePriority, IssueType } from '@/types/issue'
import { useIssueDetail } from '@/hooks/use-issues'
import { useSpecGeneration } from '@/hooks/use-spec-generation'
import { ProductSpecView } from './product-spec-view'
import { SpecGenerationProgress } from './spec-generation-progress'

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
    refresh: refreshIssue,
  } = useIssueDetail({ projectId, issueId })
  const [isArchiving, setIsArchiving] = useState(false)

  const handleArchiveToggle = useCallback(async () => {
    if (!issue) return
    setIsArchiving(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issue.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: !issue.is_archived }),
      })
      if (!response.ok) {
        throw new Error('Failed to update archive status')
      }
      onIssueUpdated?.()
    } catch (err) {
      console.error('[issue-sidebar] archive toggle failed:', err)
    } finally {
      setIsArchiving(false)
    }
  }, [projectId, issue, onIssueUpdated])

  const {
    isGenerating: isGeneratingSpec,
    events: specEvents,
    streamedText: specStreamedText,
    activeTools: specActiveTools,
    startGeneration: handleGenerateSpec,
    cancelGeneration: handleCancelSpec,
  } = useSpecGeneration({
    projectId,
    issueId,
    onComplete: () => {
      refreshIssue()
      onIssueUpdated?.()
    },
  })

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

  const handleTypeChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as IssueType
    await updateIssue({ type: newType })
    onIssueUpdated?.()
  }, [updateIssue, onIssueUpdated])

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
          <div className="flex items-center gap-2">
            {issue && (
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={isArchiving}
                className="rounded-[4px] p-1.5 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={issue.is_archived ? 'Unarchive issue' : 'Archive issue'}
                title={issue.is_archived ? 'Unarchive' : 'Archive'}
              >
                {issue.is_archived ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="5" rx="2" />
                    <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                    <path d="M12 13v4" />
                    <path d="m9 16 3 3 3-3" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="5" rx="2" />
                    <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                    <path d="M10 13h4" />
                  </svg>
                )}
              </button>
            )}
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
                onTypeChange={handleTypeChange}
              />
            </div>

            {/* Description */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                Description
              </h3>
              <MarkdownContent
                content={issue.description}
                className="text-sm"
              />
            </div>

            {/* Linked Sessions */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                Linked Sessions ({issue.sessions?.length || 0})
              </h3>
              {issue.sessions && issue.sessions.length > 0 ? (
                <div className="space-y-2">
                  {issue.sessions.map((session) => (
                    <LinkedSessionCard key={session.id} session={session} />
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
                {!isGeneratingSpec && (
                  <button
                    type="button"
                    onClick={handleGenerateSpec}
                    className="rounded-[4px] border-2 border-[color:var(--accent-primary)] bg-transparent px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--accent-primary)] transition hover:bg-[color:var(--accent-primary)] hover:text-white"
                  >
                    {issue.product_spec ? 'Regenerate Spec' : 'Generate Spec'}
                  </button>
                )}
              </div>

              {/* Progress indicator when generating */}
              {isGeneratingSpec && (
                <div className="mb-4">
                  <SpecGenerationProgress
                    events={specEvents}
                    isProcessing={isGeneratingSpec}
                    onCancel={handleCancelSpec}
                    streamedText={specStreamedText}
                    activeTools={specActiveTools}
                  />
                </div>
              )}

              {issue.product_spec ? (
                <ProductSpecView
                  spec={issue.product_spec}
                  generatedAt={issue.product_spec_generated_at}
                  issueTitle={issue.title}
                />
              ) : !isGeneratingSpec ? (
                <div className="rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-6 text-center">
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    No product specification yet. Click "Generate Spec" to create one.
                  </p>
                </div>
              ) : null}
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
  onTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

function IssueHeader({ issue, onStatusChange, onPriorityChange, onTypeChange }: IssueHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title and Project */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-[color:var(--text-secondary)]">
            {issue.project?.name || 'Unknown Project'}
          </span>
          {issue.is_archived && (
            <span className="rounded-full bg-[color:var(--surface)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-secondary)]">
              Archived
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
          {issue.title}
        </h3>
      </div>

      {/* Type, Status, and Priority Controls */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Type
          </label>
          <Select value={issue.type} onChange={onTypeChange} className="w-full">
            <option value="bug">Bug</option>
            <option value="feature_request">Feature Request</option>
            <option value="change_request">Change Request</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Status
          </label>
          <Select value={issue.status} onChange={onStatusChange} className="w-full">
            <option value="open">Open</option>
            <option value="ready">Ready</option>
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

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'just now' : `${diffMinutes}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

const SOURCE_BADGE_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  widget: 'info',
  slack: 'warning',
  intercom: 'success',
  gong: 'default',
  api: 'default',
  manual: 'default',
}

interface LinkedSessionCardProps {
  session: IssueWithSessions['sessions'][number]
}

function LinkedSessionCard({ session }: LinkedSessionCardProps) {
  const sourceVariant = SOURCE_BADGE_VARIANTS[session.source] || 'default'
  const sourceLabel = session.source.charAt(0).toUpperCase() + session.source.slice(1)

  return (
    <Link
      href={`/sessions?session=${session.id}`}
      className="block rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 transition hover:border-[color:var(--accent-primary)] hover:bg-[color:var(--surface-hover)]"
    >
      {/* Session Name */}
      <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
        {session.name || 'Unnamed Session'}
      </p>

      {/* Source badge, User ID, and Date */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
        <Badge variant={sourceVariant}>
          {sourceLabel}
        </Badge>
        {session.user_id && (
          <>
            <span className="truncate font-mono" title={session.user_id}>
              {session.user_id.length > 12 ? `${session.user_id.slice(0, 12)}...` : session.user_id}
            </span>
            <span>|</span>
          </>
        )}
        <span>{formatRelativeDate(session.created_at)}</span>
      </div>
    </Link>
  )
}
