'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Spinner, Badge, CollapsibleSection } from '@/components/ui'
import { LimitReachedDialog } from '@/components/billing'
import type { SessionWithProject, ChatMessage, UpdateSessionInput, SessionStatus, SessionType, SessionSource } from '@/types/session'
import { SESSION_TYPE_INFO, SESSION_SOURCE_INFO } from '@/types/session'
import { useSessionReview } from '@/hooks/use-session-review'
import { SessionDetails } from './session-details'
import { SessionContentView } from './session-content-view'
import { SessionTagEditor } from '../session-tags'
import { SessionReviewSection } from '../session-review'

type DropdownId = 'status'

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'closing_soon', label: 'Closing Soon' },
  { value: 'awaiting_idle_response', label: 'Awaiting Response' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_COLORS: Record<SessionStatus, string> = {
  active: 'var(--accent-success)',
  closing_soon: 'var(--accent-warning)',
  awaiting_idle_response: 'var(--accent-info)',
  closed: 'var(--text-tertiary)',
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

interface SessionSidebarProps {
  session: SessionWithProject | null
  messages: ChatMessage[]
  isLoading: boolean
  expandMessages?: boolean
  onClose: () => void
  onSessionUpdated?: () => void
  onUpdateSession?: (input: UpdateSessionInput) => Promise<boolean>
}

export function SessionSidebar({
  session,
  messages,
  isLoading,
  expandMessages,
  onClose,
  onSessionUpdated,
  onUpdateSession,
}: SessionSidebarProps) {
  const {
    isReviewing,
    result: reviewResult,
    tags: reviewTags,
    steps,
    triggerReview,
    limitError,
    clearLimitError,
  } = useSessionReview({ projectId: session?.project_id ?? null, sessionId: session?.id ?? null })
  const [showReviewResult, setShowReviewResult] = useState(false)
  const [localTags, setLocalTags] = useState<string[]>(session?.tags ?? [])
  const [isArchiving, setIsArchiving] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(session?.name || '')
  const [isSaving, setIsSaving] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<DropdownId | null>(null)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)

  const isExternalSource = session?.source === 'gong' || session?.source === 'intercom'

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

  // Sync edited name when session changes
  useEffect(() => {
    setEditedName(session?.name || '')
  }, [session?.name])

  const handleArchiveToggle = useCallback(async () => {
    if (!session) return
    setIsArchiving(true)
    try {
      const response = await fetch(`/api/projects/${session.project_id}/sessions/${session.id}/archive`, {
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
      setOpenDropdown(null)
    }
  }, [session, onSessionUpdated])

  const handleNameSave = useCallback(async () => {
    if (!onUpdateSession) return
    setIsSaving(true)
    const success = await onUpdateSession({ name: editedName || null })
    setIsSaving(false)
    if (success) {
      setIsEditingName(false)
    }
  }, [onUpdateSession, editedName])

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleNameSave()
    } else if (e.key === 'Escape') {
      setEditedName(session?.name || '')
      setIsEditingName(false)
    }
  }, [handleNameSave, session?.name])

  const handleStatusSelect = useCallback(async (newStatus: SessionStatus) => {
    if (!onUpdateSession) return
    setIsSaving(true)
    await onUpdateSession({ status: newStatus })
    setIsSaving(false)
    onSessionUpdated?.()
    setOpenDropdown(null)
  }, [onUpdateSession, onSessionUpdated])

  const handleHumanTakeoverToggle = useCallback(async () => {
    if (!onUpdateSession || !session) return
    setIsSaving(true)
    await onUpdateSession({ is_human_takeover: !session.is_human_takeover })
    setIsSaving(false)
    onSessionUpdated?.()
  }, [onUpdateSession, session, onSessionUpdated])

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
    setOpenDropdown(null)
    await triggerReview()
  }, [session, triggerReview])

  const handleTagsUpdated = useCallback((tags: string[]) => {
    setLocalTags(tags)
    onSessionUpdated?.()
  }, [onSessionUpdated])

  const toggleDropdown = useCallback((id: DropdownId) => {
    setOpenDropdown((prev) => (prev === id ? null : id))
  }, [])

  const sessionType: SessionType = session?.session_type ?? 'chat'
  const typeInfo = SESSION_TYPE_INFO[sessionType]

  const showHumanTakeover = onUpdateSession && session && !isExternalSource && session.status !== 'closed'
  const canEditStatus = onUpdateSession && !isExternalSource
  const wasReviewed = Boolean(session?.pm_reviewed_at)

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
          {/* Row 1: "Session Details" + close */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              Feedback Details
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

          {/* Row 2: Session name + source badge */}
          {session && (
            <div className="mt-1">
              <div className="min-w-0">
                {isEditingName ? (
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    onBlur={handleNameSave}
                    autoFocus
                    disabled={isSaving}
                    className="w-full rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 py-1 text-lg font-semibold text-[color:var(--foreground)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] disabled:opacity-50"
                    placeholder="Feedback name..."
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onUpdateSession && setIsEditingName(true)}
                    disabled={!onUpdateSession}
                    className="group flex w-full items-center gap-2 text-left disabled:cursor-default"
                  >
                    <h3 className="truncate text-lg font-semibold text-[color:var(--foreground)]">
                      {session.name || 'Unnamed Feedback'}
                    </h3>
                    {session.source && (
                      <Badge variant={SESSION_SOURCE_INFO[session.source as SessionSource]?.variant ?? 'default'}>
                        {SESSION_SOURCE_INFO[session.source as SessionSource]?.label ?? session.source}
                      </Badge>
                    )}
                    {onUpdateSession && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[color:var(--text-tertiary)] opacity-0 transition group-hover:opacity-100">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Row 3: Action buttons */}
          {session && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" ref={dropdownContainerRef}>
              {/* Human Takeover (direct toggle) */}
              {showHumanTakeover && (
                <button
                  type="button"
                  onClick={() => void handleHumanTakeoverToggle()}
                  disabled={isSaving}
                  className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${
                    session.is_human_takeover
                      ? 'text-[color:var(--accent-warning)]'
                      : 'text-[color:var(--text-secondary)]'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
                    <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
                    <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                  </svg>
                  <span>Takeover</span>
                </button>
              )}

              {/* Archive (direct action) */}
              <button
                type="button"
                onClick={() => void handleArchiveToggle()}
                disabled={isArchiving}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  session.is_archived
                    ? 'text-[color:var(--accent-primary)]'
                    : 'text-[color:var(--text-secondary)]'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="5" rx="2" />
                  <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                  <path d="M10 13h4" />
                </svg>
                <span>{isArchiving ? 'Updating...' : session.is_archived ? 'Unarchive' : 'Archive'}</span>
              </button>

              {/* Status (dropdown with options) */}
              <div className="relative">
                {canEditStatus ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleDropdown('status')}
                      className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STATUS_COLORS[session.status as SessionStatus] ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" fill={STATUS_COLORS[session.status as SessionStatus] ?? 'currentColor'} fillOpacity="0.2" />
                        <circle cx="12" cy="12" r="4" fill={STATUS_COLORS[session.status as SessionStatus] ?? 'currentColor'} />
                      </svg>
                      <span>{STATUS_OPTIONS.find((o) => o.value === session.status)?.label ?? session.status}</span>
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
                              <span className={session.status === option.value ? 'font-medium text-[color:var(--foreground)]' : 'text-[color:var(--text-secondary)]'}>
                                {option.label}
                              </span>
                              {session.status === option.value && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-[color:var(--accent-primary)]">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-[color:var(--text-secondary)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STATUS_COLORS[session.status as SessionStatus] ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" fill={STATUS_COLORS[session.status as SessionStatus] ?? 'currentColor'} fillOpacity="0.2" />
                      <circle cx="12" cy="12" r="4" fill={STATUS_COLORS[session.status as SessionStatus] ?? 'currentColor'} />
                    </svg>
                    <span>{STATUS_OPTIONS.find((o) => o.value === session.status)?.label ?? session.status}</span>
                  </span>
                )}
              </div>

              {/* Analyze (direct action) */}
              <button
                type="button"
                onClick={() => void handleReview()}
                disabled={isReviewing}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  wasReviewed
                    ? 'text-[color:var(--accent-success)]'
                    : 'text-[color:var(--text-secondary)]'
                }`}
              >
                {wasReviewed ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  </svg>
                )}
                <span>{isReviewing ? 'Analyzing...' : wasReviewed ? 'Re-Analyze' : 'Analyze'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : session ? (
          <div className="flex-1 overflow-y-auto">
            {/* Session Analysis (open by default) */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection title="Feedback Analysis" variant="flat" defaultExpanded>
                <div className="flex flex-col gap-4">
                  {/* Tags */}
                  <SessionTagEditor
                    projectId={session.project_id}
                    sessionId={session.id}
                    currentTags={localTags}
                    onTagsUpdated={handleTagsUpdated}
                    disabled={isReviewing}
                  />

                  {/* Review */}
                  <SessionReviewSection
                    session={session}
                    isReviewing={isReviewing}
                    result={reviewResult}
                    showResult={showReviewResult}
                    reviewTags={reviewTags}
                    steps={steps}
                  />
                </div>
              </CollapsibleSection>
            </div>

            {/* Session Metadata (closed by default) */}
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CollapsibleSection title="Feedback Metadata" variant="flat" defaultExpanded={false}>
                <SessionDetails session={session} onUpdateSession={onUpdateSession} onSessionUpdated={onSessionUpdated} />
              </CollapsibleSection>
            </div>

            {/* Session Messages/Transcript (closed by default) */}
            <div className="border-b-2 border-[color:var(--border-subtle)]">
              <div className="p-4">
                <CollapsibleSection title={`${typeInfo.contentLabel} (${messages.length})`} variant="flat" defaultExpanded={false} expanded={expandMessages}>
                  <div className="mx-[-1rem] mt-[-1rem]">
                    <SessionContentView
                      session={session}
                      messages={messages}
                      onMessageSent={onSessionUpdated}
                    />
                  </div>
                </CollapsibleSection>
              </div>
            </div>
          </div>
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
