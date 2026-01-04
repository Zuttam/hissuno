'use client'

import { useCallback, useEffect } from 'react'
import { Checkbox, WizardStepHeader } from '@/components/ui'
import type { StepProps, OnboardingFormData, UseCaseOption } from '../types'
import { USE_CASE_OPTIONS } from '../types'

export function UseCaseStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData
  const selectedUseCases = onboardingData.useCase?.selectedUseCases ?? []

  // This step is always valid (optional selection)
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  const handleToggleUseCase = useCallback(
    (useCaseId: UseCaseOption) => {
      setFormData((prev) => {
        const onboarding = prev as OnboardingFormData
        const current = onboarding.useCase?.selectedUseCases ?? []
        const isSelected = current.includes(useCaseId)

        const newSelection = isSelected
          ? current.filter((id) => id !== useCaseId)
          : [...current, useCaseId]

        return {
          ...onboarding,
          useCase: {
            ...onboarding.useCase,
            selectedUseCases: newSelection,
          },
        }
      })
    },
    [setFormData]
  )

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      <div className="grid gap-4">
        {USE_CASE_OPTIONS.map((option) => {
          const isSelected = selectedUseCases.includes(option.id)
          return (
            <div
              key={option.id}
              role="button"
              tabIndex={0}
              onClick={() => handleToggleUseCase(option.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleToggleUseCase(option.id)
                }
              }}
              className={`flex items-start gap-4 rounded-lg border-2 p-4 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[--accent-selected] bg-[--accent-selected]/5'
                  : 'border-[--border-subtle] hover:border-[--accent-primary]'
              }`}
            >
              <Checkbox
                checked={isSelected}
                className="mt-0.5 pointer-events-none"
              />

              {/* Content */}
              <div className="flex-1">
                <h3 className="font-mono font-semibold text-[--foreground]">
                  {option.label}
                </h3>
                <p className="mt-1 text-sm text-[--text-secondary]">
                  {option.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
