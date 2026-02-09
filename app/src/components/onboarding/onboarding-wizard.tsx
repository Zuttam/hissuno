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
  STEP_REVEAL_MESSAGES,
  type OnboardingFormData,
  type OnboardingStepId,
  type StepDefinition,
  type OnboardingWizardContext,
  type CompanySize,
  getStepsForFlow,
} from './steps'
import { StepRevealWrapper } from './steps/step-reveal-wrapper'
import {
  trackSignupCompleted,
  trackOnboardingCompleted,
  getStoredUTM,
  clearStoredUTM,
} from '@/lib/event_tracking'

const REVEALED_STEPS_KEY = 'hissuno_onboarding_revealed_steps'

function loadRevealedSteps(): Set<OnboardingStepId> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(REVEALED_STEPS_KEY)
    if (stored) {
      return new Set(JSON.parse(stored) as OnboardingStepId[])
    }
  } catch {
    // ignore parse errors
  }
  return new Set()
}

function saveRevealedSteps(steps: Set<OnboardingStepId>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(REVEALED_STEPS_KEY, JSON.stringify([...steps]))
}

export function OnboardingWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form state
  const [formData, setFormData] = useState<OnboardingFormData>(() => ({
    ...DEFAULT_ONBOARDING_DATA,
  }))
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [hasTrackedSignup, setHasTrackedSignup] = useState(false)

  // Reveal state — persisted to localStorage
  const [revealedSteps, setRevealedSteps] = useState<Set<OnboardingStepId>>(() => loadRevealedSteps())

  // Get onboarding steps
  const steps: StepDefinition[] = useMemo(() => {
    return getStepsForFlow()
  }, [])

  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'profile' | 'project' | 'demo' | 'redirecting'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Derived: is current step in reveal mode?
  const currentStepId = steps[currentStepIndex]?.id as OnboardingStepId
  const isInReveal = currentStepId ? !revealedSteps.has(currentStepId) : false

  const handleRevealComplete = useCallback((stepId: OnboardingStepId) => {
    setRevealedSteps((prev) => {
      const next = new Set(prev)
      next.add(stepId)
      saveRevealedSteps(next)
      return next
    })
  }, [])

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

        if (data.profile) {
          setFormData((prev) => ({
            ...prev,
            profile: {
              fullName: data.profile.full_name ?? '',
              companyName: data.profile.company_name ?? '',
              role: data.profile.role ?? '',
              companySize: (data.profile.company_size as CompanySize) ?? '',
            },
            about: {
              selectedChannels: data.profile.communication_channels ?? [],
              otherChannelText: '',
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
          communicationChannels: formData.about?.selectedChannels ?? [],
          onboardingCurrentStep: nextStepId ?? steps[currentStepIndex]?.id ?? null,
        }),
      })
    } catch (err) {
      console.error('[onboarding] Failed to save profile:', err)
    }
  }, [formData.profile, formData.about?.selectedChannels, steps, currentStepIndex])

  // Navigation handlers
  const handleNext = useCallback(async () => {
    // If we're in reveal state, just complete the reveal (no validation needed)
    if (isInReveal) {
      handleRevealComplete(currentStepId)
      return
    }

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
      await saveProfile(nextStepId)
      setCurrentStepIndex(nextIndex)
    }
  }, [currentStepIndex, steps, formData, saveProfile, isInReveal, currentStepId, handleRevealComplete])

  const handlePrevious = useCallback(() => {
    setError(null)
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
    }
  }, [currentStepIndex])

  const handleStepClick = useCallback((stepNumber: number) => {
    const targetIndex = stepNumber - 1
    if (targetIndex < 0 || targetIndex >= steps.length) return

    // Backward navigation is always allowed
    if (targetIndex <= currentStepIndex) {
      setError(null)
      setCurrentStepIndex(targetIndex)
      return
    }

    // Forward navigation: validate all intermediate steps
    for (let i = currentStepIndex; i < targetIndex; i++) {
      const step = steps[i]
      if (step.isOptional) continue
      const validation = step.validate(formData)
      if (!validation.isValid) {
        setError(`${step.title}: ${validation.error}`)
        return
      }
    }

    setError(null)
    setCurrentStepIndex(targetIndex)
  }, [steps, currentStepIndex, formData])

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
      // 1. Save profile with channels, clear current step
      const profileResponse = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.profile.fullName,
          companyName: formData.profile.companyName,
          role: formData.profile.role,
          companySize: formData.profile.companySize || null,
          communicationChannels: formData.about?.selectedChannels ?? [],
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
        selectedChannels: formData.about?.selectedChannels ?? [],
        utm: utm ?? undefined,
      })

      // 3. Clear stored UTM after successful onboarding
      clearStoredUTM()

      // 4. Create project (required)
      const projectName = formData.project?.name?.trim()
      if (projectName) {
        setPhase('project')
        try {
          const projectFormData = new FormData()
          projectFormData.append('name', projectName)
          if (formData.project.description?.trim()) {
            projectFormData.append('description', formData.project.description.trim())
          }

          // If additional details provided, pass as a knowledge source
          const additionalDetails = formData.project.additionalDetails?.trim()
          if (additionalDetails) {
            projectFormData.append(
              'knowledgeSources',
              JSON.stringify([{ type: 'raw_text', content: additionalDetails }])
            )
          }

          const projectResponse = await fetch('/api/projects', {
            method: 'POST',
            body: projectFormData,
          })

          if (projectResponse.ok) {
            const projectData = await projectResponse.json()

            // 5. If user chose demo data, create demo sessions
            if (formData.personalize?.useDemoData) {
              setPhase('demo')
              try {
                await fetch(`/api/projects/${projectData.project.id}/demo-sessions`, {
                  method: 'POST',
                })
              } catch (err) {
                console.error('[onboarding] Failed to create demo sessions:', err)
                // Non-critical — continue to dashboard
              }
            }

            setPhase('redirecting')
            // Clear revealed steps on completion
            localStorage.removeItem(REVEALED_STEPS_KEY)
            router.push(`/projects/${projectData.project.id}/dashboard`)
            return
          }
        } catch (err) {
          console.error('[onboarding] Failed to create project:', err)
          // Fall through to /projects/new
        }
      }

      // 6. Redirect to project creation if no project was created
      setPhase('redirecting')
      localStorage.removeItem(REVEALED_STEPS_KEY)
      router.push('/projects/new')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete onboarding'
      setError(message)
      setIsSubmitting(false)
      setPhase('idle')
    }
  }, [formData, steps, router])

  // Compute the furthest step the user can reach by validating forward from current
  const maxReachableStep = useMemo(() => {
    for (let i = currentStepIndex; i < steps.length; i++) {
      const step = steps[i]
      if (step.isOptional) continue
      const validation = step.validate(formData)
      if (!validation.isValid) return i + 1 // 1-indexed: can reach this step but not beyond
    }
    return steps.length
  }, [currentStepIndex, steps, formData])

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
        ? 'Creating project...'
        : phase === 'demo'
          ? 'Setting up demo data...'
          : 'Redirecting...'

  // Show loading skeleton while fetching profile (with overlay backdrop)
  if (isLoadingProfile) {
    return (
      <>
        <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="mx-auto max-w-2xl animate-pulse space-y-6 py-8">
            <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-64 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-4 pt-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <WizardContainer
        currentStep={currentStepIndex + 1}
        steps={wizardSteps}
        mode="onboarding"
        overlay
        isInRevealState={isInReveal}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSubmit={handleSubmit}
        onStepClick={handleStepClick}
        maxReachableStep={maxReachableStep}
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
            <StepRevealWrapper
              stepId={step.id}
              revealConfig={STEP_REVEAL_MESSAGES[step.id]}
              isRevealed={revealedSteps.has(step.id)}
              onRevealComplete={handleRevealComplete}
            >
              <step.component
                context={context}
                title={step.title}
                description={step.description}
                {...(step.id === 'billing' ? { onCheckoutComplete: handleNext } : {})}
              />
            </StepRevealWrapper>
          </WizardStep>
        ))}
      </WizardContainer>
    </form>
  )
}
