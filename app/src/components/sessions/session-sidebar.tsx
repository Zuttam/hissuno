'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Badge, Spinner } from '@/components/ui'
import type { SessionWithProject, ChatMessage, SessionStatus, SessionSource } from '@/types/session'
import { SESSION_SOURCE_INFO } from '@/types/session'
import { useSessionReview } from '@/hooks/use-session-review'
import { SessionChat } from './session-chat'
import { SessionTagEditor } from './session-tag-editor'
import { SessionTagList } from './session-tag-badge'

type SessionView = 'messages' | 'details'

interface SessionSidebarProps {
  session: SessionWithProject | null
  messages: ChatMessage[]
  isLoading: boolean
  onClose: () => void
  onSessionUpdated?: () => void
  view: SessionView
  onViewChange: (view: SessionView) => void
}

export function SessionSidebar({
  session,
  messages,
  isLoading,
  onClose,
  onSessionUpdated,
  view,
  onViewChange,
}: SessionSidebarProps) {
  const {
    isReviewing,
    result: reviewResult,
    currentPhase,
    progressMessage,
    tags: reviewTags,
    triggerReview,
  } = useSessionReview({ sessionId: session?.id ?? null })
  const [showReviewResult, setShowReviewResult] = useState(false)
  const [localTags, setLocalTags] = useState<string[]>(session?.tags ?? [])
  const [isArchiving, setIsArchiving] = useState(false)

  const handleArchiveToggle = useCallback(async () => {
    if (!session) return
    setIsArchiving(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: !session.is_archived }),
      })
      if (!response.ok) {
        throw new Error('Failed to update archive status')
      }
      onSessionUpdated?.()
    } catch (err) {
      console.error('[session-sidebar] archive toggle failed:', err)
    } finally {
      setIsArchiving(false)
    }
  }, [session, onSessionUpdated])

  // Sync local tags with session tags
  useEffect(() => {
    setLocalTags(session?.tags ?? [])
  }, [session?.tags])

  // Update local tags when review completes with new tags
  useEffect(() => {
    if (reviewTags.length > 0 && !isReviewing) {
      setLocalTags(reviewTags)
    }
  }, [reviewTags, isReviewing])

  // Refresh session data when review completes
  useEffect(() => {
    if (reviewResult && !isReviewing) {
      onSessionUpdated?.()
    }
  }, [reviewResult, isReviewing, onSessionUpdated])

  const handleReview = useCallback(async () => {
    if (!session) return
    setShowReviewResult(true)
    await triggerReview()
  }, [session, triggerReview])

  const handleTagsUpdated = useCallback((tags: string[]) => {
    setLocalTags(tags)
    onSessionUpdated?.()
  }, [onSessionUpdated])

  const isSessionActive = session?.status !== 'closed'

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
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-lg font-bold uppercase tracking-tight text-[color:var(--foreground)]">
              {view === 'messages' ? 'Conversation' : 'Session Details'}
            </h2>
            {view === 'messages' && isSessionActive && (
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600">
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle link */}
            <button
              type="button"
              onClick={() => onViewChange(view === 'messages' ? 'details' : 'messages')}
              className="rounded-[4px] px-3 py-1.5 text-sm text-[color:var(--accent-primary)] transition hover:bg-[color:var(--surface-hover)]"
            >
              {view === 'messages' ? 'View Details →' : '← Messages'}
            </button>
            {session && (
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={isArchiving}
                className="rounded-[4px] p-1.5 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={session.is_archived ? 'Unarchive session' : 'Archive session'}
                title={session.is_archived ? 'Unarchive' : 'Archive'}
              >
                {session.is_archived ? (
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
        ) : session ? (
          view === 'messages' ? (
            <MessagesView
              session={session}
              messages={messages}
              onMessageSent={onSessionUpdated}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Session Details */}
              <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
                <SessionDetails session={session} />
              </div>

              {/* Tags Section */}
              <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
                <SessionTagEditor
                  sessionId={session.id}
                  currentTags={localTags}
                  onTagsUpdated={handleTagsUpdated}
                  disabled={isReviewing}
                />
              </div>

              {/* Session Review */}
              <div className="p-4">
                <SessionReviewSection
                  session={session}
                  isReviewing={isReviewing}
                  result={reviewResult}
                  showResult={showReviewResult}
                  currentPhase={currentPhase}
                  progressMessage={progressMessage}
                  reviewTags={reviewTags}
                  onTriggerReview={handleReview}
                />
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[color:var(--text-secondary)]">Session not found</p>
          </div>
        )}
      </aside>
    </>
  )
}

interface SessionDetailsProps {
  session: SessionWithProject
}

function SessionDetails({ session }: SessionDetailsProps) {
  const sourceInfo = SESSION_SOURCE_INFO[session.source as SessionSource] || SESSION_SOURCE_INFO.widget

  return (
    <div className="space-y-4">
      {/* Status, Source, and Project */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={session.status === 'active' ? 'success' : 'default'}>
            {session.status}
          </Badge>
          <Badge variant={sourceInfo.variant}>
            {sourceInfo.label}
          </Badge>
          {session.is_archived && (
            <Badge variant="default">Archived</Badge>
          )}
        </div>
        <Link
          href={`/projects/${session.project_id}`}
          className="font-mono text-sm text-[color:var(--accent-primary)] hover:underline"
        >
          {session.project?.name || 'Unknown Project'}
        </Link>
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

interface MessagesViewProps {
  session: SessionWithProject
  messages: ChatMessage[]
  onMessageSent?: () => void
}

function MessagesView({ session, messages, onMessageSent }: MessagesViewProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSessionActive = session.status !== 'closed'

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const content = input.trim()
      if (!content || isSending || !isSessionActive) return

      setError(null)
      setIsSending(true)

      try {
        const response = await fetch(`/api/sessions/${session.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to send message')
        }

        setInput('')
        onMessageSent?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message')
      } finally {
        setIsSending(false)
      }
    },
    [input, isSending, isSessionActive, session.id, onMessageSent]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e)
      }
    },
    [handleSubmit]
  )

  return (
    <>
      {/* Chat Content */}
      <div className="flex-1 overflow-hidden">
        <SessionChat messages={messages} />
      </div>

      {/* Reply Input */}
      {isSessionActive && (
        <div className="border-t-2 border-[color:var(--border-subtle)] p-4">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-2 rounded-[4px] bg-red-500/10 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply as human agent..."
                  disabled={isSending}
                  rows={2}
                  className="w-full resize-none rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[color:var(--accent-primary)] text-white transition hover:bg-[color:var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {isSending ? (
                  <svg
                    className="h-5 w-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
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
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--text-tertiary)]">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </div>
      )}

      {/* Closed session notice */}
      {!isSessionActive && (
        <div className="border-t-2 border-[color:var(--border-subtle)] p-4">
          <div className="rounded-[4px] bg-[color:var(--surface)] p-3 text-center text-sm text-[color:var(--text-secondary)]">
            This session is closed. You cannot send new messages.
          </div>
        </div>
      )}
    </>
  )
}

interface SessionReviewSectionProps {
  session: SessionWithProject
  isReviewing: boolean
  result: import('@/hooks/use-session-review').SessionReviewResult | null
  showResult: boolean
  currentPhase: 'classify' | 'pm-review' | null
  progressMessage: string | null
  reviewTags: string[]
  onTriggerReview: () => void
}

function SessionReviewSection({
  session,
  isReviewing,
  result,
  showResult,
  currentPhase,
  progressMessage,
  reviewTags,
  onTriggerReview,
}: SessionReviewSectionProps) {
  const wasReviewed = Boolean(session.pm_reviewed_at)
  const linkedIssues = session.linked_issues ?? []
  const hasLinkedIssues = linkedIssues.length > 0

  // Show fresh result if available, otherwise show persisted linked issues
  const showFreshResult = showResult && result && !isReviewing
  const showPersistedResult = !showFreshResult && !isReviewing && wasReviewed

  // Get current step message - prefer real progress from stream, fallback to phase-based
  const currentStepMessage = progressMessage
    ?? (currentPhase === 'classify'
      ? 'Classifying session...'
      : currentPhase === 'pm-review'
        ? 'Analyzing for actionable feedback...'
        : 'Starting review...')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Session Review
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
          {isReviewing ? 'Analyzing...' : wasReviewed ? 'Re-analyze' : 'Run Review'}
        </button>
      </div>

      {isReviewing && (
        <div className="flex items-center gap-2 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3">
          <Spinner />
          <span className="text-sm text-[color:var(--text-secondary)]">
            {currentStepMessage}
          </span>
        </div>
      )}

      {/* Show tags applied during review */}
      {isReviewing && reviewTags.length > 0 && (
        <div className="rounded-[4px] border border-[color:var(--accent-success)] bg-[color:var(--accent-success)]/10 p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg text-[color:var(--accent-success)]">✓</span>
            <div>
              <p className="text-sm font-medium text-[color:var(--foreground)]">Tags applied</p>
              <div className="mt-1">
                <SessionTagList tags={reviewTags} size="sm" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show fresh result from current analysis */}
      {showFreshResult && (
        <SessionReviewResult result={result} />
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
                <p className="font-medium text-[color:var(--foreground)]">No issues found</p>
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

interface SessionReviewResultProps {
  result: import('@/hooks/use-session-review').SessionReviewResult
}

function SessionReviewResult({ result }: SessionReviewResultProps) {
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
