'use client'

import { useCallback, useEffect, type ChangeEvent } from 'react'
import { FormField, Textarea, WizardStepHeader } from '@/components/ui'
import { ProjectInfoSection } from '@/components/projects/edit-dialogs/project-details-dialog'
import type { StepProps, OnboardingFormData } from '../types'

export function ProjectStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData

  // Validate: project name is required
  useEffect(() => {
    const isValid = (onboardingData.project?.name?.trim().length ?? 0) > 0
    onValidationChange?.(isValid)
  }, [onboardingData.project?.name, onValidationChange])

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

  const handleAdditionalDetailsChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setFormData((prev) => {
        const onboarding = prev as OnboardingFormData
        return {
          ...onboarding,
          project: {
            ...onboarding.project,
            additionalDetails: e.target.value,
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

      <div className="mt-4">
        <FormField
          label="Additional Context (optional)"
          description="Paste any product docs, feature descriptions, or context that will help Hissuno understand your product better. This will be saved as a knowledge source."
        >
          <Textarea
            placeholder="e.g. Our product is a B2B SaaS platform for managing customer relationships..."
            value={onboardingData.project.additionalDetails ?? ''}
            onChange={handleAdditionalDetailsChange}
            rows={4}
          />
        </FormField>
      </div>
    </div>
  )
}
