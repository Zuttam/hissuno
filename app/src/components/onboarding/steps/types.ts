
// ============================================
// Step IDs
// ============================================

/**
 * Onboarding step identifiers
 */
export type OnboardingStepId = 'account' | 'about' | 'billing' | 'project'

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
  projectMode: 'demo' | 'blank'
  name: string
  description: string
  additionalDetails: string
  skipped: boolean
}

/**
 * Communication channel options
 */
export type CommunicationChannel = 'intercom' | 'gong' | 'email' | 'slack' | 'other'

/**
 * Communication channel metadata
 */
export interface CommunicationChannelInfo {
  id: CommunicationChannel
  emoji: string
  label: string
  description: string
}

/**
 * About step form data
 */
export interface AboutFormData {
  selectedChannels: CommunicationChannel[]
  otherChannelText: string
}

// ============================================
// Complete Form Data
// ============================================

/**
 * Complete form data for onboarding flow
 */
export interface OnboardingFormData {
  profile: ProfileFormData
  about: AboutFormData
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
// Reveal Config
// ============================================

/**
 * Configuration for step reveal messages
 */
export interface StepRevealConfig {
  message: string
  subtitle?: string
}

/**
 * Reveal messages shown once per step before the form content
 */
export const STEP_REVEAL_MESSAGES: Record<OnboardingStepId, StepRevealConfig> = {
  account: {
    message: 'Welcome to Hissuno. Before we begin, we want to know you better.',
  },
  about: {
    message: 'Hissuno turns customer feedback into ready-made engineering work. We do this by analyzing conversations and signals across your stack.',
  },
  billing: {
    message: 'Before we let your new AI sidekicks roam, let us know how you want to pay for them.',
  },
  project: {
    message: 'Almost there! Choose how you want to get started.',
  },
}

// ============================================
// Communication Channels
// ============================================

/**
 * Available communication channel options with their metadata
 */
export const COMMUNICATION_CHANNELS: CommunicationChannelInfo[] = [
  {
    id: 'intercom',
    emoji: '💬',
    label: 'Intercom',
    description: 'Customer support conversations from Intercom',
  },
  {
    id: 'gong',
    emoji: '🎙️',
    label: 'Gong',
    description: 'Sales and success call recordings from Gong',
  },
  {
    id: 'email',
    emoji: '📧',
    label: 'Email',
    description: 'Customer emails and support tickets',
  },
  {
    id: 'slack',
    emoji: '⚡',
    label: 'Slack',
    description: 'Customer conversations in Slack channels',
  },
  {
    id: 'other',
    emoji: '🔗',
    label: 'Other',
    description: 'Other communication channels',
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
 * Default about form data
 */
export const DEFAULT_ABOUT_DATA: AboutFormData = {
  selectedChannels: [],
  otherChannelText: '',
}

/**
 * Default project form data
 */
export const DEFAULT_PROJECT_DATA: ProjectFormData = {
  projectMode: 'demo',
  name: '',
  description: '',
  additionalDetails: '',
  skipped: false,
}

/**
 * Default form data for onboarding flow
 */
export const DEFAULT_ONBOARDING_DATA: OnboardingFormData = {
  profile: DEFAULT_PROFILE_DATA,
  about: DEFAULT_ABOUT_DATA,
  billing: DEFAULT_BILLING_DATA,
  project: DEFAULT_PROJECT_DATA,
}
