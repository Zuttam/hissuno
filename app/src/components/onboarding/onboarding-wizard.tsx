'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  WizardContainer,
  WizardStep,
  type WizardStepMetadata,
} from '@/components/ui'
import {
  DEFAULT_ONBOARDING_DATA,
  type OnboardingFormData,
  type OnboardingStepId,
  type StepDefinition,
  type OnboardingWizardContext,
  type CompanySize,
  type UseCaseOption,
  getStepsForFlow,
} from './steps'
import {
  trackSignupCompleted,
  trackOnboardingCompleted,
  getStoredUTM,
  getPreselectedUseCase,
  utmContentToUseCase,
  clearStoredUTM,
  clearPreselectedUseCase,
} from '@/lib/event_tracking'

export function OnboardingWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form state
  const [formData, setFormData] = useState<OnboardingFormData>(() => ({
    ...DEFAULT_ONBOARDING_DATA,
  }))
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [hasTrackedSignup, setHasTrackedSignup] = useState(false)

  // Get onboarding steps
  const steps: StepDefinition[] = useMemo(() => {
    return getStepsForFlow()
  }, [])

  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'profile' | 'project' | 'redirecting'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Track signup completion for OAuth users (signup_completed=true in URL)
  useEffect(() => {
    const signupCompleted = searchParams.get('signup_completed')
    if (signupCompleted === 'true' && !hasTrackedSignup) {
      const utm = getStoredUTM()
      // We don't have the user ID here, but PostHog will associate with the session
      trackSignupCompleted('', { method: 'google', utm: utm ?? undefined })
      setHasTrackedSignup(true)
    }
  }, [searchParams, hasTrackedSignup])

  // Load existing profile data on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/user/profile')
        const data = await response.json()

        // Get pre-selected use case from UTM or sessionStorage
        const storedUTM = getStoredUTM()
        const utmUseCase = utmContentToUseCase(storedUTM?.utm_content)
        const sessionUseCase = getPreselectedUseCase()
        const preselectedUseCase = utmUseCase || sessionUseCase

        // Merge with existing profile data
        const existingUseCases = (data.profile?.selected_use_cases as UseCaseOption[]) ?? []

        // Add pre-selected use case if not already in the list
        let mergedUseCases = existingUseCases
        if (preselectedUseCase && !existingUseCases.includes(preselectedUseCase as UseCaseOption)) {
          mergedUseCases = [preselectedUseCase as UseCaseOption, ...existingUseCases]
        }

        if (data.profile) {
          setFormData((prev) => ({
            ...prev,
            profile: {
              fullName: data.profile.full_name ?? '',
              companyName: data.profile.company_name ?? '',
              role: data.profile.role ?? '',
              companySize: (data.profile.company_size as CompanySize) ?? '',
            },
            useCase: {
              selectedUseCases: mergedUseCases,
            },
          }))

          // Restore saved step (only if not returning from checkout)
          const savedStepId = data.profile.onboarding_current_step as OnboardingStepId | null
          const isCheckoutReturn = searchParams.get('checkout') === 'success'
          if (savedStepId && !isCheckoutReturn) {
            const stepsForFlow = getStepsForFlow()
            const savedIndex = stepsForFlow.findIndex((s) => s.id === savedStepId)
            if (savedIndex >= 0) {
              setCurrentStepIndex(savedIndex)
            }
          } else if (isCheckoutReturn) {
            // Go to billing step on checkout return
            const stepsForFlow = getStepsForFlow()
            const billingIndex = stepsForFlow.findIndex((s) => s.id === 'billing')
            if (billingIndex >= 0) {
              setCurrentStepIndex(billingIndex)
            }
          }
        } else if (preselectedUseCase) {
          // No existing profile, but we have a pre-selected use case
          setFormData((prev) => ({
            ...prev,
            useCase: {
              selectedUseCases: [preselectedUseCase as UseCaseOption],
            },
          }))
        }
      } catch (err) {
        console.error('[onboarding] Failed to load profile:', err)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    void loadProfile()
  }, [])

  // Build wizard context
  const context: OnboardingWizardContext = useMemo(
    () => ({
      formData,
      setFormData,
    }),
    [formData]
  )

  // Save profile data (called on navigation)
  const saveProfile = useCallback(async (nextStepId?: string) => {
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.profile.fullName,
          companyName: formData.profile.companyName,
          role: formData.profile.role,
          companySize: formData.profile.companySize || null,
          selectedUseCases: formData.useCase?.selectedUseCases ?? [],
          onboardingCurrentStep: nextStepId ?? steps[currentStepIndex]?.id ?? null,
          // Don't mark as completed - that happens on final submit
        }),
      })
    } catch (err) {
      console.error('[onboarding] Failed to save profile:', err)
    }
  }, [formData.profile, formData.useCase?.selectedUseCases, steps, currentStepIndex])

  // Navigation handlers
  const handleNext = useCallback(async () => {
    const currentStep = steps[currentStepIndex]
    const validation = currentStep.validate(formData)

    if (!validation.isValid) {
      setError(validation.error ?? 'Please fix errors before proceeding')
      return
    }

    setError(null)

    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1
      const nextStepId = steps[nextIndex]?.id
      // Save profile data on each step transition, persisting the next step
      void saveProfile(nextStepId)
      setCurrentStepIndex(nextIndex)
    }
  }, [currentStepIndex, steps, formData, saveProfile])

  const handlePrevious = useCallback(() => {
    setError(null)
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
    }
  }, [currentStepIndex])

  const handleStepClick = useCallback((stepNumber: number) => {
    setError(null)
    const targetIndex = stepNumber - 1
    if (targetIndex >= 0 && targetIndex < steps.length) {
      setCurrentStepIndex(targetIndex)
    }
  }, [steps.length])

  const handleSubmit = useCallback(async () => {
    // Validate all required steps
    for (const step of steps) {
      if (!step.isOptional) {
        const validation = step.validate(formData)
        if (!validation.isValid) {
          setError(`${step.title}: ${validation.error}`)
          return
        }
      }
    }

    setIsSubmitting(true)
    setPhase('profile')
    setError(null)

    try {
      // 1. Save profile with use cases, clear current step
      const profileResponse = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.profile.fullName,
          companyName: formData.profile.companyName,
          role: formData.profile.role,
          companySize: formData.profile.companySize || null,
          selectedUseCases: formData.useCase?.selectedUseCases ?? [],
          onboardingCompleted: true,
          onboardingCurrentStep: null,
        }),
      })

      if (!profileResponse.ok) {
        throw new Error('Failed to save profile')
      }

      // 2. Track onboarding completion
      const utm = getStoredUTM()
      trackOnboardingCompleted({
        selectedUseCases: formData.useCase?.selectedUseCases ?? [],
        utm: utm ?? undefined,
      })

      // 3. Clear stored UTM and pre-selection after successful onboarding
      clearStoredUTM()
      clearPreselectedUseCase()

      // 4. Create project if name was provided
      const projectName = formData.project?.name?.trim()
      if (projectName) {
        setPhase('project')
        try {
          const projectFormData = new FormData()
          projectFormData.append('name', projectName)
          if (formData.project.description?.trim()) {
            projectFormData.append('description', formData.project.description.trim())
          }

          const projectResponse = await fetch('/api/projects', {
            method: 'POST',
            body: projectFormData,
          })

          if (projectResponse.ok) {
            const projectData = await projectResponse.json()
            setPhase('redirecting')
            router.push(`/projects/${projectData.project.id}/dashboard`)
            return
          }
        } catch (err) {
          console.error('[onboarding] Failed to create project:', err)
          // Fall through to /projects/new
        }
      }

      // 5. Redirect to project creation if no project was created
      setPhase('redirecting')
      router.push('/projects/new')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete onboarding'
      setError(message)
      setIsSubmitting(false)
      setPhase('idle')
    }
  }, [formData, steps, router])

  // Convert to wizard step metadata format
  const wizardSteps: WizardStepMetadata[] = useMemo(
    () =>
      steps.map((step, idx) => ({
        id: step.id,
        title: step.shortTitle ?? step.title,
        number: idx + 1,
      })),
    [steps]
  )

  // Get button labels
  const submitLabel = 'Get Started'
  const submittingLabel =
    phase === 'profile'
      ? 'Saving profile...'
      : phase === 'project'
        ? 'Creating campaign...'
        : 'Redirecting...'

  // Show loading skeleton while fetching profile
  if (isLoadingProfile) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-6 py-8">
        <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-64 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-4 pt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <WizardContainer
        currentStep={currentStepIndex + 1}
        steps={wizardSteps}
        mode="onboarding"
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSubmit={handleSubmit}
        onStepClick={handleStepClick}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
        submittingLabel={submittingLabel}
        validationError={error ?? undefined}
      >
        {steps.map((step, idx) => (
          <WizardStep
            key={step.id}
            stepNumber={idx + 1}
            currentStep={currentStepIndex + 1}
          >
            <step.component
              context={context}
              title={step.title}
              description={step.description}
              {...(step.id === 'billing' ? { onCheckoutComplete: handleNext } : {})}
            />
          </WizardStep>
        ))}
      </WizardContainer>
    </form>
  )
}
