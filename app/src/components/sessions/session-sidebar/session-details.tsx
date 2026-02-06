'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Badge, Select } from '@/components/ui'
import type { SessionWithProject, SessionStatus, SessionSource, UpdateSessionInput } from '@/types/session'
import { SESSION_SOURCE_INFO } from '@/types/session'

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

interface SessionDetailsProps {
  session: SessionWithProject
  onUpdateSession?: (input: UpdateSessionInput) => Promise<boolean>
}

export function SessionDetails({ session, onUpdateSession }: SessionDetailsProps) {
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

      {/* Human Takeover Toggle */}
      {onUpdateSession && (
        <div className="flex items-center justify-between rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">Human Takeover</span>
            {session.is_human_takeover && (
              <Badge variant="warning">Active</Badge>
            )}
          </div>
          <button
            type="button"
            onClick={() => onUpdateSession({ is_human_takeover: !session.is_human_takeover })}
            disabled={isSaving}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
              session.is_human_takeover
                ? 'bg-[color:var(--accent-warning)]'
                : 'bg-[color:var(--border-subtle)]'
            }`}
            role="switch"
            aria-checked={session.is_human_takeover}
            aria-label="Toggle human takeover"
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                session.is_human_takeover ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      )}

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
