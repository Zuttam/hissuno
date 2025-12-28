'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Badge, Spinner } from '@/components/ui'
import type { SessionWithProject, ChatMessage } from '@/types/session'
import { usePMReview } from '@/hooks/use-pm-review'
import { MessagesPanel } from './messages-panel'

interface SessionSidebarProps {
  session: SessionWithProject | null
  messages: ChatMessage[]
  isLoading: boolean
  onClose: () => void
  onSessionUpdated?: () => void
}

export function SessionSidebar({
  session,
  messages,
  isLoading,
  onClose,
  onSessionUpdated,
}: SessionSidebarProps) {
  const {
    isReviewing,
    result: pmResult,
    currentStep,
    triggerReview,
  } = usePMReview({ sessionId: session?.id ?? null })
  const [showPMResult, setShowPMResult] = useState(false)
  const [showMessagesPanel, setShowMessagesPanel] = useState(false)

  // Refresh session data when review completes
  useEffect(() => {
    if (pmResult && !isReviewing) {
      onSessionUpdated?.()
    }
  }, [pmResult, isReviewing, onSessionUpdated])

  const handlePMReview = useCallback(async () => {
    if (!session) return
    setShowPMResult(true)
    await triggerReview()
  }, [session, triggerReview])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[color:var(--border-subtle)] p-4">
          <h2 className="font-mono text-lg font-bold uppercase tracking-tight text-[color:var(--foreground)]">
            Session Details
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
        ) : session ? (
          <>
            {/* Session Details */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <SessionDetails session={session} />
            </div>

            {/* PM Review Button */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <PMReviewSection
                session={session}
                isReviewing={isReviewing}
                result={pmResult}
                showResult={showPMResult}
                currentStep={currentStep}
                onTriggerReview={handlePMReview}
              />
            </div>

            {/* Messages Preview */}
            <div className="p-4">
              <MessagesPreview
                messages={messages}
                onExpand={() => setShowMessagesPanel(true)}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[color:var(--text-secondary)]">Session not found</p>
          </div>
        )}
      </aside>

      {/* Messages Panel */}
      {showMessagesPanel && (
        <MessagesPanel
          messages={messages}
          onClose={() => setShowMessagesPanel(false)}
        />
      )}
    </>
  )
}

interface SessionDetailsProps {
  session: SessionWithProject
}

