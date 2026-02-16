export interface DocNavItem {
  title: string
  slug: string
  href: string
}

export interface DocNavCategory {
  title: string
  slug: string
  description: string
  items: DocNavItem[]
}

export const DOCS_NAV: DocNavCategory[] = [
  {
    title: 'Getting Started',
    slug: 'getting-started',
    description: 'Set up your account, create your first project, and start collecting feedback.',
    items: [
      { title: 'Account Setup', slug: 'account-setup', href: '/docs/getting-started/account-setup' },
      { title: 'First Project', slug: 'first-project', href: '/docs/getting-started/first-project' },
      { title: 'Connecting Sources', slug: 'connecting-sources', href: '/docs/getting-started/connecting-sources' },
      { title: 'Embedding the Widget', slug: 'embedding-widget', href: '/docs/getting-started/embedding-widget' },
    ],
  },
  {
    title: 'Widget',
    slug: 'widget',
    description: 'Install, configure, and customize the Hissuno support widget.',
    items: [
      { title: 'Installation', slug: 'installation', href: '/docs/widget/installation' },
      { title: 'Configuration', slug: 'configuration', href: '/docs/widget/configuration' },
      { title: 'Authentication', slug: 'authentication', href: '/docs/widget/authentication' },
      { title: 'Headless Mode', slug: 'headless-mode', href: '/docs/widget/headless-mode' },
      { title: 'Custom Hook', slug: 'custom-hook', href: '/docs/widget/custom-hook' },
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
      { title: 'Jira Sync', slug: 'jira-sync', href: '/docs/issues/jira-sync' },
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
      { title: 'GitHub', slug: 'github', href: '/docs/integrations/github' },
      { title: 'Slack', slug: 'slack', href: '/docs/integrations/slack' },
      { title: 'Intercom', slug: 'intercom', href: '/docs/integrations/intercom' },
      { title: 'Gong', slug: 'gong', href: '/docs/integrations/gong' },
      { title: 'Jira', slug: 'jira', href: '/docs/integrations/jira' },
    ],
  },
  {
    title: 'Agents',
    slug: 'agents',
    description: 'AI agents that power support, product analysis, and automation.',
    items: [
      { title: 'Support Agent', slug: 'support-agent', href: '/docs/agents/support-agent' },
      { title: 'PM Agent', slug: 'pm-agent', href: '/docs/agents/pm-agent' },
    ],
  },
  {
    title: 'API',
    slug: 'api',
    description: 'Programmatic access to Hissuno via the REST API.',
    items: [
      { title: 'Overview', slug: 'overview', href: '/docs/api/overview' },
      { title: 'Authentication', slug: 'authentication', href: '/docs/api/authentication' },
      { title: 'Widget API', slug: 'widget-api', href: '/docs/api/widget-api' },
    ],
  },
]

export function getCategoryTitle(slug: string): string | undefined {
  return DOCS_NAV.find((cat) => cat.slug === slug)?.title
}

interface AdjacentPages {
  prev: { title: string; href: string; category: string } | null
  next: { title: string; href: string; category: string } | null
}

export function getAdjacentPages(category: string, slug: string): AdjacentPages {
  const allPages: { title: string; href: string; category: string; categorySlug: string }[] = []

  for (const cat of DOCS_NAV) {
    for (const item of cat.items) {
      allPages.push({ title: item.title, href: item.href, category: cat.title, categorySlug: cat.slug })
    }
  }

  const currentIndex = allPages.findIndex((p) => p.categorySlug === category && p.href.endsWith(`/${slug}`))

  return {
    prev: currentIndex > 0 ? allPages[currentIndex - 1] : null,
    next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null,
  }
}
