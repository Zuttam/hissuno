'use client'

import { useState, useCallback, useEffect, useRef, type JSX } from 'react'
import { Spinner, MarkdownContent, CollapsibleSection } from '@/components/ui'
import type { IssueStatus, IssuePriority, IssueType } from '@/types/issue'
import { useIssueDetail } from '@/hooks/use-issues'
import { useSpecGeneration, type SpecGenerationEvent } from '@/hooks/use-spec-generation'
import { useIssueAnalysis } from '@/hooks/use-issue-analysis'
import { useTrackerSyncStatuses } from '@/hooks/use-tracker-sync'
import { TrackerSyncBadgeInline } from './tracker-sync-badge'
import { ProductSpecView } from './product-spec-view'
import { SpecGenerationProgress } from './spec-generation-progress'
import { LinkedFeedbackTree } from './linked-feedback-tree'

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
    linkSession,
    unlinkSession,
  } = useIssueDetail({ projectId, issueId })
  const { statuses: trackerStatuses, isRetrying: isTrackerRetrying, retrySync: retryTrackerSync } = useTrackerSyncStatuses(projectId, issueId)
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

  const {
    isAnalyzing,
    events: analysisEvents,
    startAnalysis: handleRunAnalysis,
    cancelAnalysis: handleCancelAnalysis,
  } = useIssueAnalysis({
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
  const hasAnalysis = Boolean(issue?.analysis_computed_at)

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

          {/* Row 2.5: Inline metadata */}
          {issue && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-[color:var(--text-tertiary)]">
              <span>{issue.upvote_count} upvote{issue.upvote_count !== 1 ? 's' : ''}</span>
              <span>&middot;</span>
              <span>{issue.sessions?.length || 0} session{(issue.sessions?.length || 0) !== 1 ? 's' : ''}</span>
              <span>&middot;</span>
              <span>Created {formatRelativeDate(issue.created_at)}</span>
              <span>&middot;</span>
              <span>Updated {formatRelativeDate(issue.updated_at)}</span>
              {trackerStatuses.filter(s => s.synced).map((s) => (
                <span key={s.provider} className="inline-flex items-center gap-1">
                  <span>&middot;</span>
                  <TrackerSyncBadgeInline
                    status={s}
                    isRetrying={isTrackerRetrying}
                    onRetry={() => retryTrackerSync(s.provider)}
                  />
                </span>
              ))}
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

              {/* Analyze (direct action) */}
              <button
                type="button"
                onClick={() => void handleRunAnalysis()}
                disabled={isAnalyzing}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  hasAnalysis
                    ? 'text-[color:var(--accent-success)]'
                    : 'text-[color:var(--text-secondary)]'
                }`}
              >
                {hasAnalysis ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                )}
                <span>{isAnalyzing ? 'Analyzing...' : hasAnalysis ? 'Re-analyze' : 'Analyze'}</span>
              </button>

              {/* Generate Spec (direct action) */}
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
              <CollapsibleSection
                title={<>Analysis{issue.analysis_computed_at && <span className="ml-1 text-[10px] normal-case tracking-normal text-[color:var(--text-tertiary)]"> {formatRelativeDate(issue.analysis_computed_at)}</span>}</>}
                variant="flat"
                defaultExpanded
              >
                <div className="flex flex-col gap-4">
                  {/* Analysis Scores (RICE) */}
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                      RICE Scores
                    </span>
                    {issue.reach_score != null || issue.impact_score != null || issue.effort_score != null ? (
                      <div className="flex flex-col gap-0.5 mt-1">
                        <EditableScoreRow icon="reach" label="Reach" score={issue.reach_score} reasoning={issue.reach_reasoning} fieldKey="reach_score" onSave={updateIssue} onIssueUpdated={onIssueUpdated} />
                        <EditableScoreRow icon="impact" label="Impact" score={issue.impact_score} reasoning={issue.impact_analysis?.reasoning} fieldKey="impact_score" onSave={updateIssue} onIssueUpdated={onIssueUpdated} />
                        <EditableScoreRow icon="confidence" label="Confidence" score={issue.confidence_score} reasoning={issue.confidence_reasoning} fieldKey="confidence_score" onSave={updateIssue} onIssueUpdated={onIssueUpdated} />
                        <EditableScoreRow icon="effort" label="Effort" score={issue.effort_score} reasoning={issue.effort_reasoning} fieldKey="effort_score" onSave={updateIssue} onIssueUpdated={onIssueUpdated} />
                        {issue.rice_score != null && (
                          <div className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm">
                            <span className="text-[color:var(--text-secondary)]">{SCORE_ICONS.rice}</span>
                            <span className="w-16 text-[color:var(--text-secondary)]">RICE</span>
                            <span className="font-mono font-bold text-[color:var(--accent-primary)]">
                              {Number(issue.rice_score).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                        Not yet analyzed. Click &ldquo;Analyze&rdquo; above to calculate scores.
                      </p>
                    )}
                  </div>

                  {/* Analysis Progress */}
                  {isAnalyzing && (
                    <SpecGenerationProgress
                      events={analysisEvents as unknown as SpecGenerationEvent[]}
                      isProcessing={isAnalyzing}
                      onCancel={handleCancelAnalysis}
                    />
                  )}

                  {/* Linked Feedback (grouped by customer) */}
                  <LinkedFeedbackTree
                    sessions={issue.sessions ?? []}
                    projectId={projectId}
                    onLinkSession={linkSession}
                    onUnlinkSession={unlinkSession}
                  />

                  {/* Product Spec */}
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                      Product Specification
                      {issue.product_spec_generated_at && (
                        <span className="ml-2 text-[10px] normal-case tracking-normal text-[color:var(--text-tertiary)]">
                            {formatRelativeDate(issue.product_spec_generated_at)}
                        </span>
                      )}
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
                        issueTitle={issue.title}
                      />
                    ) : !isGeneratingSpec ? (
                      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                        No specification yet. Click &ldquo;Generate Spec&rdquo; above to generate one.
                      </p>
                    ) : null}
                  </div>
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
// Score Row
// ============================================================================

const SCORE_ICONS: Record<string, JSX.Element> = {
  reach: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  impact: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  confidence: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  effort: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" /><path d="M12 18v4" /><path d="m4.93 4.93 2.83 2.83" /><path d="m16.24 16.24 2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="m4.93 19.07 2.83-2.83" /><path d="m16.24 7.76 2.83-2.83" />
    </svg>
  ),
  rice: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
}

function EditableScoreRow({
  icon,
  label,
  score,
  reasoning,
  fieldKey,
  onSave,
  onIssueUpdated,
}: {
  icon: string
  label: string
  score: number | null
  reasoning?: string | null
  fieldKey: string
  onSave: (updates: Record<string, unknown>) => Promise<boolean>
  onIssueUpdated?: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState<string>(score != null ? String(score) : '')
  const [isSavingScore, setIsSavingScore] = useState(false)

  const handleStartEdit = useCallback(() => {
    setEditValue(score != null ? String(score) : '')
    setIsEditing(true)
  }, [score])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleSaveScore = useCallback(async () => {
    const numValue = parseInt(editValue, 10)
    if (isNaN(numValue) || numValue < 1 || numValue > 5) return
    setIsSavingScore(true)
    await onSave({ [fieldKey]: numValue, priority_manual_override: false })
    setIsSavingScore(false)
    setIsEditing(false)
    onIssueUpdated?.()
  }, [editValue, fieldKey, onSave, onIssueUpdated])

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm">
        <span className="text-[color:var(--text-secondary)]">{SCORE_ICONS[icon]}</span>
        <span className="w-16 text-[color:var(--text-secondary)]">{label}</span>
        <input
          type="number"
          min={1}
          max={5}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSaveScore()
            if (e.key === 'Escape') handleCancel()
          }}
          autoFocus
          className="w-12 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-1.5 py-0.5 font-mono text-sm text-[color:var(--foreground)] focus:border-[color:var(--accent-primary)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleSaveScore()}
          disabled={isSavingScore}
          className="rounded-[4px] p-0.5 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)]"
          aria-label="Save"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-[4px] p-0.5 text-[color:var(--accent-danger)] transition hover:bg-[color:var(--surface-hover)]"
          aria-label="Cancel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2 rounded-[4px] px-1 py-1 text-sm">
      <span className="text-[color:var(--text-secondary)]">{SCORE_ICONS[icon]}</span>
      <span className="w-16 text-[color:var(--text-secondary)]">{label}</span>
      <span className="font-mono font-medium text-[color:var(--foreground)]">
        {score != null ? `${score}/5` : '-'}
      </span>
      {reasoning && (
        <span
          title={reasoning}
          className="cursor-help text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </span>
      )}
      <button
        type="button"
        onClick={handleStartEdit}
        className="rounded-[4px] p-0.5 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
        aria-label={`Edit ${label}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </button>
    </div>
  )
}