function SessionDetails({ session }: SessionDetailsProps) {
  return (
    <div className="space-y-4">
      {/* Status and Project */}
      <div className="flex items-center justify-between">
        <Badge variant={session.status === 'active' ? 'success' : 'default'}>
          {session.status}
        </Badge>
        <span className="font-mono text-sm text-[color:var(--foreground)]">
          {session.project?.name || 'Unknown Project'}
        </span>
      </div>

      {/* Session ID */}
      <div className="space-y-1">
        <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          Session ID
        </label>
        <p className="break-all font-mono text-sm text-[color:var(--foreground)]">
          {session.id}
        </p>
      </div>

      {/* User */}
      {session.user_id && (
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            User ID
          </label>
          <p className="font-mono text-sm text-[color:var(--foreground)]">
            {session.user_id}
          </p>
        </div>
      )}

      {/* User Metadata */}
      {session.user_metadata && Object.keys(session.user_metadata).length > 0 && (
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            User Info
          </label>
          <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-2">
            {Object.entries(session.user_metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-[color:var(--text-secondary)]">{key}:</span>
                <span className="text-[color:var(--foreground)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page */}
      {(session.page_title || session.page_url) && (
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Page
          </label>
          {session.page_title && (
            <p className="text-sm text-[color:var(--foreground)]">
              {session.page_title}
            </p>
          )}
          {session.page_url && (
            <a
              href={session.page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-[color:var(--accent-primary)] hover:underline"
            >
              {session.page_url}
            </a>
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Created
          </label>
          <p className="text-[color:var(--foreground)]">
            {formatDateTime(session.created_at)}
          </p>
        </div>
        <div className="space-y-1">
          <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Last Activity
          </label>
          <p className="text-[color:var(--foreground)]">
            {formatDateTime(session.last_activity_at)}
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

interface MessagesPreviewProps {
  messages: ChatMessage[]
  onExpand: () => void
}

function MessagesPreview({ messages, onExpand }: MessagesPreviewProps) {
  const latestMessage = messages[messages.length - 1]
  const previewText = latestMessage?.content
    ? latestMessage.content.slice(0, 100) + (latestMessage.content.length > 100 ? '...' : '')
    : null

  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 text-left transition hover:border-[color:var(--accent-primary)] hover:bg-[color:var(--surface-hover)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          Messages ({messages.length})
        </span>
        <span className="text-xs text-[color:var(--accent-primary)]">View all →</span>
      </div>
      {latestMessage ? (
        <div className="space-y-1">
          <p className="line-clamp-2 text-sm text-[color:var(--foreground)]">
            {previewText}
          </p>
          <p className="text-xs text-[color:var(--text-tertiary)]">
            {latestMessage.role === 'user' ? 'User' : 'Assistant'} · {formatDateTime(latestMessage.createdAt)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[color:var(--text-secondary)]">
          No messages yet
        </p>
      )}
    </button>
  )
}

interface PMReviewSectionProps {
  session: SessionWithProject
  isReviewing: boolean
  result: import('@/types/issue').PMReviewResult | null
  showResult: boolean
  currentStep: string | null
  onTriggerReview: () => void
}

function PMReviewSection({
  session,
  isReviewing,
  result,
  showResult,
  currentStep,
  onTriggerReview,
}: PMReviewSectionProps) {
  const wasReviewed = Boolean(session.pm_reviewed_at)
  const linkedIssues = session.linked_issues ?? []
  const hasLinkedIssues = linkedIssues.length > 0

  // Show fresh result if available, otherwise show persisted linked issues
  const showFreshResult = showResult && result && !isReviewing
  const showPersistedResult = !showFreshResult && !isReviewing && wasReviewed

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            PM Review
          </label>
          {wasReviewed && (
            <p className="text-xs text-[color:var(--text-secondary)]">
              Last reviewed: {formatDateTime(session.pm_reviewed_at!)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onTriggerReview}
          disabled={isReviewing}
          className="rounded-[4px] border-2 border-[color:var(--accent-primary)] bg-transparent px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--accent-primary)] transition hover:bg-[color:var(--accent-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isReviewing ? 'Analyzing...' : wasReviewed ? 'Re-analyze' : 'Run PM Review'}
        </button>
      </div>

      {isReviewing && (
        <div className="flex items-center gap-2 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
          <Spinner />
          <span className="text-sm text-[color:var(--text-secondary)]">
            {currentStep || 'Analyzing session for actionable feedback...'}
          </span>
        </div>
      )}

      {/* Show fresh result from current analysis */}
      {showFreshResult && (
        <PMReviewResult result={result} />
      )}

      {/* Show persisted result from database */}
      {showPersistedResult && (
        hasLinkedIssues ? (
          <LinkedIssuesDisplay issues={linkedIssues} />
        ) : (
          <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg text-[color:var(--text-tertiary)]">—</span>
              <div>
                <p className="font-medium text-[color:var(--foreground)]">Marked as irrelevant</p>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Session does not contain actionable feedback
                </p>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

interface LinkedIssuesDisplayProps {
  issues: import('@/types/session').SessionLinkedIssue[]
}

function LinkedIssuesDisplay({ issues }: LinkedIssuesDisplayProps) {
  const typeLabels = {
    bug: 'Bug',
    feature_request: 'Feature',
    change_request: 'Change',
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div
          key={issue.id}
          className="rounded-[4px] border border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)]/10 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg text-[color:var(--accent-primary)]">✓</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[color:var(--accent-primary)]/20 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[color:var(--accent-primary)]">
                  {typeLabels[issue.type]}
                </span>
                <span className="text-xs text-[color:var(--text-secondary)]">
                  {issue.upvote_count} upvote{issue.upvote_count !== 1 ? 's' : ''}
                </span>
              </div>
              <Link
                href={`/issues?issue=${issue.id}`}
                className="mt-1 block truncate text-sm text-[color:var(--accent-primary)] hover:underline"
              >
                {issue.title}
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface PMReviewResultProps {
  result: import('@/types/issue').PMReviewResult
}

function PMReviewResult({ result }: PMReviewResultProps) {
  if (result.action === 'skipped') {
    return (
      <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[color:var(--text-tertiary)]">—</span>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Marked as irrelevant</p>
            <p className="text-xs text-[color:var(--text-secondary)]">
              {result.skipReason || 'Session does not contain actionable feedback'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (result.action === 'created') {
    return (
      <div className="rounded-[4px] border border-[color:var(--accent-success)] bg-[color:var(--accent-success)]/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[color:var(--accent-success)]">✓</span>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Issue created</p>
            {result.issueTitle && (
              result.issueId ? (
                <Link
                  href={`/issues?issue=${result.issueId}`}
                  className="text-xs text-[color:var(--accent-primary)] hover:underline"
                >
                  {result.issueTitle}
                </Link>
              ) : (
                <p className="text-xs text-[color:var(--text-secondary)]">{result.issueTitle}</p>
              )
            )}
          </div>
        </div>
        {result.thresholdMet && (
          <p className="mt-2 text-xs text-[color:var(--accent-success)]">
            Threshold reached! {result.specGenerated ? 'Product spec generated.' : 'Generating product spec...'}
          </p>
        )}
      </div>
    )
  }

  if (result.action === 'upvoted') {
    return (
      <div className="rounded-[4px] border border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)]/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[color:var(--accent-primary)]">↑</span>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Existing issue upvoted</p>
            {result.issueTitle && (
              result.issueId ? (
                <Link
                  href={`/issues?issue=${result.issueId}`}
                  className="text-xs text-[color:var(--accent-primary)] hover:underline"
                >
                  {result.issueTitle}
                </Link>
              ) : (
                <p className="text-xs text-[color:var(--text-secondary)]">{result.issueTitle}</p>
              )
            )}
          </div>
        </div>
        {result.thresholdMet && (
          <p className="mt-2 text-xs text-[color:var(--accent-primary)]">
            Threshold reached! {result.specGenerated ? 'Product spec generated.' : 'Generating product spec...'}
          </p>
        )}
      </div>
    )
  }

  return null
}
