'use client'

import { useState, useCallback } from 'react'
import { Spinner, Dialog, Button } from '@/components/ui'
import { useContactDetail } from '@/hooks/use-contacts'
import type { UpdateContactInput } from '@/types/customer'

interface ContactSidebarProps {
  projectId: string
  contactId: string
  onClose: () => void
  onContactUpdated?: () => void
}

const CONTACT_FIELD_MAP: Record<string, keyof UpdateContactInput> = {
  title: 'title',
  role: 'role',
  phone: 'phone',
  notes: 'notes',
  lastContactedAt: 'last_contacted_at',
}

export function ContactSidebar({
  projectId,
  contactId,
  onClose,
  onContactUpdated,
}: ContactSidebarProps) {
  const { contact, isLoading, updateContact, archiveContact } = useContactDetail({ projectId, contactId })
  const [isArchiving, setIsArchiving] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  const handleArchiveToggle = useCallback(async () => {
    if (!contact) return
    setIsArchiving(true)
    try {
      const success = await archiveContact(!contact.is_archived)
      if (success) {
        onContactUpdated?.()
      }
    } catch (err) {
      console.error('[contact-sidebar] archive toggle failed:', err)
    } finally {
      setIsArchiving(false)
    }
  }, [contact, archiveContact, onContactUpdated])

  const handleChampionToggle = useCallback(async () => {
    if (!contact) return
    await updateContact({ is_champion: !contact.is_champion })
    onContactUpdated?.()
  }, [contact, updateContact, onContactUpdated])

  const handleFieldSave = useCallback(async (fieldKey: string, newValue: string): Promise<boolean> => {
    const dbColumn = CONTACT_FIELD_MAP[fieldKey]
    if (!dbColumn) return false
    const success = await updateContact({ [dbColumn]: newValue || null } as UpdateContactInput)
    if (success) onContactUpdated?.()
    return success
  }, [updateContact, onContactUpdated])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              Contact Details
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

          {contact && (
            <>
              <div className="mt-1">
                <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{contact.name}</h3>
                <p className="text-sm text-[color:var(--text-secondary)]">{contact.email}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {/* Champion toggle */}
                <button
                  type="button"
                  onClick={() => void handleChampionToggle()}
                  className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] ${
                    contact.is_champion ? 'text-[color:var(--accent-warning)]' : 'text-[color:var(--text-secondary)]'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={contact.is_champion ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>{contact.is_champion ? 'Champion' : 'Mark Champion'}</span>
                </button>

                {/* Archive */}
                <button
                  type="button"
                  onClick={() => contact.is_archived ? void handleArchiveToggle() : setShowArchiveConfirm(true)}
                  disabled={isArchiving}
                  className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50 ${
                    contact.is_archived ? 'text-[color:var(--accent-primary)]' : 'text-[color:var(--text-secondary)]'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="5" rx="2" />
                    <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
                    <path d="M10 13h4" />
                  </svg>
                  <span>{isArchiving ? 'Updating...' : contact.is_archived ? 'Unarchive' : 'Archive'}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center"><Spinner /></div>
        ) : contact ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <DetailField label="Company" value={contact.company?.name ?? null} />
              <EditableDetailField label="Title" value={contact.title} fieldKey="title" onSave={handleFieldSave} />
              <EditableDetailField label="Role" value={contact.role} fieldKey="role" onSave={handleFieldSave} />
              <EditableDetailField label="Phone" value={contact.phone} fieldKey="phone" onSave={handleFieldSave} />
              <DetailField label="Email" value={contact.email} />
              <DetailField label="Champion" value={contact.is_champion ? 'Yes' : 'No'} />
              <EditableDetailField
                label="Last Contacted"
                value={contact.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleDateString() : null}
                fieldKey="lastContactedAt"
                onSave={handleFieldSave}
                type="date"
              />
              <DetailField label="Created" value={formatDateTime(contact.created_at)} />
            </div>

            {/* Notes */}
            <div className="mt-6 text-xs">
              <EditableDetailField
                label="Notes"
                value={contact.notes}
                fieldKey="notes"
                onSave={handleFieldSave}
                type="textarea"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[color:var(--text-secondary)]">Contact not found</p>
          </div>
        )}
      </aside>

      {/* Archive confirmation dialog */}
      <Dialog open={showArchiveConfirm} onClose={() => setShowArchiveConfirm(false)} title="Archive Contact" size="md">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Are you sure you want to archive <strong>{contact?.name}</strong>? Archived contacts are hidden from the default view.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowArchiveConfirm(false)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => { setShowArchiveConfirm(false); void handleArchiveToggle() }}>Archive</Button>
        </div>
      </Dialog>
    </>
  )
}

// ============================================================================
// DetailField (read-only)
// ============================================================================

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</label>
      <p className="text-[color:var(--foreground)]">{value || '-'}</p>
    </div>
  )
}

// ============================================================================
// EditableDetailField
// ============================================================================

function EditableDetailField({
  label,
  value,
  fieldKey,
  onSave,
  type = 'text',
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  onSave: (fieldKey: string, newValue: string) => Promise<boolean>
  type?: 'text' | 'number' | 'date' | 'textarea'
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEdit = () => {
    setEditValue(value ?? '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value ?? '')
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onSave(fieldKey, editValue)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') void handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</label>
        <div className="flex items-center gap-1">
          {type === 'textarea' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={3}
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          ) : (
            <input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
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
            onClick={handleCancel}
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
      <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">{label}</label>
      <div className="flex items-center gap-1">
        <p className="flex-1 text-[color:var(--foreground)]">{value || '-'}</p>
        <button
          type="button"
          onClick={handleStartEdit}
          className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
          aria-label={`Edit ${label}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
      </div>
    </div>
  )
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
