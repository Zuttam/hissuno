'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, Input, Badge, Button, Spinner } from '@/components/ui'

interface Contact {
  id: string
  name: string
  email: string
  company?: { id: string; name: string } | null
}

interface ContactPickerDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  selectedCount: number
  onSelect: (contactId: string) => Promise<{ success: boolean; error?: string }>
}

export function ContactPickerDialog({
  open,
  onClose,
  projectId,
  selectedCount,
  onSelect,
}: ContactPickerDialogProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [submittedCount, setSubmittedCount] = useState(0)

  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search) params.set('search', search)
      const response = await fetch(`/api/projects/${projectId}/customers/contacts?${params}`)
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts ?? [])
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [projectId, search])

  useEffect(() => {
    if (open) {
      setResult(null)
      setIsSubmitting(false)
      void fetchContacts()
    }
  }, [open, fetchContacts])

  const handleSelect = async (contactId: string) => {
    setSubmittedCount(selectedCount)
    setIsSubmitting(true)
    setResult(null)
    const outcome = await onSelect(contactId)
    setResult(outcome)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Set Customer" size="xl">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Assign a contact to {selectedCount} selected feedback{selectedCount !== 1 ? 's' : ''}.
        </p>

        {result?.success && (
          <div className="rounded-[4px] border border-[color:var(--accent-success)] bg-[color:var(--accent-success)]/10 px-4 py-3 text-sm text-[color:var(--foreground)]">
            Customer set successfully for {submittedCount} feedback{submittedCount !== 1 ? 's' : ''}.
          </div>
        )}

        {result && !result.success && (
          <div className="rounded-[4px] border border-[color:var(--accent-danger)] bg-[color:var(--accent-danger)]/10 px-4 py-3 text-sm text-[color:var(--foreground)]">
            {result.error ?? 'Failed to set customer.'}
          </div>
        )}

        
        <>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts by name or email..."
            disabled={isSubmitting}
          />

          <div className="max-h-64 overflow-y-auto rounded-[4px] border border-[color:var(--border-subtle)]">
            {isLoading || isSubmitting ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[color:var(--text-secondary)]">
                No contacts found
              </div>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => void handleSelect(contact.id)}
                  disabled={isSubmitting}
                  className="flex w-full items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface-hover)] disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[color:var(--foreground)]">
                      {contact.name}
                    </div>
                    <div className="truncate text-xs text-[color:var(--text-secondary)]">
                      {contact.email}
                    </div>
                  </div>
                  {contact.company && (
                    <Badge variant="default">{contact.company.name}</Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {result?.success ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
