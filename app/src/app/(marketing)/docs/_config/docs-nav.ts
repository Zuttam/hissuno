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
      { title: 'Quickstart', slug: 'quickstart', href: '/docs/getting-started/quickstart' },
      { title: 'Account Setup', slug: 'account-setup', href: '/docs/getting-started/account-setup' },
      { title: 'First Project', slug: 'first-project', href: '/docs/getting-started/first-project' },
      { title: 'Add Your Data', slug: 'add-your-data', href: '/docs/getting-started/add-your-data' },
      { title: 'How To', slug: 'how-to', href: '/docs/getting-started/how-to' },
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
          { title: 'Sessions API', slug: 'api-sessions', href: '/docs/api/sessions' },
          { title: 'Issues API', slug: 'api-issues', href: '/docs/api/issues' },
          { title: 'Search API', slug: 'api-search', href: '/docs/api/search' },
        ],
      },
    ],
  },
  {
    title: 'Architecture',
    slug: 'architecture',
    description: 'The 3-layer architecture: base graph, automation, and execution.',
    items: [
      { title: 'Overview', slug: 'overview', href: '/docs/architecture/overview' },
      { title: 'Knowledge Graph', slug: 'knowledge-graph', href: '/docs/architecture/knowledge-graph' },
      { title: 'Embeddings', slug: 'embeddings', href: '/docs/architecture/embeddings' },
      { title: 'Graph Evaluation', slug: 'graph-evaluation', href: '/docs/architecture/graph-evaluation' },
    ],
    subsections: [
      {
        title: 'Automation',
        href: '/docs/architecture/resource-ingestion',
        items: [
          { title: 'Resource Ingestion', slug: 'resource-ingestion', href: '/docs/architecture/resource-ingestion' },
          { title: 'Issue Triage', slug: 'issue-triage', href: '/docs/architecture/issue-triage' },
        ],
      },
      {
        title: 'Execution',
        href: '/docs/architecture/support-agent',
        items: [
          { title: 'Support Agent', slug: 'support-agent', href: '/docs/architecture/support-agent' },
          { title: 'PM Copilot', slug: 'pm-copilot', href: '/docs/architecture/pm-copilot' },
          { title: 'Interfaces', slug: 'interfaces', href: '/docs/architecture/interfaces' },
        ],
      },
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
      { title: 'Troubleshooting', slug: 'troubleshooting', href: '/docs/integrations/troubleshooting' },
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
  {
    title: 'Examples',
    slug: 'examples',
    description: 'End-to-end workflow examples showcasing autonomous product agents.',
    items: [
      { title: 'Autonomous Q2 Planning', slug: 'autonomous-q2-planning', href: '/docs/examples/autonomous-q2-planning' },
      { title: 'Churn Pattern Investigation', slug: 'churn-pattern-investigation', href: '/docs/examples/churn-pattern-investigation' },
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
