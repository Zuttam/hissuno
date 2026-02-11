'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Spinner, MarkdownContent, Badge, CollapsibleSection } from '@/components/ui'
import type { IssueWithSessions, IssueStatus, IssuePriority, IssueType, IssueCustomerImpact } from '@/types/issue'
import type { JiraIssueSyncStatus } from '@/types/jira'
import { useIssueDetail } from '@/hooks/use-issues'
import { useSpecGeneration } from '@/hooks/use-spec-generation'
import { useJiraSyncStatus } from '@/hooks/use-jira-sync'
import { ProductSpecView } from './product-spec-view'
import { SpecGenerationProgress } from './spec-generation-progress'

// ============================================================================
// Constants
// ============================================================================

type DropdownId = 'type' | 'status' | 'priority'

const TYPE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Feature' },
  { value: 'change_request', label: 'Change' },
]

const TYPE_COLORS: Record<IssueType, string> = {
  bug: 'var(--accent-danger)',
  feature_request: 'var(--accent-info)',
  change_request: 'var(--accent-warning)',
}

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'ready', label: 'Ready' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_COLORS: Record<IssueStatus, string> = {
  open: 'var(--text-tertiary)',
  ready: 'var(--accent-info)',
  in_progress: 'var(--accent-warning)',
  resolved: 'var(--accent-success)',
  closed: 'var(--text-tertiary)',
}

const PRIORITY_OPTIONS: { value: IssuePriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const PRIORITY_COLORS: Record<IssuePriority, string> = {
  low: 'var(--text-tertiary)',
  medium: 'var(--accent-warning)',
  high: 'var(--accent-danger)',
}

const SOURCE_BADGE_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  widget: 'info',
  slack: 'warning',
  intercom: 'success',
  gong: 'default',
  api: 'default',
  manual: 'default',
}

