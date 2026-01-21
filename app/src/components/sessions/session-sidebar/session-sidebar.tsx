'use client'

import { useState, useCallback, useEffect } from 'react'
import { Spinner } from '@/components/ui'
import { LimitReachedDialog } from '@/components/billing'
import type { SessionWithProject, ChatMessage, UpdateSessionInput } from '@/types/session'
import { useSessionReview } from '@/hooks/use-session-review'
import { SessionDetails } from './session-details'
import { MessagesView } from './messages-view'
import { SessionTagEditor } from '../session-tags'
import { SessionReviewSection } from '../session-review'

type SessionView = 'messages' | 'details'

interface SessionSidebarProps {
  session: SessionWithProject | null
  messages: ChatMessage[]
  isLoading: boolean
  onClose: () => void
  onSessionUpdated?: () => void
  onUpdateSession?: (input: UpdateSessionInput) => Promise<boolean>
  view: SessionView
  onViewChange: (view: SessionView) => void
}

export function SessionSidebar({
  session,
  messages,
  isLoading,
  onClose,
  onSessionUpdated,
  onUpdateSession,
  view,
  onViewChange,
}: SessionSidebarProps) {
  const {
    isReviewing,
    result: reviewResult,
    tags: reviewTags,
    steps,
    triggerReview,
    limitError,
    clearLimitError,
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
                <SessionDetails session={session} onUpdateSession={onUpdateSession} />
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
                  reviewTags={reviewTags}
                  steps={steps}
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

      {/* Limit reached dialog */}
      {limitError && (
        <LimitReachedDialog
          open={!!limitError}
          onClose={clearLimitError}
          current={limitError.current}
          limit={limitError.limit}
          upgradeUrl={limitError.upgradeUrl}
        />
      )}
    </>
  )
}
