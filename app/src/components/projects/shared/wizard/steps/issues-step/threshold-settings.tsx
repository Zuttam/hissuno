'use client'

import type { ChangeEvent } from 'react'
import { FormField, Textarea, Slider } from '@/components/ui'

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

      <FormField
        label="Threshold"
        description="Number of upvotes required before generating a product specification."
      >
        <Slider
          min={1}
          max={20}
          value={specThreshold}
          onChange={onThresholdChange}
          minLabel="1 (immediate)"
          maxLabel="20 (high demand)"
          valueFormatter={(v) => `${v} upvotes`}
        />
      </FormField>

      <FormField
        label="Guidelines"
        description="Optional guidelines for the AI when generating product specifications."
      >
        <Textarea
          value={specGuidelines || ''}
          onChange={onGuidelinesChange}
          placeholder="e.g., Focus on user stories, include acceptance criteria, consider technical constraints..."
          rows={4}
        />
      </FormField>
    </div>
  )
}
