'use client'

import { useCallback, useEffect } from 'react'
import { FormField, Input, Select, WizardStepHeader } from '@/components/ui'
import type { StepProps, OnboardingFormData, CompanySize } from '../types'

const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: '', label: 'Select company size' },
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
]

export function ProfileStep({ context, onValidationChange, title, description }: StepProps) {
  const { formData, setFormData } = context
  const onboardingData = formData as OnboardingFormData

  // Validate on mount and when profile data changes
  useEffect(() => {
    const isValid = onboardingData.profile?.fullName?.trim().length > 0
    onValidationChange?.(isValid)
  }, [onboardingData.profile?.fullName, onValidationChange])

  const handleFieldChange = useCallback(
    (field: keyof OnboardingFormData['profile']) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData((prev) => {
          const onboarding = prev as OnboardingFormData
          return {
            ...onboarding,
            profile: {
              ...onboarding.profile,
              [field]: e.target.value,
            },
          }
        })
      },
    [setFormData]
  )

  return (
    <div>
      <WizardStepHeader title={title} description={description} />

      <div className="flex flex-col gap-4">
        <FormField label="Full Name (required)" >
          <Input
            type="text"
            placeholder="John Doe"
            value={onboardingData.profile?.fullName ?? ''}
            onChange={handleFieldChange('fullName')}
            autoFocus
          />
        </FormField>

        <FormField label="Company Name">
          <Input
            type="text"
            placeholder="Acme Inc."
            value={onboardingData.profile?.companyName ?? ''}
            onChange={handleFieldChange('companyName')}
          />
        </FormField>

        <FormField label="Your Role">
          <Input
            type="text"
            placeholder="Product Manager, Engineer, etc."
            value={onboardingData.profile?.role ?? ''}
            onChange={handleFieldChange('role')}
          />
        </FormField>

        <FormField label="Company Size">
          <Select
            value={onboardingData.profile?.companySize ?? ''}
            onChange={handleFieldChange('companySize')}
          >
            {COMPANY_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </div>
  )
}
