'use client'

import { FormField, Spinner, Textarea } from '@/components/ui'

export type ProjectSettings = {
  issue_tracking_enabled: boolean
  issue_spec_threshold: number
  spec_guidelines: string | null
}

interface PmAgentTabPanelProps {
  settings: ProjectSettings
  setSettings: (settings: ProjectSettings) => void
  isLoadingSettings: boolean
}

export function PmAgentTabPanel({
  settings,
  setSettings,
  isLoadingSettings,
}: PmAgentTabPanelProps) {
  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <FormField label="Issue Tracking">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.issue_tracking_enabled}
            onChange={(e) => setSettings({ ...settings, issue_tracking_enabled: e.target.checked })}
            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-mono text-sm text-slate-700 dark:text-slate-200">
            Enable automatic issue tracking from customer conversations (sessions)
          </span>
        </label>
      </FormField>

      <FormField
        label="Spec Generation Threshold"
        description="Number of upvotes required before generating a spec for an issue"
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="20"
            value={settings.issue_spec_threshold}
            onChange={(e) => setSettings({ ...settings, issue_spec_threshold: parseInt(e.target.value) })}
            className="flex-1"
          />
          <span className="w-12 text-center font-mono text-sm text-slate-700 dark:text-slate-200">
            {settings.issue_spec_threshold}
          </span>
        </div>
      </FormField>

      <FormField
        label="Spec Guidelines"
        description="Custom guidelines for the AI when generating issue specifications"
      >
        <Textarea
          value={settings.spec_guidelines ?? ''}
          onChange={(e) => setSettings({ ...settings, spec_guidelines: e.target.value || null })}
          rows={4}
          placeholder="E.g., Focus on user stories and acceptance criteria..."
        />
      </FormField>
    </div>
  )
}
