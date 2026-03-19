import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before imports
vi.mock('../../lib/config.js', () => ({
  requireConfig: () => ({ api_key: 'test-key', base_url: 'http://localhost:3000', project_id: 'proj-1' }),
}))

vi.mock('../../lib/api.js', () => ({
  apiCall: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { contacts: [], total: 0 } }),
  resolveProjectId: vi.fn().mockResolvedValue('proj-1'),
  buildPath: vi.fn((path: string, params: Record<string, unknown>) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return path
    const qs = entries.map(([k, v]) => `${k}=${v}`).join('&')
    return `${path}?${qs}`
  }),
}))

vi.mock('../../lib/output.js', () => ({
  formatResourceList: vi.fn().mockReturnValue('formatted-list'),
  formatResourceDetail: vi.fn().mockReturnValue('formatted-detail'),
  formatRelatedEntities: vi.fn().mockReturnValue(''),
  formatSearchResults: vi.fn().mockReturnValue('formatted-search'),
  renderJson: vi.fn().mockReturnValue('{}'),
  error: vi.fn(),
}))

import { apiCall, buildPath, resolveProjectId } from '../../lib/api.js'
import { listCommand } from '../../commands/list.js'
import { getCommand } from '../../commands/get.js'
import { searchCommand } from '../../commands/search.js'
import { Command } from 'commander'

const mockedApiCall = vi.mocked(apiCall)
const mockedBuildPath = vi.mocked(buildPath)
const mockedResolveProjectId = vi.mocked(resolveProjectId)

function makeProgram(sub: Command): Command {
  const program = new Command()
  program.option('--json', 'JSON output')
  program.exitOverride()
  program.addCommand(sub)
  return program
}

describe('list customers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedResolveProjectId.mockResolvedValue('proj-1')
    mockedApiCall.mockResolvedValue({ ok: true, status: 200, data: { contacts: [], total: 0 } })
    mockedBuildPath.mockImplementation((path: string, params: Record<string, unknown>) => {
      const entries = Object.entries(params).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return path
      const qs = entries.map(([k, v]) => `${k}=${v}`).join('&')
      return `${path}?${qs}`
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })
  })

  it('defaults to /api/contacts endpoint', async () => {
    const program = makeProgram(listCommand)
    await program.parseAsync(['node', 'hissuno', 'list', 'customers'])

    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/contacts',
      expect.objectContaining({ projectId: 'proj-1' }),
    )
  })

  it('routes to /api/companies with --customer-type companies', async () => {
    mockedApiCall.mockResolvedValue({ ok: true, status: 200, data: { companies: [], total: 0 } })
    const program = makeProgram(listCommand)
    await program.parseAsync(['node', 'hissuno', 'list', 'customers', '--customer-type', 'companies'])

    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/companies',
      expect.objectContaining({ projectId: 'proj-1' }),
    )
  })

  it('passes --stage filter for companies', async () => {
    mockedApiCall.mockResolvedValue({ ok: true, status: 200, data: { companies: [], total: 0 } })
    const program = makeProgram(listCommand)
    await program.parseAsync(['node', 'hissuno', 'list', 'customers', '--customer-type', 'companies', '--stage', 'active'])

    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/companies',
      expect.objectContaining({ stage: 'active' }),
    )
  })

  it('passes --industry filter for companies', async () => {
    mockedApiCall.mockResolvedValue({ ok: true, status: 200, data: { companies: [], total: 0 } })
    const program = makeProgram(listCommand)
    await program.parseAsync(['node', 'hissuno', 'list', 'customers', '--customer-type', 'companies', '--industry', 'SaaS'])

    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/companies',
      expect.objectContaining({ industry: 'SaaS' }),
    )
  })
})

describe('get customers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedResolveProjectId.mockResolvedValue('proj-1')
    mockedApiCall.mockResolvedValue({ ok: true, status: 200, data: { contact: { id: 'c-1', name: 'Jane' } } })
    mockedBuildPath.mockImplementation((path: string, params: Record<string, unknown>) => {
      const entries = Object.entries(params).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return path
      const qs = entries.map(([k, v]) => `${k}=${v}`).join('&')
      return `${path}?${qs}`
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })
  })

  it('defaults to /api/contacts/<id> endpoint', async () => {
    const program = makeProgram(getCommand)
    await program.parseAsync(['node', 'hissuno', 'get', 'customers', 'c-1'])

    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/contacts/c-1',
      expect.objectContaining({ projectId: 'proj-1' }),
    )
  })

  it('routes to /api/companies/<id> with --customer-type companies', async () => {
    mockedApiCall.mockResolvedValue({ ok: true, status: 200, data: { company: { id: 'co-1', name: 'Acme' } } })
    const program = makeProgram(getCommand)
    await program.parseAsync(['node', 'hissuno', 'get', 'customers', 'co-1', '--customer-type', 'companies'])

    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/companies/co-1',
      expect.objectContaining({ projectId: 'proj-1' }),
    )
  })

  it('resolves entity type to contact by default for relationships', async () => {
    const program = makeProgram(getCommand)
    await program.parseAsync(['node', 'hissuno', 'get', 'customers', 'c-1'])

    // Second buildPath call is for relationships
    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/relationships',
      expect.objectContaining({ entityType: 'contact', entityId: 'c-1' }),
    )
  })

  it('resolves entity type to company when --customer-type companies', async () => {
    mockedApiCall.mockResolvedValue({ ok: true, status: 200, data: { company: { id: 'co-1', name: 'Acme' } } })
    const program = makeProgram(getCommand)
    await program.parseAsync(['node', 'hissuno', 'get', 'customers', 'co-1', '--customer-type', 'companies'])

    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/relationships',
      expect.objectContaining({ entityType: 'company', entityId: 'co-1' }),
    )
  })
})

describe('search customers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedResolveProjectId.mockResolvedValue('proj-1')
    mockedApiCall.mockResolvedValue({ ok: true, status: 200, data: { results: [], total: 0 } })
    mockedBuildPath.mockImplementation((path: string, params: Record<string, unknown>) => {
      const entries = Object.entries(params).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return path
      const qs = entries.map(([k, v]) => `${k}=${v}`).join('&')
      return `${path}?${qs}`
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })
  })

  it('maps --type customers to contacts in the API call', async () => {
    const program = makeProgram(searchCommand)
    await program.parseAsync(['node', 'hissuno', 'search', 'acme', '--type', 'customers'])

    expect(mockedBuildPath).toHaveBeenCalledWith(
      '/api/search',
      expect.objectContaining({ type: 'contacts' }),
    )
  })

  it('accepts customers as a valid type', async () => {
    const program = makeProgram(searchCommand)
    // Should not throw/exit for invalid type
    await program.parseAsync(['node', 'hissuno', 'search', 'acme', '--type', 'customers'])

    expect(mockedApiCall).toHaveBeenCalled()
  })
})
