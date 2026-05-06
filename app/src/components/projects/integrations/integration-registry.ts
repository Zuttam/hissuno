export interface IntegrationType {
  id: string
  name: string
  description: string
  category: 'interactive' | 'sessions' | 'issues' | 'knowledge' | 'analytics' | 'customer_data'
  comingSoon?: boolean
  iconSrc: string
  iconDarkSrc?: string
  /** true if icon is an inline SVG (widget) rather than an image file */
  inlineSvg?: boolean
  /** true if icon needs dark:invert treatment */
  invertInDark?: boolean
  /** Label shown on marketplace card for first-party integrations (e.g., "Setup") */
  setupLabel?: string
}

export const INTEGRATION_TYPES: IntegrationType[] = [
  {
    id: 'widget',
    name: 'Widget',
    description: 'Embed the support chat widget in your application',
    category: 'interactive',
    iconSrc: '',
    inlineSvg: true,
    setupLabel: 'Setup',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Connect Slack channels for customer conversations',
    category: 'interactive',
    iconSrc: '/logos/slack.svg',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Import customer emails and support threads from Gmail',
    category: 'interactive',
    comingSoon: true,
    iconSrc: '/logos/gmail.svg',
  },
  {
    id: 'gong',
    name: 'Gong',
    description: 'Import call recordings and transcripts from Gong',
    category: 'sessions',
    iconSrc: '/logos/gong.svg',
  },
  {
    id: 'intercom',
    name: 'Intercom',
    description: 'Sync conversations from Intercom',
    category: 'sessions',
    iconSrc: '/logos/intercom.svg',
  },
  {
    id: 'fathom',
    name: 'Fathom',
    description: 'Import AI meeting notes and transcripts from Fathom',
    category: 'sessions',
    iconSrc: '/logos/fathom.svg',
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    description: 'Sync solved/closed tickets from Zendesk',
    category: 'sessions',
    iconSrc: '/logos/zendesk.svg',
    iconDarkSrc: '/logos/zendesk-dark.svg',
  },
  {
    id: 'posthog',
    name: 'PostHog',
    description: 'Enrich contacts with behavioral profiles from PostHog analytics',
    category: 'analytics',
    iconSrc: '/logos/posthog.svg',
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    description: 'Connect product analytics data to enhance customer insights',
    category: 'analytics',
    comingSoon: true,
    iconSrc: '/logos/amplitude.svg',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect a repository as a codebase you can attach to scopes',
    category: 'knowledge',
    iconSrc: '/logos/github.svg',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Sync Notion databases as issues and pages as knowledge sources',
    category: 'knowledge',
    iconSrc: '/logos/notion.svg',
    invertInDark: true,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Import documents from Google Drive as knowledge sources',
    category: 'knowledge',
    comingSoon: true,
    iconSrc: '/logos/google-drive.svg',
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Sync issues to Jira for project management',
    category: 'issues',
    iconSrc: '/logos/jira.svg',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Sync issues to Linear for modern project management',
    category: 'issues',
    iconSrc: '/logos/linear.svg',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sync companies and contacts from HubSpot CRM',
    category: 'customer_data',
    iconSrc: '/logos/hubspot.svg',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Sync companies and contacts from Salesforce',
    category: 'customer_data',
    comingSoon: true,
    iconSrc: '/logos/salesforce.svg',
  },
]

export function getIntegrationType(id: string): IntegrationType | undefined {
  return INTEGRATION_TYPES.find((t) => t.id === id)
}

export function getAvailableIntegrations(): IntegrationType[] {
  return INTEGRATION_TYPES.filter((t) => !t.comingSoon)
}
