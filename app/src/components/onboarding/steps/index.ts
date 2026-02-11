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
  AboutFormData,
  ProjectFormData,
  CompanySize,
  CommunicationChannel,
  CommunicationChannelInfo,
  StepRevealConfig,
} from './types'

export {
  DEFAULT_ONBOARDING_DATA,
  DEFAULT_PROFILE_DATA,
  DEFAULT_BILLING_DATA,
  DEFAULT_ABOUT_DATA,
  DEFAULT_PROJECT_DATA,
  COMMUNICATION_CHANNELS,
  STEP_REVEAL_MESSAGES,
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
export { AccountStep } from './account-step'
export { AboutStep } from './about-step'
export { BillingStep } from './billing-step'
export { ProjectStep } from './project-step'
export { StepRevealWrapper } from './step-reveal-wrapper'