// ============================================================================
// Issue Sidebar
// ============================================================================

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
  const { status: jiraStatus, isRetrying: isJiraRetrying, retrySync: retryJiraSync } = useJiraSyncStatus(projectId, issueId)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<DropdownId | null>(null)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)

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

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!openDropdown) return

    function handlePointerDown(event: PointerEvent) {
      if (!dropdownContainerRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openDropdown])

  const toggleDropdown = useCallback((id: DropdownId) => {
    setOpenDropdown((prev) => (prev === id ? null : id))
  }, [])

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

  const handleTypeSelect = useCallback(async (newType: IssueType) => {
    setIsSaving(true)
    await updateIssue({ type: newType })
    setIsSaving(false)
    onIssueUpdated?.()
    setOpenDropdown(null)
  }, [updateIssue, onIssueUpdated])

  const handleStatusSelect = useCallback(async (newStatus: IssueStatus) => {
    setIsSaving(true)
    await updateIssue({ status: newStatus })
    setIsSaving(false)
    onIssueUpdated?.()
    setOpenDropdown(null)
  }, [updateIssue, onIssueUpdated])

  const handlePrioritySelect = useCallback(async (newPriority: IssuePriority) => {
    setIsSaving(true)
    await updateIssue({ priority: newPriority, priority_manual_override: true })
    setIsSaving(false)
    onIssueUpdated?.()
    setOpenDropdown(null)
  }, [updateIssue, onIssueUpdated])

  const hasSpec = Boolean(issue?.product_spec)

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
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          {/* Row 1: "Issue Details" + close */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              Issue Details
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Row 2: Issue title */}
          {issue && (
            <div className="mt-1">
              <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                {issue.title}
              </h3>
            </div>
          )}

          {/* Row 3: Action buttons */}
          {issue && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" ref={dropdownContainerRef}>
              {/* Type (dropdown) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('type')}
                  className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TYPE_COLORS[issue.type]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <span>{TYPE_OPTIONS.find((o) => o.value === issue.type)?.label ?? issue.type}</span>
                </button>
                {openDropdown === 'type' && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 shadow-lg">
                    <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                      Type
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => void handleTypeSelect(option.value)}
                          disabled={isSaving}
                          className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: TYPE_COLORS[option.value] }}
                          />
                          <span className={issue.type === option.value ? 'font-medium text-[color:var(--foreground)]' : 'text-[color:var(--text-secondary)]'}>
                            {option.label}
                          </span>
                          {issue.type === option.value && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-[color:var(--accent-primary)]">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status (dropdown) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('status')}
                  className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STATUS_COLORS[issue.status]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" fill={STATUS_COLORS[issue.status]} fillOpacity="0.2" />
                    <circle cx="12" cy="12" r="4" fill={STATUS_COLORS[issue.status]} />
                  </svg>
                  <span>{STATUS_OPTIONS.find((o) => o.value === issue.status)?.label ?? issue.status}</span>
                </button>
                {openDropdown === 'status' && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 shadow-lg">
                    <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                      Status
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => void handleStatusSelect(option.value)}
                          disabled={isSaving}
                          className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[option.value] }}
                          />
                          <span className={issue.status === option.value ? 'font-medium text-[color:var(--foreground)]' : 'text-[color:var(--text-secondary)]'}>
                            {option.label}
                          </span>
                          {issue.status === option.value && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-[color:var(--accent-primary)]">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Priority (dropdown) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('priority')}
                  className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PRIORITY_COLORS[issue.priority]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                  <span>
                    {PRIORITY_OPTIONS.find((o) => o.value === issue.priority)?.label ?? issue.priority}
                    {issue.priority_manual_override && ' (Manual)'}
                  </span>
                </button>
                {openDropdown === 'priority' && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 shadow-lg">
                    <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                      Priority
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {PRIORITY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => void handlePrioritySelect(option.value)}
                          disabled={isSaving}
                          className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: PRIORITY_COLORS[option.value] }}
                          />
                          <span className={issue.priority === option.value ? 'font-medium text-[color:var(--foreground)]' : 'text-[color:var(--text-secondary)]'}>
                            {option.label}
                          </span>
                          {issue.priority === option.value && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-[color:var(--accent-primary)]">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Archive (direct action) */}
              <button
                type="button"
                onClick={() => void handleArchiveToggle()}
                disabled={isArchiving}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  issue.is_archived
                    ? 'text-[color:var(--accent-primary)]'
                    : 'text-[color:var(--text-secondary)]'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="5" rx="2" />
                  <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                  <path d="M10 13h4" />
                </svg>
                <span>{isArchiving ? 'Updating...' : issue.is_archived ? 'Unarchive' : 'Archive'}</span>
              </button>

              {/* Analyze / Generate Spec (direct action) */}
              <button
                type="button"
                onClick={handleGenerateSpec}
                disabled={isGeneratingSpec}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  hasSpec
                    ? 'text-[color:var(--accent-success)]'
                    : 'text-[color:var(--text-secondary)]'
                }`}
              >
                {hasSpec ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  </svg>
                )}
                <span>{isGeneratingSpec ? 'Generating...' : hasSpec ? 'Regenerate' : 'Generate Spec'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : issue ? (
          <div className="flex-1 overflow-y-auto">
            {/* Analysis (expanded by default) */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection title="Analysis" variant="flat" defaultExpanded>
                <div className="flex flex-col gap-4">
                  {/* Linked Sessions (lean list) */}
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                      Linked Sessions ({issue.sessions?.length || 0})
                    </span>
                    {issue.sessions && issue.sessions.length > 0 ? (
                      <div className="flex flex-col gap-1 mt-1">
                        {issue.sessions.map((session) => {
                          const sourceVariant = SOURCE_BADGE_VARIANTS[session.source] || 'default'
                          const sourceLabel = session.source.charAt(0).toUpperCase() + session.source.slice(1)
                          return (
                            <Link
                              key={session.id}
                              href={`/projects/${projectId}/sessions?session=${session.id}`}
                              className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm transition hover:bg-[color:var(--surface-hover)]"
                            >
                              <Badge variant={sourceVariant}>
                                {sourceLabel}
                              </Badge>
                              <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)] hover:underline">
                                {session.name || 'Unnamed Feedback'}
                              </span>
                              <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">
                                {formatRelativeDate(session.created_at)}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                        No linked sessions
                      </p>
                    )}
                  </div>

                  {/* Product Spec */}
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                      Product Specification
                    </span>

                    {/* Progress indicator when generating */}
                    {isGeneratingSpec && (
                      <SpecGenerationProgress
                        events={specEvents}
                        isProcessing={isGeneratingSpec}
                        onCancel={handleCancelSpec}
                        streamedText={specStreamedText}
                        activeTools={specActiveTools}
                      />
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
                          No product specification yet. Click &ldquo;Generate Spec&rdquo; above to create one.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            {/* Customer Impact */}
            <CustomerImpactSection sessions={issue.sessions} projectId={projectId} />

            {/* Metadata (collapsed by default) */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection title="Metadata" variant="flat" defaultExpanded={false}>
                <div className="flex flex-col gap-4">
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
                    <div className="flex flex-col gap-1">
                      <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
                        Created
                      </label>
                      <p className="text-[color:var(--foreground)]">
                        {formatDateTime(issue.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
                        Updated
                      </label>
                      <p className="text-[color:var(--foreground)]">
                        {formatDateTime(issue.updated_at)}
                      </p>
                    </div>
                  </div>

                  {/* Jira Sync Status */}
                  {jiraStatus.synced && (
                    <JiraSyncBadge
                      status={jiraStatus}
                      isRetrying={isJiraRetrying}
                      onRetry={retryJiraSync}
                    />
                  )}
                </div>
              </CollapsibleSection>
            </div>

            {/* Description (collapsed by default) */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection
                title="Description"
                variant="flat"
                defaultExpanded={false}
                collapsedSummary={issue.description ? truncateText(issue.description, 60) : undefined}
              >
                <MarkdownContent
                  content={issue.description}
                  className="text-sm"
                />
              </CollapsibleSection>
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

// ============================================================================
// Helpers
// ============================================================================

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

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

// ============================================================================
// Customer Impact Section
// ============================================================================

const STAGE_COLORS: Record<string, string> = {
  prospect: 'var(--text-tertiary)',
  onboarding: 'var(--accent-info)',
  active: 'var(--accent-success)',
  expansion: 'var(--accent-warning)',
  churned: 'var(--accent-danger)',
}

function computeCustomerImpact(sessions: IssueWithSessions['sessions']): IssueCustomerImpact {
  const contactMap = new Map<string, { companyId?: string }>()
  const companyMap = new Map<string, { id: string; name: string; arr: number | null; stage: string; contacts: Set<string> }>()

  for (const session of sessions) {
    if (!session.contact) continue
    contactMap.set(session.contact.id, { companyId: session.contact.company?.id })
    if (session.contact.company) {
      const existing = companyMap.get(session.contact.company.id)
      if (existing) {
        existing.contacts.add(session.contact.id)
      } else {
        companyMap.set(session.contact.company.id, {
          id: session.contact.company.id,
          name: session.contact.company.name,
          arr: session.contact.company.arr,
          stage: session.contact.company.stage,
          contacts: new Set([session.contact.id]),
        })
      }
    }
  }

  const companies = Array.from(companyMap.values()).map((c) => ({
    id: c.id,
    name: c.name,
    arr: c.arr,
    stage: c.stage,
    contactCount: c.contacts.size,
  }))

  const totalARR = companies.reduce((sum, c) => sum + (c.arr ?? 0), 0)

  return {
    contactCount: contactMap.size,
    companyCount: companyMap.size,
    totalARR,
    companies,
  }
}

function formatARR(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

function CustomerImpactSection({ sessions, projectId }: { sessions: IssueWithSessions['sessions']; projectId: string }) {
  const impact = computeCustomerImpact(sessions ?? [])

  if (impact.contactCount === 0) {
    return (
      <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
        <CollapsibleSection title="Customer Impact" variant="flat" defaultExpanded={false}>
          <p className="text-sm text-[color:var(--text-secondary)]">
            No identified customers
          </p>
        </CollapsibleSection>
      </div>
    )
  }

  const summaryParts: string[] = []
  summaryParts.push(`${impact.contactCount} contact${impact.contactCount !== 1 ? 's' : ''}`)
  if (impact.companyCount > 0) {
    summaryParts.push(`${impact.companyCount} compan${impact.companyCount !== 1 ? 'ies' : 'y'}`)
  }
  if (impact.totalARR > 0) {
    summaryParts.push(`${formatARR(impact.totalARR)} ARR at risk`)
  }

  return (
    <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
      <CollapsibleSection
        title="Customer Impact"
        variant="flat"
        defaultExpanded
        collapsedSummary={summaryParts.join(' / ')}
      >
        <div className="flex flex-col gap-3">
          {/* Summary */}
          <p className="text-sm text-[color:var(--text-secondary)]">
            {summaryParts.join(' / ')}
          </p>

          {/* Company rows */}
          {impact.companies.length > 0 && (
            <div className="flex flex-col gap-1">
              {impact.companies.map((company) => (
                <Link
                  key={company.id}
                  href={`/projects/${projectId}/customers/companies/${company.id}`}
                  className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm transition hover:bg-[color:var(--surface-hover)]"
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[company.stage] ?? 'var(--text-tertiary)' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[color:var(--foreground)]">
                    {company.name}
                  </span>
                  {company.arr != null && company.arr > 0 && (
                    <span className="shrink-0 text-xs font-medium text-[color:var(--text-secondary)]">
                      {formatARR(company.arr)}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">
                    {company.contactCount} contact{company.contactCount !== 1 ? 's' : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}

// ============================================================================
// Jira Sync Badge
// ============================================================================

interface JiraSyncBadgeProps {
  status: JiraIssueSyncStatus
  isRetrying: boolean
  onRetry: () => void
}

function JiraSyncBadge({ status, isRetrying, onRetry }: JiraSyncBadgeProps) {
  const syncStatusLabel =
    status.lastSyncStatus === 'success'
      ? 'Synced'
      : status.lastSyncStatus === 'failed'
        ? 'Sync Failed'
        : 'Pending'

  const syncStatusVariant: 'success' | 'danger' | 'warning' =
    status.lastSyncStatus === 'success'
      ? 'success'
      : status.lastSyncStatus === 'failed'
        ? 'danger'
        : 'warning'

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* Jira icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M11.53 2c0 4.97 3.86 9 8.47 9H22v1.67C22 17.73 17.73 22 12.67 22H12c-5.52 0-10-4.48-10-10v-.67C2 6.27 6.27 2 11.33 2h.2z"
            fill="currentColor"
            className="text-[color:var(--text-secondary)]"
          />
        </svg>

        {status.jiraIssueUrl ? (
          <a
            href={status.jiraIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm font-medium text-[color:var(--accent-selected)] hover:underline"
          >
            {status.jiraIssueKey}
          </a>
        ) : (
          <span className="font-mono text-sm text-[color:var(--text-secondary)]">
            {status.jiraIssueKey || 'Jira'}
          </span>
        )}

        <Badge variant={syncStatusVariant}>
          {syncStatusLabel}
        </Badge>
      </div>

      {status.lastSyncStatus === 'failed' && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="rounded-[4px] border border-[color:var(--border)] px-2 py-1 font-mono text-xs text-[color:var(--text-secondary)] transition hover:border-[color:var(--accent-primary)] hover:text-[color:var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRetrying ? 'Retrying...' : 'Retry Sync'}
        </button>
      )}
    </div>
  )
}
