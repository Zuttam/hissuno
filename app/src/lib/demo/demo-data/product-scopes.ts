export interface DemoProductScope {
  name: string
  slug: string
  description: string
  color: string
  position: number
  isDefault: boolean
  type: 'product_area' | 'initiative'
  goals: Array<{ id: string; text: string }> | null
}

export const DEMO_PRODUCT_SCOPES: DemoProductScope[] = [
  {
    name: 'General',
    slug: 'general',
    description: 'General feedback and issues not specific to any product scope',
    color: '',
    position: 0,
    isDefault: true,
    type: 'product_area' as const,
    goals: null,
  },
  {
    name: 'Task Management',
    slug: 'task-management',
    description: 'Task creation, assignment, statuses, dependencies, and workflows',
    color: 'info',
    position: 1,
    isDefault: false,
    type: 'product_area' as const,
    goals: [
      { id: 'tm-g1', text: 'Reduce average task completion time by 20%' },
      { id: 'tm-g2', text: 'Support 50+ concurrent collaborators per board' },
    ],
  },
  {
    name: 'Team Collaboration',
    slug: 'team-collaboration',
    description: 'Comments, mentions, real-time editing, and team communication features',
    color: 'success',
    position: 2,
    isDefault: false,
    type: 'product_area' as const,
    goals: [
      { id: 'tc-g1', text: 'Achieve 80% daily active usage among team members' },
      { id: 'tc-g2', text: 'Reduce context-switching time with in-app communication' },
    ],
  },
  {
    name: 'Reporting & Analytics',
    slug: 'reporting-analytics',
    description: 'Dashboards, charts, custom reports, and data export',
    color: 'warning',
    position: 3,
    isDefault: false,
    type: 'product_area' as const,
    goals: [
      { id: 'ra-g1', text: 'Enable self-serve reporting for non-technical users' },
      { id: 'ra-g2', text: 'Support real-time dashboards with <5s refresh' },
    ],
  },
  {
    name: 'Integrations & API',
    slug: 'integrations-api',
    description: 'Third-party integrations, REST API, webhooks, and developer tools',
    color: 'danger',
    position: 4,
    isDefault: false,
    type: 'product_area' as const,
    goals: [
      { id: 'ia-g1', text: 'Reach 25 native integrations by end of year' },
      { id: 'ia-g2', text: 'Maintain 99.9% API uptime with <200ms p95 latency' },
    ],
  },
  {
    name: 'User Management',
    slug: 'user-management',
    description: 'User roles, permissions, SSO, team administration',
    color: 'info',
    position: 5,
    isDefault: false,
    type: 'product_area' as const,
    goals: null,
  },
  {
    name: 'Mobile App',
    slug: 'mobile-app',
    description: 'iOS and Android mobile applications',
    color: 'success',
    position: 6,
    isDefault: false,
    type: 'product_area' as const,
    goals: [
      { id: 'ma-g1', text: 'Achieve feature parity with desktop for core workflows' },
      { id: 'ma-g2', text: 'Maintain 4.5+ star rating on App Store' },
    ],
  },
  {
    name: 'Enter Fintech Market',
    slug: 'fintech_market',
    description: 'Strategic push to acquire fintech customers',
    color: 'amber',
    position: 7,
    isDefault: false,
    type: 'initiative' as const,
    goals: [
      { id: 'g1', text: 'Sign 5 fintech customers by Q3' },
      { id: 'g2', text: 'Build compliance reporting features' },
    ],
  },
]
