'use client'

import { useState } from 'react'
import { Dialog, Button, Input } from '@/components/ui'

interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onAdded: () => Promise<void>
}

export function AddMemberDialog({ open, onClose, projectId, onAdded }: AddMemberDialogProps) {
  const [email, setEmail] = useState('')
  const [lookupResult, setLookupResult] = useState<{ exists: boolean } | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setEmail('')
    setLookupResult(null)
    setIsLookingUp(false)
    setIsAdding(false)
    setError(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleLookup = async () => {
    if (!email.trim()) return

    setIsLookingUp(true)
    setError(null)
    setLookupResult(null)

    try {
      const response = await fetch(`/api/users/lookup?email=${encodeURIComponent(email.trim())}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Lookup failed.')
      }
      const data = await response.json()
      setLookupResult({ exists: data.exists })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.')
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleAdd = async () => {
    if (!email.trim()) return

    setIsAdding(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role: 'member' }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to add member.')
      }

      resetState()
      await onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLookingUp && email.trim()) {
      if (!lookupResult) {
        void handleLookup()
      } else {
        void handleAdd()
      }
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Add Member">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-[color:var(--text-secondary)] mb-1.5">
            Email Address
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setLookupResult(null)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              disabled={isAdding}
            />
            {!lookupResult && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => void handleLookup()}
                loading={isLookingUp}
                disabled={!email.trim()}
              >
                Look up
              </Button>
            )}
          </div>
        </div>

        {lookupResult && (
          <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] p-4">
            {lookupResult.exists ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-[color:var(--text-secondary)]" />
                  <span className="text-sm text-[color:var(--foreground)]">
                    User found on Hissuno
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleAdd()}
                  loading={isAdding}
                  className="w-full"
                >
                  Add to Project
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MailIcon className="h-4 w-4 text-[color:var(--text-secondary)]" />
                  <span className="text-sm text-[color:var(--foreground)]">
                    User not on Hissuno
                  </span>
                </div>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  An invite code will be used to invite them to sign up and join this project.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleAdd()}
                  loading={isAdding}
                  className="w-full"
                >
                  Invite &amp; Add to Project
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-[color:var(--accent-danger)]">{error}</p>
        )}
      </div>
    </Dialog>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  )
}
