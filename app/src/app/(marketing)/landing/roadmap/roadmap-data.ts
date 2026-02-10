// Roadmap status types
export type RoadmapStatus = 'done' | 'in-development' | 'planned' | 'future'

export interface RoadmapItem {
  id: string
  title: string
  description: string
}

export interface RoadmapPhase {
  status: RoadmapStatus
  title: string
  subtitle: string
  items: RoadmapItem[]
}

// Status display configuration
export const STATUS_CONFIG: Record<
  RoadmapStatus,
  { label: string; color: string; icon: 'check' | 'pulse' | 'clock' | 'circle' }
> = {
  done: {
    label: 'Shipped',
    color: 'var(--accent-success)',
    icon: 'check',
  },
  'in-development': {
    label: 'In Development',
    color: 'var(--accent-teal)',
    icon: 'pulse',
  },
  planned: {
    label: 'Planned',
    color: 'var(--accent-warm)',
    icon: 'clock',
  },
  future: {
    label: 'Future',
    color: 'var(--text-tertiary)',
    icon: 'circle',
  },
}

// Curated roadmap content - customer-friendly version of internal Roadmap.md
export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    status: 'done',
    title: 'Core Platform',
    subtitle: 'The foundation is live',
    items: [
      {
        id: 'knowledge-base',
        title: 'Agent-Ready Knowledge Base',
        description:
          'High-fidelity documentation that powers AI agents and responds to natural language queries.',
      },
      {
        id: 'support-widget',
        title: 'Embeddable Support Widget',
        description:
          'Deploy an AI support agent on your website with multiple variants: side drawer, dialog, or headless mode.',
      },
      {
        id: 'conversation-triage',
        title: 'Smart Conversation Triage',
        description:
          'Automatically classify, tag, and prioritize customer conversations.',
      },
      {
        id: 'issue-tracking',
        title: 'Issue Detection & Deduplication',
        description:
          'Convert conversations into product tickets with automatic prioritization and smart deduplication.',
      },
      {
        id: 'product-specs',
        title: 'Connected Product Specs',
        description: 'Generate specs linked to customer conversations and your codebase.',
      },
      {
        id: 'analytics',
        title: 'Customer Impact Analytics',
        description:
          'Visualize customer impact with waterfall graphs and issue prioritization insights.',
      },
      {
        id: 'export',
        title: 'Data Export',
        description: 'Export feedback and issues to CSV for your own analysis.',
      },
    ],
  },
  {
    status: 'in-development',
    title: 'Enhanced Integrations',
    subtitle: 'Connecting to your existing tools',
    items: [
      {
        id: 'slack-channels',
        title: 'Slack Channel Monitoring',
        description:
          'Monitor your Slack channels for customer conversations with read-only and auto-response modes.',
      },
      {
        id: 'intercom',
        title: 'Intercom Integration',
        description:
          'Import and analyze conversations directly from your Intercom workspace.',
      },
      {
        id: 'gong',
        title: 'Gong Integration',
        description: 'Sync call transcripts and sales conversations from Gong.',
      },
      {
        id: 'jira',
        title: 'Jira Sync',
        description: 'Push issues directly to your Jira projects with automatic field mapping.',
      },
      {
        id: 'onboarding',
        title: 'Improved Onboarding',
        description: 'Streamlined setup experience to get you up and running faster.',
      },
    ],
  },
  {
    status: 'planned',
    title: 'Team Collaboration',
    subtitle: 'Built for teams',
    items: [
      {
        id: 'multi-user',
        title: 'Multi-User Access & RBAC',
        description:
          'Invite team members with role-based permissions and granular access controls.',
      },
      {
        id: 'invite-links',
        title: 'Team Invite Links',
        description: 'Generate shareable links for easy team onboarding.',
      },
      {
        id: 'alerts',
        title: 'Alerts & Weekly Reports',
        description:
          'Stay informed with email and Slack notifications on important issues and trends.',
      },
      {
        id: 'email-agent',
        title: 'Email Support Agent',
        description: 'Extend AI support to handle customer emails automatically.',
      },
      {
        id: 'draft-responses',
        title: 'Draft Response Suggestions',
        description:
          'Get AI-suggested replies to send back to customers based on issue resolution.',
      },
      {
        id: 'linear',
        title: 'Linear Integration',
        description: 'Sync issues directly to Linear for seamless project management.',
      },
    ],
  },
  {
    status: 'future',
    title: 'Developer Platform',
    subtitle: 'Extend and integrate',
    items: [
      {
        id: 'api-access',
        title: 'API Access',
        description:
          'Programmatic access to Hissuno via API keys for custom integrations.',
      },
      {
        id: 'code-implementation',
        title: 'AI Code Implementation',
        description:
          'Generate initial code implementations from product specs and customer requirements.',
      },
      {
        id: 'community-channels',
        title: 'Community Channel Monitoring',
        description:
          'Monitor Facebook groups and other community channels for customer feedback.',
      },
      {
        id: 'docs-portal',
        title: 'Documentation Portal',
        description: 'A dedicated docs site to help you get the most out of Hissuno.',
      },
    ],
  },
]
