/**
 * hissuno types — List available resource types
 */

import { Command } from 'commander'
import { formatResourceTypes, renderJson } from '../lib/output.js'

const RESOURCE_TYPE_DEFINITIONS = {
  knowledge: {
    description: 'Knowledge sources (codebases, documents, URLs, Notion pages).',
    filters: [],
    search: 'Semantic vector search across all knowledge chunks',
    add: null,
  },
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
    description: 'Product scopes (product areas and initiatives) with goals.',
    filters: ['type'],
    search: 'Semantic vector search with text fallback',
    add: { required: ['name'], optional: ['slug', 'description', 'type', 'color', 'goals'] },
    update: { optional: ['name', 'type', 'description', 'goals'] },
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
