// Types
export type {
  OnboardingStepId,
  OnboardingWizardContext,
  StepProps,
  StepDefinition,
  ValidationResult,
  OnboardingFormData,
  ProfileFormData,
  BillingFormData,
  UseCaseFormData,
  CompanySize,
  UseCaseOption,
  UseCaseOptionInfo,
} from './types'

export {
  DEFAULT_ONBOARDING_DATA,
  DEFAULT_PROFILE_DATA,
  DEFAULT_BILLING_DATA,
  DEFAULT_USE_CASE_DATA,
  USE_CASE_OPTIONS,
} from './types'

// Registry
export {
  ONBOARDING_STEP_REGISTRY,
  ONBOARDING_FLOW_ORDER,
  getStepsForFlow,
  getStepIndex,
  getStepIdByIndex,
  getNextStepId,
  getPreviousStepId,
} from './registry'

// Step components
export { ProfileStep } from './profile-step'
export { UseCaseStep } from './use-case-step'
export { BillingStep } from './billing-step'
