/**
 * Notification preference types and utilities
 */

export const NOTIFICATION_TYPES = [
  'welcome',
  'limit_reached',
  'human_needed',
  'new_issue_created',
  'session_reviewed',
  'ready_for_dev',
  'weekly_digest',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type ChannelPreference = {
  email: boolean
  slack: boolean
}

export type NotificationPreferences = {
  [K in NotificationType]?: ChannelPreference
}

export type NotificationTypeInfo = {
  type: NotificationType
  label: string
  description: string
  active: boolean
  supportedChannels: ('email' | 'slack')[]
}

export const NOTIFICATION_TYPE_INFO: NotificationTypeInfo[] = [
  {
    type: 'welcome',
    label: 'Welcome',
    description: 'Welcome email when you sign up',
    active: true,
    supportedChannels: ['email'],
  },
  {
    type: 'limit_reached',
    label: 'Limit Reached',
    description: 'Alerts when you hit a plan limit',
    active: true,
    supportedChannels: ['email', 'slack'],
  },
  {
    type: 'human_needed',
    label: 'Human Needed',
    description: 'When a support session needs human intervention',
    active: true,
    supportedChannels: ['email', 'slack'],
  },
  {
    type: 'new_issue_created',
    label: 'New Issue Created',
    description: 'When an issue is auto-created from a session',
    active: false,
    supportedChannels: ['email', 'slack'],
  },
  {
    type: 'session_reviewed',
    label: 'Session Reviewed',
    description: 'When a session is reviewed by the PM agent',
    active: false,
    supportedChannels: ['email', 'slack'],
  },
  {
    type: 'ready_for_dev',
    label: 'Ready for Dev',
    description: 'When an issue has a spec and is ready for development',
    active: false,
    supportedChannels: ['email', 'slack'],
  },
  {
    type: 'weekly_digest',
    label: 'Weekly Digest',
    description: 'Weekly summary of sessions and issues',
    active: false,
    supportedChannels: ['email', 'slack'],
  },
]

export function getDefaultPreferences(): NotificationPreferences {
  const prefs: NotificationPreferences = {}
  for (const type of NOTIFICATION_TYPES) {
    prefs[type] = { email: true, slack: false }
  }
  return prefs
}

/**
 * Merge stored preferences with defaults so new types get default values.
 */
export function resolvePreferences(stored: NotificationPreferences | null | undefined): NotificationPreferences {
  const defaults = getDefaultPreferences()
  if (!stored) return defaults

  const resolved: NotificationPreferences = {}
  for (const type of NOTIFICATION_TYPES) {
    resolved[type] = {
      email: stored[type]?.email ?? defaults[type]!.email,
      slack: stored[type]?.slack ?? defaults[type]!.slack,
    }
  }
  return resolved
}
