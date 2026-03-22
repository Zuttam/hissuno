import { describe, it, expect } from 'vitest'
import { formatStatus } from '../../commands/integrations.js'

describe('formatStatus', () => {
  it('shows disconnected status', () => {
    const result = formatStatus('slack', { connected: false })
    expect(result).toContain('# Slack')
    expect(result).toContain('Not connected')
  })

  it('shows connected Slack with workspace details', () => {
    const result = formatStatus('slack', {
      connected: true,
      workspaceName: 'My Team',
      workspaceDomain: 'myteam',
      installedByEmail: 'user@example.com',
    })
    expect(result).toContain('Connected')
    expect(result).toContain('**Workspace:** My Team')
    expect(result).toContain('**Domain:** myteam')
    expect(result).toContain('**Installed by:** user@example.com')
  })

  it('shows connected GitHub with account', () => {
    const result = formatStatus('github', {
      connected: true,
      accountLogin: 'my-org',
      installedByEmail: 'dev@example.com',
    })
    expect(result).toContain('# GitHub')
    expect(result).toContain('**Account:** my-org')
    expect(result).toContain('**Installed by:** dev@example.com')
  })

  it('shows connected Jira with project details', () => {
    const result = formatStatus('jira', {
      connected: true,
      siteUrl: 'https://myteam.atlassian.net',
      jiraProjectKey: 'PROJ',
      issueTypeName: 'Bug',
      isConfigured: true,
      autoSyncEnabled: false,
    })
    expect(result).toContain('# Jira')
    expect(result).toContain('**Site:** https://myteam.atlassian.net')
    expect(result).toContain('**Project:** PROJ')
    expect(result).toContain('**Issue Type:** Bug')
    expect(result).toContain('**Configured:** Yes')
    expect(result).toContain('**Auto-sync:** Disabled')
  })

  it('shows connected Linear with team details', () => {
    const result = formatStatus('linear', {
      connected: true,
      organizationName: 'Acme',
      teamName: 'Engineering',
      teamKey: 'ENG',
      isConfigured: true,
      autoSyncEnabled: true,
    })
    expect(result).toContain('# Linear')
    expect(result).toContain('**Organization:** Acme')
    expect(result).toContain('**Team:** Engineering (ENG)')
    expect(result).toContain('**Auto-sync:** Enabled')
  })

  it('shows connected Intercom with sync info', () => {
    const result = formatStatus('intercom', {
      connected: true,
      workspaceName: 'Support',
      authMethod: 'token',
      syncFrequency: '24h',
      syncEnabled: true,
      lastSyncAt: '2026-01-01',
      lastSyncStatus: 'success',
      lastSyncConversationsCount: 42,
    })
    expect(result).toContain('# Intercom')
    expect(result).toContain('**Workspace:** Support')
    expect(result).toContain('**Auth Method:** token')
    expect(result).toContain('**Sync Frequency:** 24h')
    expect(result).toContain('**Sync Enabled:** Yes')
    expect(result).toContain('**Conversations Synced:** 42')
  })

  it('shows connected Gong with sync info', () => {
    const result = formatStatus('gong', {
      connected: true,
      syncFrequency: '6h',
      syncEnabled: false,
      lastSyncCallsCount: 10,
    })
    expect(result).toContain('# Gong')
    expect(result).toContain('**Sync Frequency:** 6h')
    expect(result).toContain('**Sync Enabled:** No')
    expect(result).toContain('**Calls Synced:** 10')
  })

  it('shows connected Zendesk with subdomain and sync info', () => {
    const result = formatStatus('zendesk', {
      connected: true,
      subdomain: 'acme',
      accountName: 'Acme Inc',
      syncFrequency: '1h',
      syncEnabled: true,
      lastSyncTicketsCount: 100,
    })
    expect(result).toContain('# Zendesk')
    expect(result).toContain('**Subdomain:** acme')
    expect(result).toContain('**Account:** Acme Inc')
    expect(result).toContain('**Tickets Synced:** 100')
  })

  it('shows total synced stats when available', () => {
    const result = formatStatus('gong', {
      connected: true,
      syncFrequency: '24h',
      syncEnabled: true,
      lastSyncCallsCount: 5,
      stats: { totalSynced: 250 },
    })
    expect(result).toContain('**Total Synced:** 250')
  })

  it('defaults conversation count to 0 when missing', () => {
    const result = formatStatus('intercom', {
      connected: true,
      workspaceName: 'Test',
      syncEnabled: false,
    })
    expect(result).toContain('**Conversations Synced:** 0')
  })

  it('shows connected Fathom with sync info', () => {
    const result = formatStatus('fathom', {
      connected: true,
      syncFrequency: '24h',
      syncEnabled: true,
      lastSyncAt: '2026-03-01',
      lastSyncStatus: 'success',
      lastSyncMeetingsCount: 15,
    })
    expect(result).toContain('# Fathom')
    expect(result).toContain('**Sync Frequency:** 24h')
    expect(result).toContain('**Sync Enabled:** Yes')
    expect(result).toContain('**Meetings Synced:** 15')
  })

  it('defaults Fathom meetings count to 0 when missing', () => {
    const result = formatStatus('fathom', {
      connected: true,
      syncEnabled: false,
    })
    expect(result).toContain('**Meetings Synced:** 0')
  })

  it('shows connected HubSpot with sync info', () => {
    const result = formatStatus('hubspot', {
      connected: true,
      hubName: 'Acme Hub',
      authMethod: 'token',
      syncFrequency: '6h',
      syncEnabled: true,
      overwritePolicy: 'fill_nulls',
      lastSyncCompaniesCount: 50,
      lastSyncContactsCount: 200,
    })
    expect(result).toContain('# HubSpot')
    expect(result).toContain('**Hub:** Acme Hub')
    expect(result).toContain('**Auth Method:** token')
    expect(result).toContain('**Overwrite Policy:** fill_nulls')
    expect(result).toContain('**Companies Synced:** 50')
    expect(result).toContain('**Contacts Synced:** 200')
  })

  it('defaults HubSpot counts to 0 when missing', () => {
    const result = formatStatus('hubspot', {
      connected: true,
      syncEnabled: false,
    })
    expect(result).toContain('**Companies Synced:** 0')
    expect(result).toContain('**Contacts Synced:** 0')
  })

  it('shows connected Notion with workspace', () => {
    const result = formatStatus('notion', {
      connected: true,
      workspaceName: 'My Workspace',
      authMethod: 'oauth',
    })
    expect(result).toContain('# Notion')
    expect(result).toContain('**Workspace:** My Workspace')
    expect(result).toContain('**Auth Method:** oauth')
  })
})

describe('platform constants', () => {
  it('exports are importable', async () => {
    // Just verify the module loads without errors and formatStatus is a function
    expect(typeof formatStatus).toBe('function')
  })
})
