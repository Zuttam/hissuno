
// ============================================
// Step IDs
// ============================================

/**
 * Onboarding step identifiers
 */
export type OnboardingStepId = 'profile' | 'use-case' | 'billing' | 'project'

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
 * Project form data for onboarding
 */
export interface ProjectFormData {
  name: string
  description: string
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
  emoji: string
  label: string
  description: string
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
  project: ProjectFormData
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
  onCheckoutComplete?: () => void
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
    emoji: '🧠',
    label: 'Build support agent knowledge',
    description: 'Build support agent knowledge from codebase and more'
  },
  {
    id: 'slack',
    emoji: '💬',
    label: 'Customer success in Slack',
    description: 'Integrate a customer success AI agent in Slack',
  },
  {
    id: 'triage',
    emoji: '🔀',
    label: 'Automated triage',
    description: 'Automated triage of customer conversations',
  },
  {
    id: 'specs',
    emoji: '📋',
    label: 'Product specs automation',
    description: 'Automate product specs and code changes from customer requests',
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
 * Default project form data
 */
export const DEFAULT_PROJECT_DATA: ProjectFormData = {
  name: '',
  description: '',
  skipped: false,
}

/**
 * Default form data for onboarding flow
 */
export const DEFAULT_ONBOARDING_DATA: OnboardingFormData = {
  profile: DEFAULT_PROFILE_DATA,
  useCase: DEFAULT_USE_CASE_DATA,
  billing: DEFAULT_BILLING_DATA,
  project: DEFAULT_PROJECT_DATA,
}
