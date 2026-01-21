'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Badge, Spinner, Select } from '@/components/ui'
import type { SessionWithProject, ChatMessage, SessionStatus, SessionSource, UpdateSessionInput } from '@/types/session'
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
  onUpdateSession?: (input: UpdateSessionInput) => Promise<boolean>
}

function SessionDetails({ session, onUpdateSession }: SessionDetailsProps) {
  const sourceInfo = SESSION_SOURCE_INFO[session.source as SessionSource] || SESSION_SOURCE_INFO.widget
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(session.name || '')
  const [isEditingUserId, setIsEditingUserId] = useState(false)
  const [editedUserId, setEditedUserId] = useState(session.user_id || '')
  const [isSaving, setIsSaving] = useState(false)
  const [editingMetadataKey, setEditingMetadataKey] = useState<string | null>(null)
  const [editedMetadataValue, setEditedMetadataValue] = useState('')
  const [isAddingMetadata, setIsAddingMetadata] = useState(false)
  const [newMetadataKey, setNewMetadataKey] = useState('')
  const [newMetadataValue, setNewMetadataValue] = useState('')

  // Sync edited values when session changes
  useEffect(() => {
    setEditedName(session.name || '')
    setEditedUserId(session.user_id || '')
  }, [session.name, session.user_id])

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
      setEditedName(session.name || '')
      setIsEditingName(false)
    }
  }, [handleNameSave, session.name])

  const handleUserIdSave = useCallback(async () => {
    if (!onUpdateSession) return
    setIsSaving(true)
    const success = await onUpdateSession({ user_id: editedUserId || null })
    setIsSaving(false)
    if (success) {
      setIsEditingUserId(false)
    }
  }, [onUpdateSession, editedUserId])

  const handleUserIdKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleUserIdSave()
    } else if (e.key === 'Escape') {
      setEditedUserId(session.user_id || '')
      setIsEditingUserId(false)
    }
  }, [handleUserIdSave, session.user_id])

  const handleStatusChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!onUpdateSession) return
    const newStatus = e.target.value as SessionStatus
    setIsSaving(true)
    await onUpdateSession({ status: newStatus })
    setIsSaving(false)
  }, [onUpdateSession])

  const handleMetadataEdit = useCallback((key: string, value: string) => {
    setEditingMetadataKey(key)
    setEditedMetadataValue(value)
  }, [])

  const handleMetadataSave = useCallback(async () => {
    if (!onUpdateSession || !editingMetadataKey) return
    setIsSaving(true)
    const newMetadata = { ...session.user_metadata, [editingMetadataKey]: editedMetadataValue }
    const success = await onUpdateSession({ user_metadata: newMetadata })
    setIsSaving(false)
    if (success) {
      setEditingMetadataKey(null)
      setEditedMetadataValue('')
    }
  }, [onUpdateSession, editingMetadataKey, editedMetadataValue, session.user_metadata])

  const handleMetadataKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleMetadataSave()
    } else if (e.key === 'Escape') {
      setEditingMetadataKey(null)
      setEditedMetadataValue('')
    }
  }, [handleMetadataSave])

  const handleMetadataDelete = useCallback(async (key: string) => {
    if (!onUpdateSession) return
    setIsSaving(true)
    const newMetadata = { ...session.user_metadata }
    delete newMetadata[key]
    await onUpdateSession({ user_metadata: Object.keys(newMetadata).length > 0 ? newMetadata : null })
    setIsSaving(false)
  }, [onUpdateSession, session.user_metadata])

  const handleAddMetadata = useCallback(async () => {
    if (!onUpdateSession || !newMetadataKey.trim()) return
    setIsSaving(true)
    const newMetadata = { ...session.user_metadata, [newMetadataKey.trim()]: newMetadataValue }
    const success = await onUpdateSession({ user_metadata: newMetadata })
    setIsSaving(false)
    if (success) {
      setIsAddingMetadata(false)
      setNewMetadataKey('')
      setNewMetadataValue('')
    }
  }, [onUpdateSession, newMetadataKey, newMetadataValue, session.user_metadata])

  const handleAddMetadataKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleAddMetadata()
    } else if (e.key === 'Escape') {
      setIsAddingMetadata(false)
      setNewMetadataKey('')
      setNewMetadataValue('')
    }
  }, [handleAddMetadata])

  return (
    <div className="space-y-4">
      {/* Session Name + Status Row */}
      <div className="flex items-start justify-between gap-3">
        {/* Session Name - Editable */}
        <div className="min-w-0 flex-1">
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
              placeholder="Session name..."
            />
          ) : (
            <button
              type="button"
              onClick={() => onUpdateSession && setIsEditingName(true)}
              disabled={!onUpdateSession}
              className="group flex w-full items-center gap-2 text-left disabled:cursor-default"
            >
              <h3 className="truncate text-lg font-semibold text-[color:var(--foreground)]">
                {session.name || 'Unnamed Session'}
              </h3>
              {onUpdateSession && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-[color:var(--text-tertiary)] opacity-0 transition group-hover:opacity-100"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Status Dropdown - Top Right */}
        {onUpdateSession ? (
          <Select
            value={session.status}
            onChange={handleStatusChange}
            disabled={isSaving}
            className="shrink-0 text-xs"
          >
            <option value="active">Active</option>
            <option value="closing_soon">Closing Soon</option>
            <option value="awaiting_idle_response">Awaiting Response</option>
            <option value="closed">Closed</option>
          </Select>
        ) : (
          <Badge variant={session.status === 'active' ? 'success' : 'default'}>
            {session.status}
          </Badge>
        )}
      </div>

      {/* Source, Archived, and Project */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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

      {/* User ID - Editable */}
      <div className="space-y-1">
        <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          User ID
        </label>
        {isEditingUserId ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editedUserId}
              onChange={(e) => setEditedUserId(e.target.value)}
              onKeyDown={handleUserIdKeyDown}
              onBlur={handleUserIdSave}
              autoFocus
              disabled={isSaving}
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 py-1 font-mono text-sm text-[color:var(--foreground)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] disabled:opacity-50"
              placeholder="Enter user ID..."
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onUpdateSession && setIsEditingUserId(true)}
            disabled={!onUpdateSession}
            className="group flex w-full items-center gap-2 text-left disabled:cursor-default"
          >
            <p className="font-mono text-sm text-[color:var(--foreground)]">
              {session.user_id || <span className="text-[color:var(--text-tertiary)]">No user ID</span>}
            </p>
            {onUpdateSession && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[color:var(--text-tertiary)] opacity-0 transition group-hover:opacity-100"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* User Metadata - Editable */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            User Info
          </label>
          {onUpdateSession && !isAddingMetadata && (
            <button
              type="button"
              onClick={() => setIsAddingMetadata(true)}
              className="text-xs text-[color:var(--accent-primary)] hover:underline"
            >
              + Add field
            </button>
          )}
        </div>
        <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-2">
          {session.user_metadata && Object.keys(session.user_metadata).length > 0 ? (
            <div className="space-y-1">
              {Object.entries(session.user_metadata).map(([key, value]) => (
                <div key={key} className="group flex items-center justify-between text-xs">
                  <span className="text-[color:var(--text-secondary)]">{key}:</span>
                  {editingMetadataKey === key ? (
                    <input
                      type="text"
                      value={editedMetadataValue}
                      onChange={(e) => setEditedMetadataValue(e.target.value)}
                      onKeyDown={handleMetadataKeyDown}
                      onBlur={handleMetadataSave}
                      autoFocus
                      disabled={isSaving}
                      className="ml-2 flex-1 rounded border border-[color:var(--border-subtle)] bg-[color:var(--background)] px-1.5 py-0.5 text-xs text-[color:var(--foreground)] focus:border-[color:var(--accent-primary)] focus:outline-none disabled:opacity-50"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateSession && handleMetadataEdit(key, value)}
                        disabled={!onUpdateSession}
                        className="text-[color:var(--foreground)] hover:text-[color:var(--accent-primary)] disabled:cursor-default"
                      >
                        {value}
                      </button>
                      {onUpdateSession && (
                        <button
                          type="button"
                          onClick={() => handleMetadataDelete(key)}
                          className="ml-1 opacity-0 transition group-hover:opacity-100"
                          title="Remove field"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-[color:var(--text-tertiary)] hover:text-[color:var(--accent-danger)]"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !isAddingMetadata ? (
            <p className="text-xs text-[color:var(--text-tertiary)]">No user info</p>
          ) : null}

          {/* Add new field form */}
          {isAddingMetadata && (
            <div className="mt-2 space-y-2 border-t border-[color:var(--border-subtle)] pt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMetadataKey}
                  onChange={(e) => setNewMetadataKey(e.target.value)}
                  onKeyDown={handleAddMetadataKeyDown}
                  placeholder="Field name"
                  autoFocus
                  disabled={isSaving}
                  className="flex-1 rounded border border-[color:var(--border-subtle)] bg-[color:var(--background)] px-1.5 py-1 text-xs text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-primary)] focus:outline-none disabled:opacity-50"
                />
                <input
                  type="text"
                  value={newMetadataValue}
                  onChange={(e) => setNewMetadataValue(e.target.value)}
                  onKeyDown={handleAddMetadataKeyDown}
                  placeholder="Value"
                  disabled={isSaving}
                  className="flex-1 rounded border border-[color:var(--border-subtle)] bg-[color:var(--background)] px-1.5 py-1 text-xs text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-primary)] focus:outline-none disabled:opacity-50"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMetadata(false)
                    setNewMetadataKey('')
                    setNewMetadataValue('')
                  }}
                  className="rounded px-2 py-1 text-xs text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMetadata}
                  disabled={!newMetadataKey.trim() || isSaving}
                  className="rounded bg-[color:var(--accent-primary)] px-2 py-1 text-xs text-white hover:bg-[color:var(--accent-primary-hover)] disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
