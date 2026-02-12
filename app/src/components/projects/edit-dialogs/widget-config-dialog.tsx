'use client'

import { useState, useCallback, useEffect, type ChangeEvent } from 'react'
import { EditDialog } from './edit-dialog'
import {
  FormField,
  Input,
  Textarea,
  Select,
  Checkbox,
  ChipInput,
  ShortcutInput,
  KeyField,
} from '@/components/ui'
import type { WidgetTrigger, WidgetDisplay, WidgetTheme } from '@/types/issue'

const TRIGGER_OPTIONS: { value: WidgetTrigger; label: string }[] = [
  { value: 'bubble', label: 'Bubble' },
  { value: 'drawer-badge', label: 'Drawer Badge' },
  { value: 'headless', label: 'Headless' },
]

const DISPLAY_OPTIONS: { value: WidgetDisplay; label: string }[] = [
  { value: 'popup', label: 'Popup' },
  { value: 'sidepanel', label: 'Side Panel' },
  { value: 'dialog', label: 'Dialog' },
]

const THEME_OPTIONS: { value: WidgetTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

interface WidgetSettings {
  widget_trigger_type: WidgetTrigger
  widget_display_type: WidgetDisplay
  widget_shortcut: string | null
  widget_drawer_badge_label: string
  widget_theme: WidgetTheme
  widget_title: string
  widget_initial_message: string
  allowed_origins: string[]
  widget_token_required: boolean
  session_idle_timeout_minutes: number
  session_goodbye_delay_seconds: number
  session_idle_response_timeout_seconds: number
}

const DEFAULT_SETTINGS: WidgetSettings = {
  widget_trigger_type: 'bubble',
  widget_display_type: 'popup',
  widget_shortcut: null,
  widget_drawer_badge_label: 'Support',
  widget_theme: 'auto',
  widget_title: 'Support',
  widget_initial_message: 'Hi! How can I help you today?',
  allowed_origins: [],
  widget_token_required: false,
  session_idle_timeout_minutes: 5,
  session_goodbye_delay_seconds: 90,
  session_idle_response_timeout_seconds: 60,
}

interface WidgetConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  secretKey?: string | null
  onSaved?: () => void
}

