// Types
export type {
  WidgetSettings,
  WidgetSettingsInput,
  SessionSettings,
  SessionSettingsInput,
  IssueSettings,
  IssueSettingsInput,
} from './types'

export {
  DEFAULT_WIDGET_SETTINGS,
  DEFAULT_SESSION_SETTINGS,
  DEFAULT_ISSUE_SETTINGS,
} from './types'

// Widget settings
export { getWidgetSettings, updateWidgetSettings } from './widget'

// Session lifecycle settings
export { getSessionSettings, updateSessionSettings } from './sessions'

// Issue tracking settings
export { getIssueSettings, updateIssueSettings } from './issues'
