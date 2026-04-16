import type { WidgetTrigger, WidgetDisplay, WidgetTheme } from '@/types/issue'

/**
 * Widget settings from widget_integrations table
 */
export interface WidgetSettings {
  trigger_type: WidgetTrigger
  display_type: WidgetDisplay
  shortcut: string | null
  drawer_badge_label: string
  theme: WidgetTheme
  title: string
  initial_message: string
  allowed_origins: string[] | null
  token_required: boolean | null
}

/**
 * Support agent settings subset of ProjectSettingsRecord
 */
export interface SupportAgentSettings {
  support_agent_package_id: string | null
  support_agent_tone: string | null
  brand_guidelines: string | null
  session_idle_timeout_minutes: number
  session_goodbye_delay_seconds: number
  session_idle_response_timeout_seconds: number
}

/**
 * Input for updating widget settings
 */
export type WidgetSettingsInput = Partial<WidgetSettings>

/**
 * Input for updating support agent settings
 */
export type SupportAgentSettingsInput = Partial<SupportAgentSettings>

/**
 * Default widget settings
 */
export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  trigger_type: 'bubble',
  display_type: 'sidepanel',
  shortcut: 'mod+k',
  drawer_badge_label: 'Support',
  theme: 'light',
  title: 'Support',
  initial_message: 'Hi! How can I help you today?',
  allowed_origins: [],
  token_required: false,
}

/**
 * PM agent settings subset of ProjectSettingsRecord
 */
export interface PmAgentSettings {
  classification_guidelines: string | null
  brief_guidelines: string | null
  analysis_guidelines: string | null
  issue_analysis_enabled: boolean
}

/**
 * Input for updating PM agent settings
 */
export type PmAgentSettingsInput = Partial<PmAgentSettings>

/**
 * Default support agent settings
 */
export const DEFAULT_SUPPORT_AGENT_SETTINGS: SupportAgentSettings = {
  support_agent_package_id: null,
  support_agent_tone: null,
  brand_guidelines: null,
  session_idle_timeout_minutes: 5,
  session_goodbye_delay_seconds: 90,
  session_idle_response_timeout_seconds: 60,
}

/**
 * Default PM agent settings
 */
export const DEFAULT_PM_AGENT_SETTINGS: PmAgentSettings = {
  classification_guidelines: null,
  brief_guidelines: null,
  analysis_guidelines: null,
  issue_analysis_enabled: true,
}

/**
 * Knowledge analysis settings subset of ProjectSettingsRecord
 */
export interface KnowledgeAnalysisSettings {
  knowledge_relationship_guidelines: string | null
}

/**
 * Input for updating knowledge analysis settings
 */
export type KnowledgeAnalysisSettingsInput = Partial<KnowledgeAnalysisSettings>

/**
 * Default knowledge analysis settings
 */
export const DEFAULT_KNOWLEDGE_ANALYSIS_SETTINGS: KnowledgeAnalysisSettings = {
  knowledge_relationship_guidelines: null,
}

/**
 * AI model settings subset of ProjectSettingsRecord
 */
export interface AIModelSettings {
  ai_model: string | null
  ai_model_small: string | null
}

/**
 * Input for updating AI model settings
 */
export type AIModelSettingsInput = Partial<AIModelSettings>

/**
 * Default AI model settings (null = use env var / hardcoded fallback)
 */
export const DEFAULT_AI_MODEL_SETTINGS: AIModelSettings = {
  ai_model: null,
  ai_model_small: null,
}
