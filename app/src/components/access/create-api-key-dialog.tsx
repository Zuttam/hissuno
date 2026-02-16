'use client'

import { useState } from 'react'
import { Dialog, Button, Input, Select } from '@/components/ui'
import { KeyField } from '@/components/ui/key-field'

interface CreateApiKeyDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onCreated: () => Promise<void>
}

const EXPIRY_OPTIONS = [
  { label: 'No expiry', value: '' },
  { label: '30 days', value: '30' },
  { label: '60 days', value: '60' },
  { label: '90 days', value: '90' },
  { label: '1 year', value: '365' },
]

export function CreateApiKeyDialog({ open, onClose, projectId, onCreated }: CreateApiKeyDialogProps) {
  const [name, setName] = useState('')
  const [expiryDays, setExpiryDays] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const resetState = () => {
    setName('')
    setExpiryDays('')
    setIsCreating(false)
    setError(null)
    setCreatedKey(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleCreate = async () => {
    if (!name.trim()) return

    setIsCreating(true)
    setError(null)

    try {
      const body: Record<string, string> = { name: name.trim() }
      if (expiryDays) {
        const expDate = new Date()
        expDate.setDate(expDate.getDate() + Number(expiryDays))
        body.expiresAt = expDate.toISOString()
      }

      const response = await fetch(`/api/projects/${projectId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create API key.')
      }

      const data = await response.json()
      setCreatedKey(data.fullKey)
      await onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating && name.trim() && !createdKey) {
      void handleCreate()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Create API Key">
      {createdKey ? (
        <div className="space-y-4">
          <div className="rounded-[4px] border-2 border-[color:var(--accent-warning)] bg-[color:var(--surface)] p-4">
            <p className="text-sm font-semibold text-[color:var(--accent-warning)] mb-3">
              Copy this key now. You won&apos;t be able to see it again.
            </p>
            <KeyField
              label="API Key"
              value={createdKey}
              isSecret
            />
          </div>
          <Button variant="secondary" size="md" onClick={handleClose} className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-[color:var(--text-secondary)] mb-1.5">
              Key Name
            </label>
            <Input
              type="text"
              placeholder="e.g. CI/CD Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-[color:var(--text-secondary)] mb-1.5">
              Expiry
            </label>
            <Select
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              disabled={isCreating}
            >
              {EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {error && (
            <p className="text-sm text-[color:var(--accent-danger)]">{error}</p>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={() => void handleCreate()}
            loading={isCreating}
            disabled={!name.trim()}
            className="w-full"
          >
            Create Key
          </Button>
        </div>
      )}
    </Dialog>
  )
}
