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
} from '@/components/ui'
import type { WidgetVariant, WidgetTheme, WidgetPosition } from '@/types/issue'
import { ChannelRow } from './channel-row'

const POSITION_OPTIONS: { value: WidgetPosition; label: string }[] = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
]

const THEME_OPTIONS: { value: WidgetTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

interface WidgetData {
  variant: WidgetVariant
  theme: WidgetTheme
  position: WidgetPosition
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

  const handleVariantChange = useCallback(
    (variant: WidgetVariant) => {
      onWidgetChange({ variant })
    },
    [onWidgetChange]
  )

  const handleThemeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onWidgetChange({ theme: e.target.value as WidgetTheme })
    },
    [onWidgetChange]
  )

  const handlePositionChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onWidgetChange({ position: e.target.value as WidgetPosition })
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
          {/* Appearance */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[color:var(--text-secondary)] uppercase tracking-wide">
              Appearance
            </h4>

            <FormField label="Display Variant">
              <ToggleGroup
                value={widget.variant}
                options={[
                  { value: 'popup', label: 'Popup' },
                  { value: 'sidepanel', label: 'Side Panel' },
                ]}
                onChange={handleVariantChange}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Theme">
                <Select value={widget.theme} onChange={handleThemeChange}>
                  {THEME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Position">
                <Select value={widget.position} onChange={handlePositionChange}>
                  {POSITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

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
