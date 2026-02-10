'use client'

import { useCallback, useEffect, useState } from 'react'
import { WizardStepHeader } from '@/components/ui'
import type { StepProps, OnboardingFormData } from '../types'

export function PersonalizeStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData

  // Local state for immediate visual feedback
  const [selected, setSelected] = useState(
    () => onboardingData.personalize?.useDemoData ?? false
  )

  // Always valid
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  const handleSelect = useCallback(
    (value: boolean) => {
      setSelected(value)
      setFormData((prev) => {
        const onboarding = prev as OnboardingFormData
        return {
          ...onboarding,
          personalize: {
            ...onboarding.personalize,
            useDemoData: value,
          },
        }
      })
    },
    [setFormData]
  )

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Demo data card */}
        <button
          type="button"
          onClick={() => handleSelect(true)}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all cursor-pointer ${
            selected
              ? 'border-[var(--accent-selected)] bg-[var(--accent-selected)]/5'
              : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
          }`}
        >
          <span className="text-3xl">🚀</span>
          <h3 className="font-mono font-semibold text-[var(--foreground)]">Try with demo data</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            We'll create a few sample conversations so you can see the agents in action right away.
          </p>
        </button>

        {/* Start from scratch card */}
        <button
          type="button"
          onClick={() => handleSelect(false)}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all cursor-pointer ${
            !selected
              ? 'border-[var(--accent-selected)] bg-[var(--accent-selected)]/5'
              : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
          }`}
        >
          <span className="text-3xl">📋</span>
          <h3 className="font-mono font-semibold text-[var(--foreground)]">Start from scratch</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Jump straight into your workspace and add real conversations manually or via integrations.
          </p>
        </button>
      </div>
    </div>
  )
}
