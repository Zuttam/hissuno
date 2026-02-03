'use client'

import { useCallback, useEffect, type ChangeEvent } from 'react'
import { WizardStepHeader } from '@/components/ui'
import { ProjectInfoSection } from '@/components/projects/edit-dialogs/project-details-dialog'
import type { StepProps, OnboardingFormData } from '../types'

export function ProjectStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData

  // Always valid - this step is optional/skippable
  useEffect(() => {
    onValidationChange?.(true)
  }, [onValidationChange])

  const handleNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => {
        const onboarding = prev as OnboardingFormData
        return {
          ...onboarding,
          project: {
            ...onboarding.project,
            name: e.target.value,
          },
        }
      })
    },
    [setFormData]
  )

  const handleDescriptionChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setFormData((prev) => {
        const onboarding = prev as OnboardingFormData
        return {
          ...onboarding,
          project: {
            ...onboarding.project,
            description: e.target.value,
          },
        }
      })
    },
    [setFormData]
  )

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      <ProjectInfoSection
        name={onboardingData.project.name}
        description={onboardingData.project.description}
        onNameChange={handleNameChange}
        onDescriptionChange={handleDescriptionChange}
      />
    </div>
  )
}
