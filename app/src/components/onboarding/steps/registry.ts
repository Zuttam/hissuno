import { ProfileStep } from './profile-step'
import { UseCaseStep } from './use-case-step'
import { BillingStep } from './billing-step'
import type { OnboardingStepId, OnboardingFormData, StepDefinition } from './types'

/**
 * Step registry containing onboarding wizard steps
 */
export const ONBOARDING_STEP_REGISTRY: Record<OnboardingStepId, StepDefinition> = {
  profile: {
    id: 'profile',
    title: 'Tell us about yourself',
    shortTitle: 'Profile',
    description: 'Help us personalize your experience.',
    component: ProfileStep,
    validate: (data: OnboardingFormData) => {
      if (!data.profile?.fullName?.trim()) {
        return { isValid: false, error: 'Full name is required' }
      }
      return { isValid: true }
    },
  },

  'use-case': {
    id: 'use-case',
    title: 'What is Hissuno for you?',
    shortTitle: 'Use Case',
    description:
      'Select the ways you plan to use Hissuno. This helps us customize your experience. You can skip this step if you prefer a quick setup.',
    component: UseCaseStep,
    validate: () => ({ isValid: true }), // Optional step
    isOptional: true,
  },

  billing: {
    id: 'billing',
    title: 'Choose a plan',
    shortTitle: 'Plan',
    description: 'Select a plan that fits your needs. You can always upgrade later.',
    component: BillingStep,
    validate: (data: OnboardingFormData) => {
      if (!data.billing?.selectedPlanId) {
        return { isValid: false, error: 'Please select a plan to continue' }
      }
      return { isValid: true }
    },
  },
}

/**
 * Default step ordering for onboarding flow
 */
export const ONBOARDING_FLOW_ORDER: OnboardingStepId[] = ['profile', 'use-case', 'billing']

/**
 * Get step definitions for onboarding flow
 */
export function getStepsForFlow(
  customOrder?: OnboardingStepId[]
): StepDefinition[] {
  const stepIds = customOrder ?? ONBOARDING_FLOW_ORDER
  return stepIds.map((id) => ONBOARDING_STEP_REGISTRY[id])
}

/**
 * Get step index by ID
 */
export function getStepIndex(stepId: OnboardingStepId): number {
  return ONBOARDING_FLOW_ORDER.indexOf(stepId)
}

/**
 * Get step ID by index
 */
export function getStepIdByIndex(index: number): OnboardingStepId | null {
  return ONBOARDING_FLOW_ORDER[index] ?? null
}

/**
 * Get the next step ID after the current one
 */
export function getNextStepId(currentStepId: OnboardingStepId): OnboardingStepId | null {
  const currentIndex = getStepIndex(currentStepId)
  return getStepIdByIndex(currentIndex + 1)
}

/**
 * Get the previous step ID before the current one
 */
export function getPreviousStepId(currentStepId: OnboardingStepId): OnboardingStepId | null {
  const currentIndex = getStepIndex(currentStepId)
  if (currentIndex <= 0) return null
  return getStepIdByIndex(currentIndex - 1)
}
