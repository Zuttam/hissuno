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
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setEmail('')
    setIsAdding(false)
    setError(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleInvite = async () => {
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
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to invite member.')
      }

      resetState()
      await onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isAdding && email.trim()) {
      void handleInvite()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Invite Member" size="lg">
      <div className="flex flex-col gap-4">
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
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              disabled={isAdding}
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleInvite()}
              loading={isAdding}
              disabled={!email.trim()}
            >
              Invite
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-[color:var(--accent-danger)]">{error}</p>
        )}
      </div>
    </Dialog>
  )
}
