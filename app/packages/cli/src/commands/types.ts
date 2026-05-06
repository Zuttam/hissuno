/**
 * hissuno types — List available resource types
 */

import { Command } from 'commander'
import { formatResourceTypes, renderJson } from '../lib/output.js'

const RESOURCE_TYPE_DEFINITIONS = {
  feedback: {
    description: 'Customer feedback sessions (conversations from widget, Slack, Intercom, etc.).',
    filters: ['source', 'status', 'tags', 'contact_id', 'search'],
    search: 'Semantic vector search (full-text fallback)',
    add: { required: ['messages'], optional: ['name', 'tags'] },
  },
  issues: {
    description: 'Product issues (bugs, feature requests, change requests).',
    filters: ['type', 'priority', 'status', 'search'],
    search: 'Semantic vector search for similar issues',
    add: { required: ['type', 'title', 'description'], optional: ['priority'] },
  },
  customers: {
    description: 'Customers (contacts and companies). Use --customer-type to select (default: contacts).',
    filters: ['customer_type', 'search', 'company_id', 'role', 'stage', 'industry'],
    search: 'Semantic vector search (contacts only, name/email fallback)',
    add: {
      contacts: { required: ['name', 'email'], optional: ['role', 'title', 'phone', 'company_id', 'is_champion'] },
      companies: { required: ['name', 'domain'], optional: ['industry', 'arr', 'stage', 'employee_count', 'plan_tier', 'country', 'notes'] },
    },
  },
  scopes: {
    description: 'Product scopes (product areas, initiatives, and experiments) with goals and hierarchical nesting. Reference docs are scope-attached; see `knowledge`.',
    filters: ['type'],
    search: 'Semantic vector search with text fallback',
    add: { required: ['name'], optional: ['slug', 'description', 'type', 'color', 'goals', 'parent_id', 'content'] },
    update: { optional: ['name', 'type', 'description', 'goals', 'parent_id', 'content'] },
  },
  knowledge: {
    description: 'Reference docs (websites, docs portals, Notion pages, uploaded files, raw text) attached to a product scope. `--scope` selects a specific scope; otherwise the project root scope is used.',
    filters: ['scope'],
    search: 'Semantic vector search across analyzed content',
    add: { required: ['type'], optional: ['scope', 'url', 'content', 'name', 'description'] },
  },
  codebase: {
    description: 'Project codebases (GitHub repositories). Cloned and analyzed on demand. Optionally linked to one or more product scopes.',
    filters: [],
    search: 'Code-aware retrieval (file listing and content reads via agent tools)',
    add: { required: ['repo'], optional: ['branch', 'name', 'description', 'analysis_scope', 'scope'] },
  },
}

export const typesCommand = new Command('types')
  .description('List all available resource types and their filters')
  .action(async (_opts, cmd) => {
    const jsonMode = cmd.parent?.opts().json

    if (jsonMode) {
      console.log(renderJson(RESOURCE_TYPE_DEFINITIONS))
    } else {
      console.log(formatResourceTypes())
    }
  })
