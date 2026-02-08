'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import type { SessionWithProject, SessionSource, SessionType, UpdateSessionInput } from '@/types/session'
import { SESSION_SOURCE_INFO, SESSION_TYPE_INFO, getSessionUserDisplay } from '@/types/session'

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
  const [isSaving, setIsSaving] = useState(false)
  const [editingMetadataKey, setEditingMetadataKey] = useState<string | null>(null)
  const [editedMetadataValue, setEditedMetadataValue] = useState('')
  const [isAddingMetadata, setIsAddingMetadata] = useState(false)
  const [newMetadataKey, setNewMetadataKey] = useState('')
  const [newMetadataValue, setNewMetadataValue] = useState('')

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

  const isExternalSource = session.source === 'gong' || session.source === 'intercom'

  return (
    <div className="flex flex-col gap-4">
      {/* Source, Type, Archived, and Project */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={sourceInfo.variant}>
            {sourceInfo.label}
          </Badge>
          <Badge variant={SESSION_TYPE_INFO[session.session_type as SessionType]?.variant ?? 'default'}>
            {SESSION_TYPE_INFO[session.session_type as SessionType]?.label ?? session.session_type}
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
      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          Session ID
        </label>
        <p className="break-all font-mono text-sm text-[color:var(--foreground)]">
          {session.id}
        </p>
      </div>

      {/* User */}
      {(() => {
        const userDisplay = getSessionUserDisplay(session)
        return (
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              User
            </label>
            {userDisplay.name ? (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    userDisplay.isHissuno
                      ? 'bg-[color:var(--accent-success)]'
                      : 'bg-[color:var(--text-tertiary)]'
                  }`}
                />
                <span className="text-sm text-[color:var(--foreground)]">{userDisplay.name}</span>
                <Badge variant={userDisplay.isHissuno ? 'success' : 'default'}>
                  {userDisplay.isHissuno ? 'Hissuno' : 'External'}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-[color:var(--text-tertiary)]">Unknown</p>
            )}
          </div>
        )
      })()}

      {/* User Metadata - Editable */}
      <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
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
            <div className="mt-2 flex flex-col gap-2 border-t border-[color:var(--border-subtle)] pt-2">
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

      {/* Participants (Gong sessions only) */}
      {session.source === 'gong' && session.user_metadata?.gong_participants && (
        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Participants
          </label>
          <div className="flex flex-col gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-2">
            {(session.user_metadata.gong_participants as unknown as Array<{ name: string; email: string | null; title: string | null; affiliation: string }>).map((participant, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    participant.affiliation === 'external'
                      ? 'bg-[color:var(--accent-info)]'
                      : 'bg-[color:var(--text-tertiary)]'
                  }`}
                />
                <span className="truncate font-medium text-[color:var(--foreground)]">
                  {participant.name}
                </span>
                {participant.affiliation === 'external' && (
                  <Badge variant="info">External</Badge>
                )}
                {participant.title && (
                  <span className="truncate text-[color:var(--text-tertiary)]">
                    {participant.title}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page */}
      {(session.page_title || session.page_url) && (
        <div className="flex flex-col gap-1">
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
        <div className="flex flex-col gap-1">
          <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">
            Created
          </label>
          <p className="text-[color:var(--foreground)]">
            {formatDateTime(session.created_at)}
          </p>
        </div>
        <div className="flex flex-col gap-1">
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
