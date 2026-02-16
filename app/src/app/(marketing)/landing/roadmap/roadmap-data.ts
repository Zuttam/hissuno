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
    status: 'done',
    title: 'Integrations & Onboarding',
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
        title: 'Streamlined Onboarding',
        description: 'Get up and running faster with a simplified setup flow, especially for invited team members.',
      },
    ],
  },
  {
    status: 'done',
    title: 'Team Collaboration',
    subtitle: 'Built for teams',
    items: [
      {
        id: 'multi-user',
        title: 'Multi-User Access & Roles',
        description:
          'Invite team members with owner and member roles for granular access control.',
      },
      {
        id: 'invite-links',
        title: 'Team Invites',
        description: 'Generate invite links and batch-invite your team for easy onboarding.',
      },
      {
        id: 'api-access',
        title: 'API Keys',
        description:
          'Generate API keys for programmatic access to your project data and custom integrations.',
      },
      {
        id: 'customer-segmentation',
        title: 'Customer Segmentation',
        description: 'Segment customers and surface key insights across your feedback data.',
      },
      {
        id: 'feedback-analytics',
        title: 'Feedback Analytics',
        description:
          'Track analyzed vs. unreviewed feedback with new filters and enhanced analytics dashboards.',
      },
    ],
  },
  {
    status: 'in-development',
    title: 'Automation & Intelligence',
    subtitle: 'Smarter workflows',
    items: [
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
    status: 'planned',
    title: 'Developer Platform',
    subtitle: 'Extend and integrate',
    items: [
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
      {
        id: 'webhooks',
        title: 'Webhooks',
        description: 'Receive real-time notifications when new feedback or issues are created.',
      },
    ],
  },
]
