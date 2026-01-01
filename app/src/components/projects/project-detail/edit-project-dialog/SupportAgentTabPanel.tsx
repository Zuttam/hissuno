'use client'

import { ChangeEvent } from 'react'
import { FormField, ChipInput, SectionHeader, ToggleGroup, Select, Input, Textarea } from '@/components/ui'
import type { WidgetVariant, WidgetTheme, WidgetPosition } from '@/types/issue'

export interface WidgetSettings {
  widget_variant: WidgetVariant
  widget_theme: WidgetTheme
  widget_position: WidgetPosition
  widget_title: string
  widget_initial_message: string
  // Session lifecycle settings
  session_idle_timeout_minutes: number
  session_goodbye_delay_seconds: number
  session_idle_response_timeout_seconds: number
}

interface SupportAgentTabPanelProps {
  allowedOrigins: string[]
  setAllowedOrigins: (origins: string[]) => void
  widgetSettings: WidgetSettings
  setWidgetSettings: (settings: WidgetSettings) => void
  isLoadingSettings?: boolean
}

export function SupportAgentTabPanel({
  allowedOrigins,
  setAllowedOrigins,
  widgetSettings,
  setWidgetSettings,
  isLoadingSettings = false,
}: SupportAgentTabPanelProps) {
  const validateOrigin = (value: string): true | string => {
    // Basic URL/origin validation
    if (value === '*') return true
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`)
      if (!url.origin) return 'Invalid origin'
      return true
    } catch {
      // Allow localhost patterns
      if (value.match(/^(localhost|127\.0\.0\.1)(:\d+)?$/)) return true
      return 'Invalid origin format'
    }
  }

  const updateSetting = <K extends keyof WidgetSettings>(key: K, value: WidgetSettings[K]) => {
    setWidgetSettings({ ...widgetSettings, [key]: value })
  }

  const handleSelectChange = <K extends keyof WidgetSettings>(key: K) => (e: ChangeEvent<HTMLSelectElement>) => {
    updateSetting(key, e.target.value as WidgetSettings[K])
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Widget Integration" />

      <FormField
        label="Allowed Origins"
        description="Domains where the support widget is allowed to run. Leave empty to allow all origins (development mode)."
      >
        <ChipInput
          values={allowedOrigins}
          onChange={setAllowedOrigins}
          placeholder="e.g., https://example.com"
          validateFn={validateOrigin}
        />
      </FormField>

      <SectionHeader title="Widget Appearance" description="Default appearance settings for the widget. Developers can override these with props." />

      <FormField
        label="Display Variant"
        description="Choose how the chat window appears when opened."
      >
        <ToggleGroup
          value={widgetSettings.widget_variant}
          onChange={(value) => updateSetting('widget_variant', value as WidgetVariant)}
          options={[
            { value: 'popup', label: 'Popup' },
            { value: 'sidepanel', label: 'Sidepanel' },
          ]}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Theme"
          description="Color theme for the widget."
        >
          <Select
            value={widgetSettings.widget_theme}
            onChange={handleSelectChange('widget_theme')}
            disabled={isLoadingSettings}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto (System)</option>
          </Select>
        </FormField>

        <FormField
          label="Position"
          description="Where the bubble appears on the page."
        >
          <Select
            value={widgetSettings.widget_position}
            onChange={handleSelectChange('widget_position')}
            disabled={isLoadingSettings}
          >
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
          </Select>
        </FormField>
      </div>

      <FormField
        label="Title"
        description="Header text shown in the chat window."
      >
        <Input
          value={widgetSettings.widget_title}
          onChange={(e) => updateSetting('widget_title', e.target.value)}
          placeholder="Support"
          disabled={isLoadingSettings}
        />
      </FormField>

      <FormField
        label="Initial Message"
        description="The first message shown when the chat opens."
      >
        <Textarea
          value={widgetSettings.widget_initial_message}
          onChange={(e) => updateSetting('widget_initial_message', e.target.value)}
          placeholder="Hi! How can I help you today?"
          rows={2}
          disabled={isLoadingSettings}
        />
      </FormField>

      <SectionHeader
        title="Session Lifecycle"
        description="Configure automatic session handling behaviors."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          label="Idle Timeout"
          description="Minutes of inactivity before asking if user is still there."
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={60}
              value={widgetSettings.session_idle_timeout_minutes}
              onChange={(e) => updateSetting('session_idle_timeout_minutes', parseInt(e.target.value) || 5)}
              disabled={isLoadingSettings}
              className="w-20"
            />
            <span className="text-sm text-[color:var(--text-secondary)]">min</span>
          </div>
        </FormField>

        <FormField
          label="Goodbye Delay"
          description="Seconds to keep session open after goodbye."
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={30}
              max={300}
              value={widgetSettings.session_goodbye_delay_seconds}
              onChange={(e) => updateSetting('session_goodbye_delay_seconds', parseInt(e.target.value) || 90)}
              disabled={isLoadingSettings}
              className="w-20"
            />
            <span className="text-sm text-[color:var(--text-secondary)]">sec</span>
          </div>
        </FormField>

        <FormField
          label="Response Timeout"
          description="Seconds to wait after idle prompt before auto-close."
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={30}
              max={180}
              value={widgetSettings.session_idle_response_timeout_seconds}
              onChange={(e) => updateSetting('session_idle_response_timeout_seconds', parseInt(e.target.value) || 60)}
              disabled={isLoadingSettings}
              className="w-20"
            />
            <span className="text-sm text-[color:var(--text-secondary)]">sec</span>
          </div>
        </FormField>
      </div>
    </div>
  )
}