export function WidgetConfigDialog({
  open,
  onClose,
  projectId,
  secretKey,
  onSaved,
}: WidgetConfigDialogProps) {
  const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS)
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
        const response = await fetch(`/api/projects/${projectId}/settings/widget`)
        if (!response.ok) {
          throw new Error('Failed to load widget settings')
        }
        const data = await response.json()
        if (data.settings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data.settings,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load widget settings')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchSettings()
  }, [open, projectId])

  const handleTriggerChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setSettings((prev) => ({ ...prev, widget_trigger_type: e.target.value as WidgetTrigger }))
  }, [])

  const handleDisplayChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setSettings((prev) => ({ ...prev, widget_display_type: e.target.value as WidgetDisplay }))
  }, [])

  const handleShortcutChange = useCallback((shortcut: string | null) => {
    setSettings((prev) => ({ ...prev, widget_shortcut: shortcut }))
  }, [])

  const handleDrawerBadgeLabelChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, widget_drawer_badge_label: e.target.value }))
  }, [])

  const handleThemeChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setSettings((prev) => ({ ...prev, widget_theme: e.target.value as WidgetTheme }))
  }, [])

  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, widget_title: e.target.value }))
  }, [])

  const handleInitialMessageChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setSettings((prev) => ({ ...prev, widget_initial_message: e.target.value }))
  }, [])

  const handleAllowedOriginsChange = useCallback((origins: string[]) => {
    setSettings((prev) => ({ ...prev, allowed_origins: origins }))
  }, [])

  const handleTokenRequiredChange = useCallback((checked: boolean) => {
    setSettings((prev) => ({ ...prev, widget_token_required: checked }))
  }, [])

  const handleIdleTimeoutChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(60, Math.max(1, parseInt(e.target.value) || 5))
    setSettings((prev) => ({ ...prev, session_idle_timeout_minutes: value }))
  }, [])

  const handleGoodbyeDelayChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(300, Math.max(30, parseInt(e.target.value) || 90))
    setSettings((prev) => ({ ...prev, session_goodbye_delay_seconds: value }))
  }, [])

  const handleResponseTimeoutChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(180, Math.max(30, parseInt(e.target.value) || 60))
    setSettings((prev) => ({ ...prev, session_idle_response_timeout_seconds: value }))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      // Save widget settings
      const widgetResponse = await fetch(`/api/projects/${projectId}/settings/widget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_trigger_type: settings.widget_trigger_type,
          widget_display_type: settings.widget_display_type,
          widget_shortcut: settings.widget_shortcut,
          widget_drawer_badge_label: settings.widget_drawer_badge_label,
          widget_theme: settings.widget_theme,
          widget_title: settings.widget_title,
          widget_initial_message: settings.widget_initial_message,
          allowed_origins: settings.allowed_origins,
          widget_token_required: settings.widget_token_required,
        }),
      })

      if (!widgetResponse.ok) {
        const data = await widgetResponse.json()
        throw new Error(data.error || 'Failed to save widget settings')
      }

      // Save session lifecycle settings
      const sessionResponse = await fetch(`/api/projects/${projectId}/settings/sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_idle_timeout_minutes: settings.session_idle_timeout_minutes,
          session_goodbye_delay_seconds: settings.session_goodbye_delay_seconds,
          session_idle_response_timeout_seconds: settings.session_idle_response_timeout_seconds,
        }),
      })

      if (!sessionResponse.ok) {
        const data = await sessionResponse.json()
        throw new Error(data.error || 'Failed to save feedback settings')
      }

      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const installSnippet = `npm install @hissuno/widget

import { HissunoWidget } from '@hissuno/widget';
import '@hissuno/widget/styles.css';

<HissunoWidget
  projectId="${projectId}"
  ${secretKey ? `widgetToken="${secretKey}"` : '// widgetToken required if JWT auth enabled'}
  userId={currentUser?.id}
  userMetadata={{ name: currentUser?.name, email: currentUser?.email }}
/>`

  const showDrawerLabel = settings.widget_trigger_type === 'drawer-badge'

  return (
    <EditDialog
      open={open}
      onClose={onClose}
      onSave={handleSave}
      title="Widget Configuration"
      isSaving={isSaving}
      error={error}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--foreground)] border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Installation Snippet */}
          <div>
            <label className="block font-mono text-xs font-semibold uppercase text-[color:var(--text-secondary)] mb-2">
              Installation Snippet
            </label>
            <div className="relative">
              <pre className="overflow-x-auto rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 font-mono text-xs text-[color:var(--foreground)]">
                {installSnippet}
              </pre>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(installSnippet)}
                className="absolute top-2 right-2 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] px-2 py-1 font-mono text-[10px] uppercase text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <KeyField label="Project ID" value={projectId} compact />
            <KeyField
              label="Secret Key"
              value={secretKey ?? 'Not generated'}
              disabled={!secretKey}
              isSecret
              compact
            />
          </div>

          {/* Trigger & Display */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
              Trigger & Display
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Trigger" description="How the widget is activated">
                <Select value={settings.widget_trigger_type} onChange={handleTriggerChange}>
                  {TRIGGER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Display" description="How the chat appears">
                <Select value={settings.widget_display_type} onChange={handleDisplayChange}>
                  {DISPLAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {showDrawerLabel && (
              <FormField label="Drawer Badge Label" description="Text shown on the side tab">
                <Input
                  value={settings.widget_drawer_badge_label}
                  onChange={handleDrawerBadgeLabelChange}
                  placeholder="Support"
                />
              </FormField>
            )}

            <FormField
              label="Keyboard Shortcut"
              description="Press a key combination to set. Leave empty to disable."
            >
              <ShortcutInput
                value={settings.widget_shortcut || ''}
                onChange={handleShortcutChange}
                placeholder="None"
              />
            </FormField>
          </div>

          {/* Appearance */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
              Appearance
            </h4>

            <FormField label="Theme">
              <Select value={settings.widget_theme} onChange={handleThemeChange}>
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Widget Title">
              <Input
                value={settings.widget_title}
                onChange={handleTitleChange}
                placeholder="Support"
              />
            </FormField>

            <FormField label="Initial Message">
              <Textarea
                value={settings.widget_initial_message}
                onChange={handleInitialMessageChange}
                placeholder="Hi! How can I help you today?"
                rows={2}
              />
            </FormField>
          </div>

          {/* Integration */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
              Integration
            </h4>

            <FormField
              label="Allowed Origins"
              description="Domains where the widget can be embedded. Leave empty to allow all in development."
            >
              <ChipInput
                values={settings.allowed_origins}
                onChange={handleAllowedOriginsChange}
                placeholder="Add domain (e.g., example.com)"
              />
            </FormField>

            <Checkbox
              checked={settings.widget_token_required}
              onChange={handleTokenRequiredChange}
              label="Require JWT token for widget requests"
            />
          </div>

          {/* Lifecycle */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
              Lifecycle
            </h4>

            <FormField
              label="Idle Timeout"
              description="Minutes before conversation ends (1-60)"
            >
              <Input
                type="number"
                min={1}
                max={60}
                value={settings.session_idle_timeout_minutes}
                onChange={handleIdleTimeoutChange}
              />
            </FormField>

            <FormField
              label="Goodbye Delay"
              description="Seconds after goodbye (30-300)"
            >
              <Input
                type="number"
                min={30}
                max={300}
                value={settings.session_goodbye_delay_seconds}
                onChange={handleGoodbyeDelayChange}
              />
            </FormField>

            <FormField
              label="Response Timeout"
              description="Seconds to wait for response (30-180)"
            >
              <Input
                type="number"
                min={30}
                max={180}
                value={settings.session_idle_response_timeout_seconds}
                onChange={handleResponseTimeoutChange}
              />
            </FormField>
          </div>
        </div>
      )}
    </EditDialog>
  )
}
