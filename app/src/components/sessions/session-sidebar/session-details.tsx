'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Badge, Combobox } from '@/components/ui'
import { useContacts } from '@/hooks/use-contacts'
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
  onSessionUpdated?: () => void
}

export function SessionDetails({ session, onUpdateSession, onSessionUpdated }: SessionDetailsProps) {
  const sourceInfo = SESSION_SOURCE_INFO[session.source as SessionSource] || SESSION_SOURCE_INFO.widget
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingCustomer, setIsChangingCustomer] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>(session.contact_id ?? undefined)
  const { contacts } = useContacts({ filters: { projectId: session.project_id } })
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

  const handleCustomerSave = useCallback(async () => {
    if (!onUpdateSession) return
    setIsSaving(true)
    const success = await onUpdateSession({ contact_id: selectedContactId ?? null })
    setIsSaving(false)
    if (success) {
      setIsChangingCustomer(false)
      onSessionUpdated?.()
    }
  }, [onUpdateSession, selectedContactId, onSessionUpdated])

  const handleCustomerEditStart = useCallback(() => {
    setSelectedContactId(session.contact_id ?? undefined)
    setIsChangingCustomer(true)
  }, [session.contact_id])

  const handleCustomerEditCancel = useCallback(() => {
    setSelectedContactId(session.contact_id ?? undefined)
    setIsChangingCustomer(false)
  }, [session.contact_id])

  const contactItems = contacts.map((c) => ({ value: c.id, label: c.name }))

  const isExternalSource = session.source === 'gong' || session.source === 'intercom'

  return (
    <div className="flex flex-col gap-4">
      {/* Session ID */}
      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          Session ID
        </label>
        <p className="break-all font-mono text-sm text-[color:var(--foreground)]">
          {session.id}
        </p>
      </div>

      {/* Customer */}
      {(() => {
        const userDisplay = getSessionUserDisplay(session)
        if (isChangingCustomer) {
          return (
            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                Customer
              </label>
              <div className="flex items-center gap-1">
                <Combobox
                  items={contactItems}
                  value={selectedContactId}
                  onValueChange={(val) => setSelectedContactId(val)}
                  placeholder="Search contacts..."
                  emptyMessage="No contacts found"
                  size="sm"
                  className="flex-1"
                  inputClassName="!rounded-[4px] !border !border-[color:var(--border-subtle)] !px-2 !py-1 !text-xs"
                />
                <button
                  type="button"
                  onClick={() => void handleCustomerSave()}
                  disabled={isSaving}
                  className="rounded-[4px] p-1 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                  aria-label="Save"
                >
                  {isSaving ? (
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCustomerEditCancel}
                  className="rounded-[4px] p-1 text-[color:var(--accent-danger)] transition hover:bg-[color:var(--surface-hover)]"
                  aria-label="Cancel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
          )
        }
        return (
          <div className="group flex flex-col gap-1">
            <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              Customer
            </label>
            <div className="flex items-center gap-1">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {userDisplay.name ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                          userDisplay.contactId
                            ? 'bg-[color:var(--accent-info)]'
                            : userDisplay.isHissuno
                              ? 'bg-[color:var(--accent-success)]'
                              : 'bg-[color:var(--text-tertiary)]'
                        }`}
                      />
                      {userDisplay.contactId ? (
                        <Link
                          href={`/projects/${session.project_id}/customers/contacts/${userDisplay.contactId}`}
                          className="text-sm text-[color:var(--foreground)] hover:underline"
                        >
                          {userDisplay.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-[color:var(--foreground)]">{userDisplay.name}</span>
                      )}
                    </div>
                    {userDisplay.companyName && (
                      <span className="ml-4 text-xs text-[color:var(--text-secondary)]">{userDisplay.companyName}</span>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[color:var(--text-tertiary)]">Anonymous</p>
                )}
              </div>
              {onUpdateSession && (
                <button
                  type="button"
                  onClick={handleCustomerEditStart}
                  className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
                  aria-label="Edit Customer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              )}
            </div>
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
