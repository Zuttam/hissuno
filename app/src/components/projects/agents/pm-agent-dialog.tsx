'use client'

import { useState, useEffect } from 'react'
import { Dialog, Button, Alert } from '@/components/ui'

interface PmAgentDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  initialSettings: {
    classificationGuidelines: string
    specGuidelines: string
    analysisGuidelines: string
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
  const [analysisGuidelines, setAnalysisGuidelines] = useState(initialSettings.analysisGuidelines)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setClassificationGuidelines(initialSettings.classificationGuidelines)
      setSpecGuidelines(initialSettings.specGuidelines)
      setAnalysisGuidelines(initialSettings.analysisGuidelines)
      setError(null)
    }
  }, [open, initialSettings])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/settings/pm-agent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classification_guidelines: classificationGuidelines || null,
          spec_guidelines: specGuidelines || null,
          analysis_guidelines: analysisGuidelines || null,
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
    <Dialog open={open} onClose={onClose} title="Product Specialist" size="xl">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="warning">{error}</Alert>}

        <p className="text-sm text-[color:var(--text-secondary)]">
          Configure how sessions are reviewed, issues are analyzed, and specs are generated.
        </p>

        <div>
          <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
            Feedback Classification Guidelines
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
            Impact & Effort Guidelines
          </label>
          <textarea
            value={analysisGuidelines}
            onChange={(e) => setAnalysisGuidelines(e.target.value)}
            placeholder="Enter guidelines for how issue impact and effort should be assessed (e.g., what factors determine high impact, how to weigh customer revenue)..."
            rows={4}
            className="w-full rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-selected)] focus:outline-none"
          />
          <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
            Instructions for how the agent should score impact and estimate effort for issues
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
