export interface DocNavItem {
  title: string
  slug: string
  href: string
}

export interface DocNavSubsection {
  title: string
  href: string
  items: DocNavItem[]
}

export interface DocNavCategory {
  title: string
  slug: string
  description: string
  items: DocNavItem[]
  subsections?: DocNavSubsection[]
}

export const DOCS_NAV: DocNavCategory[] = [
  {
    title: 'Getting Started',
    slug: 'getting-started',
    description: 'Set up your account, create your first project, and start collecting feedback.',
    items: [
      { title: 'Account Setup', slug: 'account-setup', href: '/docs/getting-started/account-setup' },
      { title: 'First Project', slug: 'first-project', href: '/docs/getting-started/first-project' },
      { title: 'Add Your Data', slug: 'add-your-data', href: '/docs/getting-started/add-your-data' },
      { title: 'Production Deployment', slug: 'production-deployment', href: '/docs/getting-started/production-deployment' },
    ],
    subsections: [
      {
        title: 'Connect to Hissuno',
        href: '/docs/connect/overview',
        items: [
          { title: 'Overview', slug: 'connect-overview', href: '/docs/connect/overview' },
          { title: 'MCP Server', slug: 'mcp', href: '/docs/connect/mcp' },
          { title: 'CLI', slug: 'cli', href: '/docs/connect/cli' },
          { title: 'Skills', slug: 'skills', href: '/docs/connect/skills' },
          { title: 'API', slug: 'api-overview', href: '/docs/api/overview' },
          { title: 'Authentication', slug: 'api-authentication', href: '/docs/api/authentication' },
        ],
      },
    ],
  },
  {
    title: 'Hissuno Agent',
    slug: 'agents',
    description: 'AI agents that power customer support and product management.',
    items: [
      { title: 'Overview', slug: 'overview', href: '/docs/agents/overview' },
      { title: 'Support Agent', slug: 'support-agent', href: '/docs/agents/support-agent' },
      { title: 'PM Copilot', slug: 'pm-copilot', href: '/docs/agents/pm-copilot' },
    ],
  },
  {
    title: 'Knowledge',
    slug: 'knowledge',
    description: 'Teach your AI agent about your product using knowledge sources and packages.',
    items: [
      { title: 'Sources', slug: 'sources', href: '/docs/knowledge/sources' },
      { title: 'Packages', slug: 'packages', href: '/docs/knowledge/packages' },
      { title: 'Analysis', slug: 'analysis', href: '/docs/knowledge/analysis' },
    ],
  },
  {
    title: 'Feedback',
    slug: 'feedback',
    description: 'Collect, review, and act on customer feedback automatically.',
    items: [
      { title: 'Overview', slug: 'overview', href: '/docs/feedback/overview' },
      { title: 'Sources', slug: 'sources', href: '/docs/feedback/sources' },
      { title: 'Review Workflow', slug: 'review-workflow', href: '/docs/feedback/review-workflow' },
    ],
  },
  {
    title: 'Issues',
    slug: 'issues',
    description: 'Automatic issue creation, deduplication, prioritization, and spec writing.',
    items: [
      { title: 'Auto Creation', slug: 'auto-creation', href: '/docs/issues/auto-creation' },
      { title: 'Deduplication', slug: 'deduplication', href: '/docs/issues/deduplication' },
      { title: 'Priority', slug: 'priority', href: '/docs/issues/priority' },
      { title: 'Specs', slug: 'specs', href: '/docs/issues/specs' },
    ],
  },
  {
    title: 'Customers',
    slug: 'customers',
    description: 'Manage companies, contacts, and customer data.',
    items: [
      { title: 'Companies & Contacts', slug: 'companies-contacts', href: '/docs/customers/companies-contacts' },
      { title: 'Custom Fields', slug: 'custom-fields', href: '/docs/customers/custom-fields' },
      { title: 'Lifecycle', slug: 'lifecycle', href: '/docs/customers/lifecycle' },
    ],
  },
  {
    title: 'Integrations',
    slug: 'integrations',
    description: 'Connect Hissuno to your existing tools and workflows.',
    items: [
      { title: 'Self-Hosting Setup', slug: 'self-hosting-setup', href: '/docs/integrations/self-hosting-setup' },
      { title: 'GitHub', slug: 'github', href: '/docs/integrations/github' },
      { title: 'Slack', slug: 'slack', href: '/docs/integrations/slack' },
      { title: 'Intercom', slug: 'intercom', href: '/docs/integrations/intercom' },
      { title: 'Gong', slug: 'gong', href: '/docs/integrations/gong' },
      { title: 'Jira', slug: 'jira', href: '/docs/integrations/jira' },
      { title: 'Linear', slug: 'linear', href: '/docs/integrations/linear' },
      { title: 'Zendesk', slug: 'zendesk', href: '/docs/integrations/zendesk' },
    ],
    subsections: [
      {
        title: 'Widget',
        href: '/docs/integrations/widget',
        items: [
          { title: 'Installation', slug: 'widget', href: '/docs/integrations/widget' },
          { title: 'Configuration', slug: 'widget-configuration', href: '/docs/integrations/widget-configuration' },
          { title: 'Authentication', slug: 'widget-authentication', href: '/docs/integrations/widget-authentication' },
          { title: 'Headless Mode', slug: 'widget-headless-mode', href: '/docs/integrations/widget-headless-mode' },
          { title: 'Custom Hook', slug: 'widget-custom-hook', href: '/docs/integrations/widget-custom-hook' },
        ],
      },
    ],
  },
]

export function getCategoryTitle(slug: string): string | undefined {
  return DOCS_NAV.find((cat) => cat.slug === slug)?.title
}

/** Flatten all pages including subsection items for prev/next navigation */
function getAllPages(): { title: string; href: string; category: string; categorySlug: string }[] {
  const allPages: { title: string; href: string; category: string; categorySlug: string }[] = []

  for (const cat of DOCS_NAV) {
    for (const item of cat.items) {
      allPages.push({ title: item.title, href: item.href, category: cat.title, categorySlug: cat.slug })
    }
    if (cat.subsections) {
      for (const sub of cat.subsections) {
        for (const item of sub.items) {
          allPages.push({ title: item.title, href: item.href, category: cat.title, categorySlug: cat.slug })
        }
      }
    }
  }

  return allPages
}

interface AdjacentPages {
  prev: { title: string; href: string; category: string } | null
  next: { title: string; href: string; category: string } | null
}

export function getAdjacentPages(category: string, slug: string): AdjacentPages {
  const allPages = getAllPages()

  const currentIndex = allPages.findIndex(
    (p) => p.categorySlug === category && p.href.endsWith(`/${slug}`)
  )

  // Also check by href match for subsection items (whose categorySlug differs from their URL path)
  const fallbackIndex =
    currentIndex === -1 ? allPages.findIndex((p) => p.href === `/docs/${category}/${slug}`) : currentIndex

  const idx = fallbackIndex

  return {
    prev: idx > 0 ? allPages[idx - 1] : null,
    next: idx < allPages.length - 1 ? allPages[idx + 1] : null,
  }
}
