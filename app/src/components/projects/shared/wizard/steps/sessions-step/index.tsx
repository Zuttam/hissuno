'use client'

import { useCallback, useEffect } from 'react'
import { WizardStepHeader } from '@/components/ui'
import type { StepProps } from '../types'
import type { WidgetVariant, WidgetTheme, WidgetPosition } from '@/types/issue'
import { WidgetChannel } from './widget-channel'
import { SlackChannel } from './slack-channel'
import { GongChannel } from './gong-channel'
import { IntercomChannel } from './intercom-channel'

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

export function SessionsStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData, integrations, mode } = context

  // Sessions step is always valid (optional)
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  const handleWidgetChange = useCallback(
    (updates: Partial<WidgetData>) => {
      setFormData((prev) => ({
        ...prev,
        widget: { ...prev.widget, ...updates },
      }))
    },
    [setFormData]
  )

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      {/* Hissuno Native Agents */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-[color:var(--text-secondary)] uppercase tracking-wide mb-2">
          Hissuno Native Agents
        </h3>
        <div className="flex flex-col">
          <WidgetChannel
            widget={formData.widget}
            onWidgetChange={handleWidgetChange}
          />

          <div className="border-b border-[color:var(--border-subtle)] w-full" />

          <SlackChannel
            integration={{
              isConnected: integrations.slack.isConnected,
              isConnecting: integrations.slack.isConnecting,
              workspaceName: integrations.slack.workspaceName,
              onConnect: integrations.slack.onConnect,
              onDisconnect: integrations.slack.onDisconnect,
            }}
          />
        </div>
      </div>

      {/* Integrations */}
      <div>
        <h3 className="text-xs font-medium text-[color:var(--text-secondary)] uppercase tracking-wide mb-2">
          Integrations
        </h3>
        <div className="flex flex-col">
          <GongChannel />

          <div className="border-b border-[color:var(--border-subtle)] w-full" />

          <IntercomChannel />
        </div>
      </div>
    </div>
  )
}
