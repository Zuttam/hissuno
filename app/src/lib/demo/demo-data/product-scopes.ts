export interface DemoProductScope {
  name: string
  slug: string
  description: string
  color: string
  position: number
  isDefault: boolean
  type: 'product_area' | 'initiative' | 'experiment'
  goals: Array<{ id: string; text: string }> | null
  parent_id?: string | null
  content?: string | null
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
    goals: [
      { id: 'um-g1', text: 'Achieve SOC 2 Type II certification for access controls by Q4' },
      { id: 'um-g2', text: 'Reduce IT admin time spent on user provisioning by 50%' },
    ],
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
    color: 'warning',
    position: 7,
    isDefault: false,
    type: 'initiative' as const,
    goals: [
      { id: 'fm-g1', text: 'Sign 5 fintech customers with combined ARR of $500K by Q3' },
      { id: 'fm-g2', text: 'Ship compliance reporting module with SOX and PCI-DSS templates by Q2' },
    ],
  },
  {
    name: 'Enterprise Security & Compliance',
    slug: 'enterprise-security-compliance',
    description: 'Achieve enterprise security certifications, audit readiness, and compliance features to unlock regulated industries',
    color: 'danger',
    position: 8,
    isDefault: false,
    type: 'initiative' as const,
    goals: [
      { id: 'esc-g1', text: 'Pass SOC 2 Type II audit by end of Q2' },
      { id: 'esc-g2', text: 'Close 10 enterprise deals blocked by compliance requirements by Q4' },
    ],
  },
  {
    name: 'AI-Powered Productivity',
    slug: 'ai-powered-productivity',
    description: 'Embed AI capabilities across the product for task automation, smart suggestions, and predictive insights',
    color: 'info',
    position: 9,
    isDefault: false,
    type: 'initiative' as const,
    goals: [
      { id: 'ai-g1', text: 'Launch 3 GA AI features (smart assign, auto-triage, predictive deadlines) by Q3' },
      { id: 'ai-g2', text: 'Achieve 40% weekly adoption of AI features among Pro and Enterprise users' },
    ],
  },
  {
    name: 'Expand Upmarket',
    slug: 'expand-upmarket',
    description: 'Move upmarket by adding enterprise-grade features including advanced administration, audit logging, and dedicated support SLAs',
    color: 'warning',
    position: 10,
    isDefault: false,
    type: 'initiative' as const,
    goals: [
      { id: 'eu-g1', text: 'Increase average Enterprise deal size from $180K to $250K ARR' },
      { id: 'eu-g2', text: 'Reduce Enterprise sales cycle from 90 days to 60 days with self-serve security questionnaire' },
    ],
  },
]
