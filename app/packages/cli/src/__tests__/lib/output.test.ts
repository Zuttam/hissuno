import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  renderMarkdown,
  renderJson,
  success,
  error,
  warn,
  formatResourceList,
  formatResourceDetail,
  formatSearchResults,
  formatResourceTypes,
} from '../../lib/output.js'

describe('renderMarkdown', () => {
  it('renders h1 headers with bold cyan', () => {
    const result = renderMarkdown('# Hello')
    expect(result).toContain('\x1b[1m')
    expect(result).toContain('\x1b[36m')
    expect(result).toContain('Hello')
    expect(result).not.toContain('# ')
  })

  it('renders h2 headers with bold', () => {
    const result = renderMarkdown('## Section')
    expect(result).toContain('\x1b[1m')
    expect(result).toContain('Section')
  })

  it('renders bold text', () => {
    const result = renderMarkdown('**Status:** Connected')
    expect(result).toContain('\x1b[1m')
    expect(result).toContain('Status:')
    expect(result).toContain('Connected')
    expect(result).not.toContain('**')
  })

  it('renders inline code with dim', () => {
    const result = renderMarkdown('Run `hissuno setup` to start')
    expect(result).toContain('\x1b[2m')
    expect(result).toContain('hissuno setup')
    expect(result).not.toContain('`')
  })
})

describe('renderJson', () => {
  it('returns valid indented JSON', () => {
    const data = { connected: true, name: 'test' }
    const result = renderJson(data)
    expect(JSON.parse(result)).toEqual(data)
    expect(result).toContain('  ')
  })
})

describe('success/error/warn', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('success prints green text', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    success('Done!')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Done!'))
  })

  it('error prints red text', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    error('Failed!')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('\x1b[31m'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Failed!'))
  })

  it('warn prints yellow text', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warn('Careful!')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('\x1b[33m'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Careful!'))
  })
})

describe('formatResourceList', () => {
  it('shows empty state when no items', () => {
    const result = formatResourceList('feedback', [], 0)
    expect(result).toContain('Feedback (0 total)')
    expect(result).toContain('No results found')
  })

  it('formats feedback items with source and status', () => {
    const items = [
      { id: 'abc123', name: 'Login issue', source: 'widget', status: 'active', message_count: 5 },
    ]
    const result = formatResourceList('feedback', items, 1)
    expect(result).toContain('Feedback (1 total)')
    expect(result).toContain('Login issue')
    expect(result).toContain('widget')
    expect(result).toContain('5 msgs')
  })

  it('formats issue items with type and priority', () => {
    const items = [
      { id: 'iss-1', title: 'Fix crash', type: 'bug', priority: 'high', status: 'open', session_count: 3 },
    ]
    const result = formatResourceList('issues', items, 1)
    expect(result).toContain('Issues (1 total)')
    expect(result).toContain('Fix crash')
    expect(result).toContain('bug')
    expect(result).toContain('high')
    expect(result).toContain('3 sessions')
  })

  it('formats contact items with email', () => {
    const items = [
      { id: 'c-1', name: 'Jane Doe', email: 'jane@example.com', role: 'PM', is_champion: true },
    ]
    const result = formatResourceList('contacts', items, 1)
    expect(result).toContain('Contacts (1 total)')
    expect(result).toContain('Jane Doe')
    expect(result).toContain('jane@example.com')
    expect(result).toContain('champion')
  })

  it('formats company items with domain, stage, and ARR', () => {
    const items = [
      { id: 'co-1', name: 'Acme Corp', domain: 'acme.com', stage: 'active', arr: 120000, health_score: 85, contact_count: 3 },
    ]
    const result = formatResourceList('companies', items, 1)
    expect(result).toContain('Companies (1 total)')
    expect(result).toContain('Acme Corp')
    expect(result).toContain('acme.com')
    expect(result).toContain('active')
    expect(result).toContain('120,000')
    expect(result).toContain('3 contacts')
  })

  it('formats knowledge items with type and status', () => {
    const items = [
      { id: 'k-1', name: 'API Docs', type: 'website', status: 'done', url: 'https://docs.example.com' },
    ]
    const result = formatResourceList('knowledge', items, 1)
    expect(result).toContain('Knowledge (1 total)')
    expect(result).toContain('API Docs')
    expect(result).toContain('website')
  })
})

