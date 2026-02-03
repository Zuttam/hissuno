'use client'

import { useState, useEffect } from 'react'
import { Dialog, Button, Input, Alert, Heading } from '@/components/ui'

interface PmAgentDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  initialSettings: {
    classificationGuidelines: string
    specGuidelines: string
    autoSpecThreshold: number
  }
  onSaved: () => void
}

export function PmAgentDialog({
  open,
  onClose,
  projectId,
  initialSettings,
  onSaved,
}: PmAgentDialogProps) {
  const [classificationGuidelines, setClassificationGuidelines] = useState(
    initialSettings.classificationGuidelines
  )
  const [specGuidelines, setSpecGuidelines] = useState(initialSettings.specGuidelines)
  const [autoSpecThreshold, setAutoSpecThreshold] = useState(initialSettings.autoSpecThreshold)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setClassificationGuidelines(initialSettings.classificationGuidelines)
      setSpecGuidelines(initialSettings.specGuidelines)
      setAutoSpecThreshold(initialSettings.autoSpecThreshold)
      setError(null)
    }
  }, [open, initialSettings])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classification_guidelines: classificationGuidelines,
          spec_guidelines: specGuidelines,
          auto_spec_threshold: autoSpecThreshold,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save settings')
      }

      onSaved()
      onClose()
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="The Captain" size="lg">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="warning">{error}</Alert>}

        <p className="text-sm text-[color:var(--text-secondary)]">
          Configure how sessions are reviewed and specs are generated.
        </p>

        <div>
          <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
            Session Classification Guidelines
          </label>
          <textarea
            value={classificationGuidelines}
            onChange={(e) => setClassificationGuidelines(e.target.value)}
            placeholder="Enter guidelines for how sessions should be categorized and tagged (e.g., what constitutes a bug vs. feature request)..."
            rows={4}
            className="w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-selected)] focus:outline-none"
          />
          <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
            Instructions for how the PM agent should classify and tag customer sessions
          </p>
        </div>

        <div>
          <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
            Spec Generation Guidelines
          </label>
          <textarea
            value={specGuidelines}
            onChange={(e) => setSpecGuidelines(e.target.value)}
            placeholder="Enter guidelines for how product specs should be written (e.g., required sections, level of detail, technical depth)..."
            rows={4}
            className="w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-selected)] focus:outline-none"
          />
          <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
            Instructions for how product specifications should be formatted and what to include
          </p>
        </div>

        <div className="max-w-xs">
          <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
            Auto-Spec Threshold
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={10}
              value={autoSpecThreshold}
              onChange={(e) => setAutoSpecThreshold(parseInt(e.target.value) || 3)}
              className="w-20"
            />
            <span className="text-sm text-[color:var(--text-secondary)]">upvotes</span>
          </div>
          <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
            Number of upvotes an issue needs before a spec is automatically generated
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isSaving}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
