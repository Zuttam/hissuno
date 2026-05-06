'use client'

import { useState, useCallback, useEffect, type ChangeEvent } from 'react'
import {
  Dialog,
  Button,
  InlineAlert,
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
import { fetchWidgetSettings, updateWidgetSettings } from '@/lib/api/widget'

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
  trigger_type: WidgetTrigger
  display_type: WidgetDisplay
  shortcut: string | null
  drawer_badge_label: string
  theme: WidgetTheme
  title: string
  initial_message: string
  allowed_origins: string[]
  token_required: boolean
}

const DEFAULT_SETTINGS: WidgetSettings = {
  trigger_type: 'bubble',
  display_type: 'popup',
  shortcut: null,
  drawer_badge_label: 'Support',
  theme: 'auto',
  title: 'Support',
  initial_message: 'Hi! How can I help you today?',
  allowed_origins: [],
  token_required: false,
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
  const [isFirstSetup, setIsFirstSetup] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch current settings when dialog opens
  useEffect(() => {
    if (!open) return

    setSuccessMessage(null)

    const fetchSettings = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchWidgetSettings<{ settings?: Partial<WidgetSettings> }>(projectId)
        if (data.settings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data.settings,
          })
          setIsFirstSetup(!data.settings.allowed_origins?.length)
        } else {
          setIsFirstSetup(true)
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
    setSettings((prev) => ({ ...prev, trigger_type: e.target.value as WidgetTrigger }))
  }, [])

  const handleDisplayChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setSettings((prev) => ({ ...prev, display_type: e.target.value as WidgetDisplay }))
  }, [])

  const handleShortcutChange = useCallback((shortcut: string | null) => {
    setSettings((prev) => ({ ...prev, shortcut }))
  }, [])

  const handleDrawerBadgeLabelChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, drawer_badge_label: e.target.value }))
  }, [])

  const handleThemeChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setSettings((prev) => ({ ...prev, theme: e.target.value as WidgetTheme }))
  }, [])

  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, title: e.target.value }))
  }, [])

  const handleInitialMessageChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setSettings((prev) => ({ ...prev, initial_message: e.target.value }))
  }, [])

  const handleAllowedOriginsChange = useCallback((origins: string[]) => {
    setSettings((prev) => ({ ...prev, allowed_origins: origins }))
  }, [])

  const handleTokenRequiredChange = useCallback((checked: boolean) => {
    setSettings((prev) => ({ ...prev, token_required: checked }))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      // Save widget settings
      await updateWidgetSettings(projectId, {
        trigger_type: settings.trigger_type,
        display_type: settings.display_type,
        shortcut: settings.shortcut,
        drawer_badge_label: settings.drawer_badge_label,
        theme: settings.theme,
        title: settings.title,
        initial_message: settings.initial_message,
        allowed_origins: settings.allowed_origins,
        token_required: settings.token_required,
      })

      onSaved?.()
      setSuccessMessage('Settings saved successfully.')
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
  apiUrl="${typeof window !== 'undefined' ? window.location.origin : ''}/api/integrations/widget/chat"
  ${secretKey ? `widgetToken="${secretKey}"` : '// widgetToken required if JWT auth enabled'}
  userId={currentUser?.id}
  userMetadata={{ name: currentUser?.name, email: currentUser?.email }}
/>`

  const showDrawerLabel = settings.trigger_type === 'drawer-badge'

  return (
    <Dialog open={open} onClose={onClose} title="Widget Configuration" size="lg">
      <div className="flex flex-col gap-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--foreground)] border-t-transparent" />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex flex-col gap-6">
              {isFirstSetup && (
                <InlineAlert variant="info">
                  <strong>Setup required</strong> - Add at least one allowed origin below to enable the widget on your site.
                </InlineAlert>
              )}

              {/* Integration - first so origins aren't missed */}
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
                  Integration
                </h4>

                <FormField
                  label="Allowed Origins"
                  description="Domains where the widget can be embedded (e.g., example.com, *.example.com). Required - the widget won't load without at least one origin. Use * to allow all origins."
                >
                  <ChipInput
                    values={settings.allowed_origins}
                    onChange={handleAllowedOriginsChange}
                    placeholder="Add domain (e.g., example.com)"
                  />
                </FormField>

                <Checkbox
                  checked={settings.token_required}
                  onChange={handleTokenRequiredChange}
                  label="Require JWT token for widget requests"
                />
              </div>

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
                  labelTooltip="Used to sign JWT tokens that verify end-user identity in the widget. Your backend signs tokens with this key, and the widget sends them to authenticate users. This is not an API key — for programmatic API access, use project API keys in the Access tab."
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
                    <Select value={settings.trigger_type} onChange={handleTriggerChange}>
                      {TRIGGER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Display" description="How the chat appears">
                    <Select value={settings.display_type} onChange={handleDisplayChange}>
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
                      value={settings.drawer_badge_label}
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
                    value={settings.shortcut || ''}
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
                  <Select value={settings.theme} onChange={handleThemeChange}>
                    {THEME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Widget Title">
                  <Input
                    value={settings.title}
                    onChange={handleTitleChange}
                    placeholder="Support"
                  />
                </FormField>

                <FormField label="Initial Message">
                  <Textarea
                    value={settings.initial_message}
                    onChange={handleInitialMessageChange}
                    placeholder="Hi! How can I help you today?"
                    rows={2}
                  />
                </FormField>
              </div>


            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isSaving}>
            {isFirstSetup ? 'Complete Setup' : 'Save'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
