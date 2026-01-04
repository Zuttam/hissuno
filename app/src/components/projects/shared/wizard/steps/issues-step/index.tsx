'use client'

import { useCallback, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import { WizardStepHeader } from '@/components/ui'
import type { StepProps } from '../types'
import { TrackingToggle } from './tracking-toggle'
import { ThresholdSettings } from './threshold-settings'
import { IntegrationsSection } from './integrations-section'

export function IssuesStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context

  // Issues step is always valid (optional)
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  const handleTrackingEnabledChange = useCallback(
    (checked: boolean) => {
      setFormData((prev) => ({
        ...prev,
        issues: { ...prev.issues, trackingEnabled: checked },
      }))
    },
    [setFormData]
  )

  const handleThresholdChange = useCallback(
    (value: number) => {
      setFormData((prev) => ({
        ...prev,
        issues: { ...prev.issues, specThreshold: value },
      }))
    },
    [setFormData]
  )

  const handleGuidelinesChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value.trim() || null
      setFormData((prev) => ({
        ...prev,
        issues: { ...prev.issues, specGuidelines: value },
      }))
    },
    [setFormData]
  )

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      <div className="flex flex-col gap-4">
        {/* Issue Tracking Section */}
        <TrackingToggle
          trackingEnabled={formData.issues.trackingEnabled}
          onTrackingEnabledChange={handleTrackingEnabledChange}
        />

        {/* Spec Generation Section */}
        {formData.issues.trackingEnabled && (
          <ThresholdSettings
            specThreshold={formData.issues.specThreshold}
            specGuidelines={formData.issues.specGuidelines}
            onThresholdChange={handleThresholdChange}
            onGuidelinesChange={handleGuidelinesChange}
          />
        )}

        {/* Integrations Section */}
        <IntegrationsSection />
      </div>
    </div>
  )
}
