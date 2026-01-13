import type { KnowledgeSourceType } from '@/lib/knowledge/types'
import type {
  WidgetVariant,
  WidgetTheme,
  WidgetPosition,
} from '@/types/issue'

// ============================================
// Step IDs and Modes
// ============================================

/**
 * Project wizard step identifiers
 */
export type ProjectStepId = 'project-details' | 'knowledge' | 'sessions' | 'issues'

/**
 * Project wizard modes
 */
export type ProjectWizardMode = 'create' | 'edit'

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
// Integration States
// ============================================

/**
 * Integration state for GitHub
 */
export interface GitHubIntegrationState {
  isConnected: boolean
  isConnecting: boolean
  installationId: number | null
  onConnect: () => void
  onDisconnect: () => void
}

/**
 * Integration state for Slack
 */
export interface SlackIntegrationState {
  isConnected: boolean
  isConnecting: boolean
  onConnect: () => void
  onDisconnect?: () => void
  workspaceName?: string
}

/**
 * Integrations available in project wizard context
 */
export interface ProjectIntegrations {
  github: GitHubIntegrationState
  slack: SlackIntegrationState
}

// ============================================
// Form Data Sections
// ============================================

/**
 * Knowledge source input for the wizard
 */
export interface KnowledgeSourceInput {
  id: string
  type: KnowledgeSourceType
  url?: string
  content?: string
  file?: File
}

/**
 * Codebase configuration
 */
export interface CodebaseConfig {
  source: 'github' | 'none'
  repositoryUrl?: string
  repositoryBranch?: string
  fullName?: string // e.g., "owner/repo"
  analysisScope?: string // For monorepos
}

/**
 * Widget configuration
 */
export interface WidgetConfig {
  variant: WidgetVariant
  theme: WidgetTheme
  position: WidgetPosition
  title: string
  initialMessage: string
  allowedOrigins: string[]
  tokenRequired: boolean
  // Session lifecycle
  idleTimeoutMinutes: number
  goodbyeDelaySeconds: number
  idleResponseTimeoutSeconds: number
}

/**
 * Slack configuration
 */
export interface SlackConfig {
  connected: boolean
  workspaceId?: string
  workspaceName?: string
  enabledChannels?: string[]
}

/**
 * Issues configuration
 */
export interface IssuesConfig {
  trackingEnabled: boolean
  specThreshold: number
  specGuidelines: string | null
  autoSessionTracking: boolean
}

// ============================================
// Complete Form Data
// ============================================

/**
 * Complete form data for project wizard
 */
export interface ProjectWizardFormData {
  // Step 1: Project Details
  name: string
  description: string

  // Step 2: Knowledge
  codebase: CodebaseConfig
  knowledgeSources: KnowledgeSourceInput[]
  skipKnowledgeAnalysis: boolean

  // Step 3: Sessions
  widget: WidgetConfig
  slack: SlackConfig

  // Step 4: Issues
  issues: IssuesConfig
}

// ============================================
// Wizard Context
// ============================================

/**
 * Wizard context passed to all step components
 */
export interface ProjectWizardContext {
  /** Existing project ID (present in edit mode) */
  projectId?: string
  /** Current form data */
  formData: ProjectWizardFormData
  /** Form data setter */
  setFormData: React.Dispatch<React.SetStateAction<ProjectWizardFormData>>
  /** Wizard mode */
  mode: ProjectWizardMode
  /** Integration states */
  integrations: ProjectIntegrations
}

// ============================================
// Step Components
// ============================================

/**
 * Props for all step components
 */
export interface StepProps {
  context: ProjectWizardContext
  onValidationChange?: (isValid: boolean) => void
  title: string
  description?: React.ReactNode
}

/**
 * Step definition for the registry
 */
export interface StepDefinition {
  id: ProjectStepId
  title: string
  shortTitle?: string
  description?: string
  component: React.ComponentType<StepProps>
  validate: (formData: ProjectWizardFormData) => ValidationResult
  isOptional?: boolean
  integrationTrigger?: 'github' | 'slack'
}

// ============================================
// Defaults
// ============================================

/**
 * Default form data for creating a new project
 */
export const DEFAULT_FORM_DATA: ProjectWizardFormData = {
  // Step 1
  name: '',
  description: '',

  // Step 2
  codebase: {
    source: 'none',
  },
  knowledgeSources: [],
  skipKnowledgeAnalysis: false,

  // Step 3
  widget: {
    variant: 'popup',
    theme: 'light',
    position: 'bottom-right',
    title: 'Support',
    initialMessage: 'Hi! How can I help you today?',
    allowedOrigins: [],
    tokenRequired: false,
    idleTimeoutMinutes: 5,
    goodbyeDelaySeconds: 90,
    idleResponseTimeoutSeconds: 60,
  },
  slack: {
    connected: false,
  },

  // Step 4
  issues: {
    trackingEnabled: true,
    specThreshold: 3,
    specGuidelines: null,
    autoSessionTracking: false,
  },
}
