import type { WidgetTrigger, WidgetDisplay, WidgetTheme, WidgetPosition } from '@/types/issue'

/**
 * Widget settings subset of ProjectSettingsRecord
 */
export interface WidgetSettings {
  // New trigger/display model
  widget_trigger_type: WidgetTrigger
  widget_display_type: WidgetDisplay
  widget_shortcut: string | null
  widget_drawer_badge_label: string
  // Legacy and shared settings
  widget_variant: WidgetDisplay
  widget_theme: WidgetTheme
  widget_position: WidgetPosition
  widget_title: string
  widget_initial_message: string
  allowed_origins: string[] | null
  widget_token_required: boolean | null
}

/**
 * Session lifecycle settings subset of ProjectSettingsRecord
 */
export interface SessionSettings {
  session_idle_timeout_minutes: number
  session_goodbye_delay_seconds: number
  session_idle_response_timeout_seconds: number
}

/**
 * Issue tracking settings subset of ProjectSettingsRecord
 */
export interface IssueSettings {
  issue_tracking_enabled: boolean
  pm_dedup_include_closed: boolean
}

/**
 * Support agent settings subset of ProjectSettingsRecord
 */
export interface SupportAgentSettings {
  support_agent_package_id: string | null
}

/**
 * Input for updating widget settings
 */
export type WidgetSettingsInput = Partial<WidgetSettings>

/**
 * Input for updating session settings
 */
export type SessionSettingsInput = Partial<SessionSettings>

/**
 * Input for updating issue settings
 */
export type IssueSettingsInput = Partial<IssueSettings>

/**
 * Input for updating support agent settings
 */
export type SupportAgentSettingsInput = Partial<SupportAgentSettings>

/**
 * Default widget settings
 */
export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  // New trigger/display model
  widget_trigger_type: 'bubble',
  widget_display_type: 'sidepanel',
  widget_shortcut: 'mod+k',
  widget_drawer_badge_label: 'Support',
  // Legacy and shared settings
  widget_variant: 'sidepanel',
  widget_theme: 'light',
  widget_position: 'bottom-right',
  widget_title: 'Support',
  widget_initial_message: 'Hi! How can I help you today?',
  allowed_origins: [],
  widget_token_required: false,
}

/**
 * Default session settings
 */
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  session_idle_timeout_minutes: 5,
  session_goodbye_delay_seconds: 90,
  session_idle_response_timeout_seconds: 60,
}

/**
 * Default issue settings
 */
export const DEFAULT_ISSUE_SETTINGS: IssueSettings = {
  issue_tracking_enabled: true,
  pm_dedup_include_closed: false,
}

/**
 * Default support agent settings
 */
export const DEFAULT_SUPPORT_AGENT_SETTINGS: SupportAgentSettings = {
  support_agent_package_id: null,
}
