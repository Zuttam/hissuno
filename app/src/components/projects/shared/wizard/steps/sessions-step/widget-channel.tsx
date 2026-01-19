'use client'

import { useCallback, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  FormField,
  Input,
  Textarea,
  ToggleGroup,
  ChipInput,
  Select,
  Checkbox,
  ShortcutInput,
} from '@/components/ui'
import type {
  WidgetTrigger,
  WidgetDisplay,
  WidgetVariant,
  WidgetTheme,
} from '@/types/issue'
import { ChannelRow } from './channel-row'

const TRIGGER_OPTIONS: { value: WidgetTrigger; label: string; description?: string }[] = [
  { value: 'bubble', label: 'Bubble', description: 'Floating button' },
  { value: 'drawer-badge', label: 'Drawer Badge', description: 'Side tab' },
  { value: 'headless', label: 'Headless', description: 'Keyboard only' },
]

const DISPLAY_OPTIONS: { value: WidgetDisplay; label: string; description?: string }[] = [
  { value: 'popup', label: 'Popup', description: 'Corner modal' },
  { value: 'sidepanel', label: 'Side Panel', description: 'Full-height drawer' },
  { value: 'dialog', label: 'Dialog', description: 'Centered modal' },
]

const THEME_OPTIONS: { value: WidgetTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

export interface WidgetData {
  // New trigger/display model
  triggerType: WidgetTrigger
  displayType: WidgetDisplay
  shortcut: string
  drawerBadgeLabel: string
  // Legacy and shared settings
  variant: WidgetVariant
  theme: WidgetTheme
  title: string
  initialMessage: string
  allowedOrigins: string[]
  tokenRequired: boolean
  idleTimeoutMinutes: number
  goodbyeDelaySeconds: number
  idleResponseTimeoutSeconds: number
}

interface WidgetChannelProps {
  widget: WidgetData
  onWidgetChange: (updates: Partial<WidgetData>) => void
  defaultExpanded?: boolean
}

export function WidgetChannel({
  widget,
  onWidgetChange,
  defaultExpanded = false,
}: WidgetChannelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const handleTriggerChange = useCallback(
    (triggerType: WidgetTrigger) => {
      onWidgetChange({ triggerType })
    },
    [onWidgetChange]
  )

  const handleDisplayChange = useCallback(
    (displayType: WidgetDisplay) => {
      // Also update legacy variant for backwards compatibility
      const variant = displayType === 'dialog' ? 'sidepanel' : displayType
      onWidgetChange({ displayType, variant })
    },
    [onWidgetChange]
  )

  const handleShortcutChange = useCallback(
    (shortcut: string | null) => {
      onWidgetChange({ shortcut: shortcut ?? '' })
    },
    [onWidgetChange]
  )

  const handleDrawerBadgeLabelChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onWidgetChange({ drawerBadgeLabel: e.target.value })
    },
    [onWidgetChange]
  )

  const handleThemeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onWidgetChange({ theme: e.target.value as WidgetTheme })
    },
    [onWidgetChange]
  )

  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onWidgetChange({ title: e.target.value })
    },
    [onWidgetChange]
  )

  const handleInitialMessageChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onWidgetChange({ initialMessage: e.target.value })
    },
    [onWidgetChange]
  )

  const handleAllowedOriginsChange = useCallback(
    (origins: string[]) => {
      onWidgetChange({ allowedOrigins: origins })
    },
    [onWidgetChange]
  )

  const handleTokenRequiredChange = useCallback(
    (checked: boolean) => {
      onWidgetChange({ tokenRequired: checked })
    },
    [onWidgetChange]
  )

  const handleIdleTimeoutChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = Math.min(60, Math.max(1, parseInt(e.target.value) || 5))
      onWidgetChange({ idleTimeoutMinutes: value })
    },
    [onWidgetChange]
  )

  const handleGoodbyeDelayChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = Math.min(300, Math.max(30, parseInt(e.target.value) || 90))
      onWidgetChange({ goodbyeDelaySeconds: value })
    },
    [onWidgetChange]
  )

  const handleResponseTimeoutChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = Math.min(180, Math.max(30, parseInt(e.target.value) || 60))
      onWidgetChange({ idleResponseTimeoutSeconds: value })
    },
    [onWidgetChange]
  )

  // Show drawer label input only when trigger is drawer-badge
  const showDrawerLabel = widget.triggerType === 'drawer-badge'

  return (
    <div>
      <ChannelRow
        icon="💬"
        name="Agent Widget"
        description="Embed a customizable support widget on your website to collect customer sessions"
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      {isExpanded && (
        <div className="mt-4 pl-8 space-y-6">
          {/* Trigger & Display */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
              Trigger & Display
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Trigger" description="How the widget is activated">
                <Select
                  value={widget.triggerType}
                  onChange={(e) => handleTriggerChange(e.target.value as WidgetTrigger)}
                >
                  {TRIGGER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Display" description="How the chat appears">
                <Select
                  value={widget.displayType}
                  onChange={(e) => handleDisplayChange(e.target.value as WidgetDisplay)}
                >
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
                  value={widget.drawerBadgeLabel}
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
                value={widget.shortcut}
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
              <Select value={widget.theme} onChange={handleThemeChange}>
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Widget Title">
              <Input
                value={widget.title}
                onChange={handleTitleChange}
                placeholder="Support"
              />
            </FormField>

            <FormField label="Initial Message">
              <Textarea
                value={widget.initialMessage}
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
                values={widget.allowedOrigins}
                onChange={handleAllowedOriginsChange}
                placeholder="Add domain (e.g., example.com)"
              />
            </FormField>

            <Checkbox
              checked={widget.tokenRequired}
              onChange={handleTokenRequiredChange}
              label="Require JWT token for widget requests"
            />
          </div>

          {/* Session Lifecycle */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
              Session Lifecycle
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                label="Idle Timeout"
                description="Minutes before session ends (1-60)"
              >
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={widget.idleTimeoutMinutes}
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
                  value={widget.goodbyeDelaySeconds}
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
                  value={widget.idleResponseTimeoutSeconds}
                  onChange={handleResponseTimeoutChange}
                />
              </FormField>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