describe('formatResourceDetail', () => {
  it('shows feedback detail with messages', () => {
    const item = { id: 'f-1', name: 'Bug report', source: 'slack', status: 'active', message_count: 2 }
    const extra = { messages: [{ sender_type: 'user', content: 'It crashed!' }] }
    const result = formatResourceDetail('feedback', item, extra)
    expect(result).toContain('Bug report')
    expect(result).toContain('slack')
    expect(result).toContain('Customer:')
    expect(result).toContain('It crashed!')
  })

  it('shows issue detail with description', () => {
    const item = { id: 'i-1', title: 'Fix login', type: 'bug', priority: 'high', status: 'open', description: 'Users cannot log in.' }
    const result = formatResourceDetail('issues', item)
    expect(result).toContain('Fix login')
    expect(result).toContain('bug')
    expect(result).toContain('high')
    expect(result).toContain('Users cannot log in.')
  })

  it('shows contact detail with email and role', () => {
    const item = { id: 'c-1', name: 'John', email: 'john@co.com', role: 'CTO', is_champion: true }
    const result = formatResourceDetail('contacts', item)
    expect(result).toContain('John')
    expect(result).toContain('john@co.com')
    expect(result).toContain('CTO')
    expect(result).toContain('Yes')
  })

  it('shows company detail with domain, ARR, stage, and contacts list', () => {
    const item = {
      id: 'co-1', name: 'Acme Corp', domain: 'acme.com', industry: 'SaaS',
      arr: 120000, stage: 'active', plan_tier: 'enterprise', employee_count: 50,
      health_score: 85, contacts: [{ id: 'c1', name: 'Jane', email: 'jane@acme.com' }],
    }
    const result = formatResourceDetail('companies', item)
    expect(result).toContain('Acme Corp')
    expect(result).toContain('acme.com')
    expect(result).toContain('SaaS')
    expect(result).toContain('120,000')
    expect(result).toContain('active')
    expect(result).toContain('enterprise')
    expect(result).toContain('50')
    expect(result).toContain('85')
    expect(result).toContain('Jane')
    expect(result).toContain('jane@acme.com')
  })
})

describe('formatSearchResults', () => {
  it('shows empty state when no results', () => {
    const result = formatSearchResults([])
    expect(result).toContain('Search Results (0 found)')
    expect(result).toContain('No results found')
  })

  it('formats results with type, name, and score', () => {
    const results = [
      { id: 's-1', type: 'feedback', name: 'Login bug', snippet: 'User reported login failure', score: 0.85 },
      { id: 'i-1', type: 'issues', name: 'Auth failure', snippet: 'Authentication breaks on mobile', score: 0.72 },
    ]
    const result = formatSearchResults(results)
    expect(result).toContain('Search Results (2 found)')
    expect(result).toContain('[feedback]')
    expect(result).toContain('Login bug')
    expect(result).toContain('85%')
    expect(result).toContain('[issues]')
    expect(result).toContain('Auth failure')
    expect(result).toContain('72%')
  })
})

describe('formatResourceTypes', () => {
  it('includes all resource types', () => {
    const result = formatResourceTypes()
    expect(result).toContain('knowledge')
    expect(result).toContain('feedback')
    expect(result).toContain('issues')
    expect(result).toContain('customers')
  })

  it('includes filter information', () => {
    const result = formatResourceTypes()
    expect(result).toContain('--source')
    expect(result).toContain('--issue-type')
    expect(result).toContain('--company-id')
    expect(result).toContain('--customer-type')
  })
})
