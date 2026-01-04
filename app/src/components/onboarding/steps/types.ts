import type { ProjectStepId } from '@/components/projects/shared/wizard/steps/types'

// ============================================
// Step IDs
// ============================================

/**
 * Onboarding step identifiers
 */
export type OnboardingStepId = 'profile' | 'use-case' | 'billing'

// ============================================
// Validation
// ============================================

/**
 * Result from step validation
 */
export interface ValidationResult {
  isValid: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

// ============================================
// Form Data Sections
// ============================================

/**
 * Company size options
 */
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+' | ''

/**
 * Profile form data for onboarding
 */
export interface ProfileFormData {
  fullName: string
  companyName: string
  role: string
  companySize: CompanySize
}

/**
 * Billing form data for onboarding
 */
export interface BillingFormData {
  selectedPlanId: string | null
  skipped: boolean
}

/**
 * Use case options for onboarding
 */
export type UseCaseOption = 'knowledge' | 'slack' | 'triage' | 'specs'

/**
 * Use case option metadata
 */
export interface UseCaseOptionInfo {
  id: UseCaseOption
  label: string
  description: string
  /** References project wizard step IDs for feature association */
  relatedSteps: ProjectStepId[]
}

/**
 * Use case form data for onboarding
 */
export interface UseCaseFormData {
  selectedUseCases: UseCaseOption[]
}

// ============================================
// Complete Form Data
// ============================================

/**
 * Complete form data for onboarding flow
 */
export interface OnboardingFormData {
  profile: ProfileFormData
  useCase: UseCaseFormData
  billing: BillingFormData
}

// ============================================
// Wizard Context
// ============================================

/**
 * Wizard context passed to all onboarding step components
 */
export interface OnboardingWizardContext {
  formData: OnboardingFormData
  setFormData: React.Dispatch<React.SetStateAction<OnboardingFormData>>
}

// ============================================
// Step Components
// ============================================

/**
 * Props for all onboarding step components
 */
export interface StepProps {
  context: OnboardingWizardContext
  onValidationChange?: (isValid: boolean) => void
  title: string
  description?: React.ReactNode
}

/**
 * Step definition for the onboarding registry
 */
export interface StepDefinition {
  id: OnboardingStepId
  title: string
  shortTitle?: string
  description?: string
  component: React.ComponentType<StepProps>
  validate: (formData: OnboardingFormData) => ValidationResult
  isOptional?: boolean
}

// ============================================
// Use Case Options
// ============================================

/**
 * Available use case options with their metadata
 */
export const USE_CASE_OPTIONS: UseCaseOptionInfo[] = [
  {
    id: 'knowledge',
    label: 'Build support agent knowledge',
    description: 'Build support agent knowledge from codebase and more',
    relatedSteps: ['knowledge'],
  },
  {
    id: 'slack',
    label: 'Customer success in Slack',
    description: 'Integrate a customer success AI agent in Slack',
    relatedSteps: ['sessions'],
  },
  {
    id: 'triage',
    label: 'Automated triage',
    description: 'Automated triage of customer conversations',
    relatedSteps: ['sessions', 'issues'],
  },
  {
    id: 'specs',
    label: 'Product specs automation',
    description: 'Automate product specs and code changes from customer requests',
    relatedSteps: ['issues'],
  },
]

// ============================================
// Defaults
// ============================================

/**
 * Default profile form data
 */
export const DEFAULT_PROFILE_DATA: ProfileFormData = {
  fullName: '',
  companyName: '',
  role: '',
  companySize: '',
}

/**
 * Default billing form data
 */
export const DEFAULT_BILLING_DATA: BillingFormData = {
  selectedPlanId: null,
  skipped: false,
}

/**
 * Default use case form data
 */
export const DEFAULT_USE_CASE_DATA: UseCaseFormData = {
  selectedUseCases: [],
}

/**
 * Default form data for onboarding flow
 */
export const DEFAULT_ONBOARDING_DATA: OnboardingFormData = {
  profile: DEFAULT_PROFILE_DATA,
  useCase: DEFAULT_USE_CASE_DATA,
  billing: DEFAULT_BILLING_DATA,
}
