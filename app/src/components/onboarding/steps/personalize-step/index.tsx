'use client'

import { useCallback, useEffect } from 'react'
import { WizardStepHeader } from '@/components/ui'
import type { StepProps, OnboardingFormData } from '../types'

export function PersonalizeStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData
  const useDemoData = onboardingData.personalize?.useDemoData ?? false

  // Always valid
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  const handleSelect = useCallback(
    (value: boolean) => {
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
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleSelect(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleSelect(true)
            }
          }}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all cursor-pointer ${
            useDemoData
              ? 'border-[--accent-selected] bg-[--accent-selected]/5'
              : 'border-[--border-subtle] hover:border-[--accent-primary]'
          }`}
        >
          <span className="text-3xl">🚀</span>
          <h3 className="font-mono font-semibold text-[--foreground]">Try with demo data</h3>
          <p className="text-sm text-[--text-secondary]">
            We'll create a few sample conversations so you can see the agents in action right away.
          </p>
        </div>

        {/* Start from scratch card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleSelect(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleSelect(false)
            }
          }}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all cursor-pointer ${
            !useDemoData
              ? 'border-[--accent-selected] bg-[--accent-selected]/5'
              : 'border-[--border-subtle] hover:border-[--accent-primary]'
          }`}
        >
          <span className="text-3xl">📋</span>
          <h3 className="font-mono font-semibold text-[--foreground]">Start from scratch</h3>
          <p className="text-sm text-[--text-secondary]">
            Jump straight into your workspace and add real conversations manually or via integrations.
          </p>
        </div>
      </div>
    </div>
  )
}
