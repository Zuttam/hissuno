'use client'

import { useState, useCallback, useEffect, type ChangeEvent } from 'react'
import { EditDialog } from './edit-dialog'


interface TrackingToggleProps {
  trackingEnabled: boolean
  onTrackingEnabledChange: (enabled: boolean) => void
}

export function TrackingToggle({
  trackingEnabled,
  onTrackingEnabledChange,
}: TrackingToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="font-mono text-sm font-medium text-[color:var(--foreground)]">
          Issue Tracking
        </label>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          Automatically create and track issues from customer feedback
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={trackingEnabled}
        onClick={() => onTrackingEnabledChange(!trackingEnabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:ring-offset-2 ${
          trackingEnabled ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--border)]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            trackingEnabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}


interface ThresholdSettingsProps {
  specThreshold: number
  specGuidelines: string | null
  onThresholdChange: (value: number) => void
  onGuidelinesChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
}

export function ThresholdSettings({
  specThreshold,
  specGuidelines,
  onThresholdChange,
  onGuidelinesChange,
}: ThresholdSettingsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="font-mono text-sm font-medium text-[color:var(--foreground)]">
          Spec Generation Threshold
        </label>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          Generate product specs when an issue reaches this many upvotes
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={20}
            value={specThreshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[color:var(--border)]"
          />
          <span className="min-w-[2rem] text-center font-mono text-sm font-bold text-[color:var(--foreground)]">
            {specThreshold}
          </span>
        </div>
      </div>

      <div>
        <label className="font-mono text-sm font-medium text-[color:var(--foreground)]">
          Spec Guidelines
        </label>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          Custom instructions for generating product specifications
        </p>
        <textarea
          value={specGuidelines ?? ''}
          onChange={onGuidelinesChange}
          placeholder="e.g., Include acceptance criteria, user stories, technical considerations..."
          rows={4}
          className="mt-2 w-full resize-none rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-primary)] focus:outline-none"
        />
      </div>
    </div>
  )
}

export interface IssuesSettings {
  issue_tracking_enabled: boolean
  issue_spec_threshold: number
  spec_guidelines: string | null
}

interface IssuesSettingsDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onSaved?: () => void
}

export function IssuesSettingsDialog({
  open,
  onClose,
  projectId,
  onSaved,
}: IssuesSettingsDialogProps) {
  const [settings, setSettings] = useState<IssuesSettings>({
    issue_tracking_enabled: true,
    issue_spec_threshold: 5,
    spec_guidelines: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch current settings when dialog opens
  useEffect(() => {
    if (!open) return

    const fetchSettings = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/projects/${projectId}/settings/issues`)
        if (!response.ok) {
          throw new Error('Failed to load settings')
        }
        const data = await response.json()
        if (data.settings) {
          setSettings(data.settings)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchSettings()
  }, [open, projectId])

  const handleTrackingEnabledChange = useCallback((checked: boolean) => {
    setSettings((prev) => ({ ...prev, issue_tracking_enabled: checked }))
  }, [])

  const handleThresholdChange = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, issue_spec_threshold: value }))
  }, [])

  const handleGuidelinesChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.trim() || null
    setSettings((prev) => ({ ...prev, spec_guidelines: value }))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/settings/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditDialog
      open={open}
      onClose={onClose}
      onSave={handleSave}
      title="Issue Settings"
      isSaving={isSaving}
      error={error}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--foreground)] border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <TrackingToggle
            trackingEnabled={settings.issue_tracking_enabled}
            onTrackingEnabledChange={handleTrackingEnabledChange}
          />

          {settings.issue_tracking_enabled && (
            <ThresholdSettings
              specThreshold={settings.issue_spec_threshold}
              specGuidelines={settings.spec_guidelines}
              onThresholdChange={handleThresholdChange}
              onGuidelinesChange={handleGuidelinesChange}
            />
          )}
        </div>
      )}
    </EditDialog>
  )
}
