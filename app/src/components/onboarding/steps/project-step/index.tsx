'use client'

import { useCallback, useEffect, type ChangeEvent } from 'react'
import { FormField, Textarea, WizardStepHeader } from '@/components/ui'
import { ProjectInfoSection } from '@/components/projects/edit-dialogs/project-details-dialog'
import type { StepProps, OnboardingFormData } from '../types'

export function ProjectStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData
  const projectMode = onboardingData.project?.projectMode ?? 'demo'

  // Validate: demo is always valid, blank requires project name
  useEffect(() => {
    if (projectMode === 'demo') {
      onValidationChange?.(true)
    } else {
      const isValid = (onboardingData.project?.name?.trim().length ?? 0) > 0
      onValidationChange?.(isValid)
    }
  }, [projectMode, onboardingData.project?.name, onValidationChange])

  const handleModeSelect = useCallback(
    (mode: 'demo' | 'blank') => {
      setFormData((prev) => {
        const onboarding = prev as OnboardingFormData
        return {
          ...onboarding,
          project: {
            ...onboarding.project,
            projectMode: mode,
          },
        }
      })
    },
    [setFormData]
  )

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

      {/* Mode choice cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleModeSelect('demo')}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all cursor-pointer ${
            projectMode === 'demo'
              ? 'border-[var(--accent-selected)] bg-[var(--accent-selected)]/5'
              : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
          }`}
        >
          <span className="text-3xl">&#x1F680;</span>
          <h3 className="font-mono font-semibold text-[var(--foreground)]">Demo Project</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Get a pre-built project with sample conversations, issues, and customers so you can explore right away.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleModeSelect('blank')}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all cursor-pointer ${
            projectMode === 'blank'
              ? 'border-[var(--accent-selected)] bg-[var(--accent-selected)]/5'
              : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
          }`}
        >
          <span className="text-3xl">&#x1F4CB;</span>
          <h3 className="font-mono font-semibold text-[var(--foreground)]">Blank Project</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Start fresh with your own project. Add real conversations manually or via integrations.
          </p>
        </button>
      </div>

      {/* Blank project form */}
      {projectMode === 'blank' && (
        <div className="mt-6 space-y-4">
          <ProjectInfoSection
            name={onboardingData.project.name}
            description={onboardingData.project.description}
            onNameChange={handleNameChange}
            onDescriptionChange={handleDescriptionChange}
          />

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
      )}
    </div>
  )
}
