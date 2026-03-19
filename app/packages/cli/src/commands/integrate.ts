/**
 * hissuno integrate — Manage integrations
 *
 * Commands:
 *   hissuno integrate                     List all integrations with status
 *   hissuno integrate <platform>          Interactive setup/config wizard
 *   hissuno integrate <platform> status   Detailed status
 *   hissuno integrate <platform> connect  Connect (OAuth or token)
 *   hissuno integrate <platform> configure  Update settings
 *   hissuno integrate <platform> sync     Trigger manual sync
 *   hissuno integrate <platform> disconnect  Disconnect
 */

import { Command } from 'commander'
import { input, select, confirm, password } from '@inquirer/prompts'
import { requireConfig, type HissunoConfig } from '../lib/config.js'
import { apiCall, resolveProjectId, getBaseUrl } from '../lib/api.js'
import { openBrowser } from '../lib/browser.js'
import { renderMarkdown, renderJson, success, error, warn } from '../lib/output.js'

export const PLATFORMS = ['intercom', 'gong', 'zendesk', 'slack', 'github', 'jira', 'linear'] as const
export type Platform = (typeof PLATFORMS)[number]

export const OAUTH_PLATFORMS: Platform[] = ['slack', 'github', 'jira', 'linear']
const TOKEN_PLATFORMS: Platform[] = ['gong', 'zendesk']
const HYBRID_PLATFORMS: Platform[] = ['intercom'] // supports both token and OAuth
const SYNCABLE_PLATFORMS: Platform[] = ['intercom', 'gong', 'zendesk']

export const PLATFORM_LABELS: Record<Platform, string> = {
  intercom: 'Intercom',
  gong: 'Gong',
  zendesk: 'Zendesk',
  slack: 'Slack',
  github: 'GitHub',
  jira: 'Jira',
  linear: 'Linear',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getProjectId(config: HissunoConfig): Promise<string> {
  return resolveProjectId(config)
}

export async function getStatus(config: HissunoConfig, platform: Platform, projectId: string) {
  return apiCall(config, 'GET', `/api/integrations/${platform}?projectId=${projectId}`)
}

export function formatStatus(platform: Platform, data: Record<string, unknown>): string {
  const lines: string[] = [`# ${PLATFORM_LABELS[platform]}`, '']

  const connected = data.connected as boolean
  lines.push(`**Status:** ${connected ? 'Connected' : 'Not connected'}`)

  if (!connected) return lines.join('\n')

  // Platform-specific details
  if (platform === 'slack') {
    if (data.workspaceName) lines.push(`**Workspace:** ${data.workspaceName}`)
    if (data.workspaceDomain) lines.push(`**Domain:** ${data.workspaceDomain}`)
    if (data.installedByEmail) lines.push(`**Installed by:** ${data.installedByEmail}`)
  }

  if (platform === 'github') {
    if (data.accountLogin) lines.push(`**Account:** ${data.accountLogin}`)
    if (data.installedByEmail) lines.push(`**Installed by:** ${data.installedByEmail}`)
  }

  if (platform === 'jira') {
    if (data.siteUrl) lines.push(`**Site:** ${data.siteUrl}`)
    if (data.jiraProjectKey) lines.push(`**Project:** ${data.jiraProjectKey}`)
    if (data.issueTypeName) lines.push(`**Issue Type:** ${data.issueTypeName}`)
    lines.push(`**Configured:** ${data.isConfigured ? 'Yes' : 'No'}`)
    lines.push(`**Auto-sync:** ${data.autoSyncEnabled ? 'Enabled' : 'Disabled'}`)
  }

  if (platform === 'linear') {
    if (data.organizationName) lines.push(`**Organization:** ${data.organizationName}`)
    if (data.teamName) lines.push(`**Team:** ${data.teamName} (${data.teamKey})`)
    lines.push(`**Configured:** ${data.isConfigured ? 'Yes' : 'No'}`)
    lines.push(`**Auto-sync:** ${data.autoSyncEnabled ? 'Enabled' : 'Disabled'}`)
  }

  if (platform === 'intercom') {
    if (data.workspaceName) lines.push(`**Workspace:** ${data.workspaceName}`)
    if (data.authMethod) lines.push(`**Auth Method:** ${data.authMethod}`)
    if (data.syncFrequency) lines.push(`**Sync Frequency:** ${data.syncFrequency}`)
    lines.push(`**Sync Enabled:** ${data.syncEnabled ? 'Yes' : 'No'}`)
    if (data.lastSyncAt) lines.push(`**Last Sync:** ${data.lastSyncAt}`)
    if (data.lastSyncStatus) lines.push(`**Last Sync Status:** ${data.lastSyncStatus}`)
    lines.push(`**Conversations Synced:** ${data.lastSyncConversationsCount ?? 0}`)
  }

  if (platform === 'gong') {
    if (data.syncFrequency) lines.push(`**Sync Frequency:** ${data.syncFrequency}`)
    lines.push(`**Sync Enabled:** ${data.syncEnabled ? 'Yes' : 'No'}`)
    if (data.lastSyncAt) lines.push(`**Last Sync:** ${data.lastSyncAt}`)
    if (data.lastSyncStatus) lines.push(`**Last Sync Status:** ${data.lastSyncStatus}`)
    lines.push(`**Calls Synced:** ${data.lastSyncCallsCount ?? 0}`)
  }

  if (platform === 'zendesk') {
    if (data.subdomain) lines.push(`**Subdomain:** ${data.subdomain}`)
    if (data.accountName) lines.push(`**Account:** ${data.accountName}`)
    if (data.syncFrequency) lines.push(`**Sync Frequency:** ${data.syncFrequency}`)
    lines.push(`**Sync Enabled:** ${data.syncEnabled ? 'Yes' : 'No'}`)
    if (data.lastSyncAt) lines.push(`**Last Sync:** ${data.lastSyncAt}`)
    if (data.lastSyncStatus) lines.push(`**Last Sync Status:** ${data.lastSyncStatus}`)
    lines.push(`**Tickets Synced:** ${data.lastSyncTicketsCount ?? 0}`)
  }

  // Sync stats if available
  const stats = data.stats as { totalSynced?: number } | null
  if (stats?.totalSynced != null) {
    lines.push(`**Total Synced:** ${stats.totalSynced}`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Connection flows
// ---------------------------------------------------------------------------

export async function connectOAuth(
  config: HissunoConfig,
  platform: Platform,
  projectId: string,
): Promise<boolean> {
  const appUrl = getBaseUrl(config)
  // OAuth connect endpoints require a browser session (not API key auth),
  // so we open the dashboard integrations page where the user is already logged in.
  const connectUrl = `${appUrl}/projects/${projectId}/integrations?connect=${platform}`

  console.log(`\nOpening browser to connect ${PLATFORM_LABELS[platform]}...`)
  console.log(`URL: ${connectUrl}\n`)
  openBrowser(connectUrl)

  warn('Complete the authorization in your browser, then press Enter to verify.')
  await input({ message: 'Press Enter when done...' })

  const result = await getStatus(config, platform, projectId)
  if (result.ok && (result.data as Record<string, unknown>).connected) {
    success(`${PLATFORM_LABELS[platform]} connected successfully!`)
    return true
  }

  error(`${PLATFORM_LABELS[platform]} connection not detected. Please try again.`)
  return false
}

export async function connectGong(config: HissunoConfig, projectId: string, opts: Record<string, string>): Promise<boolean> {
  const accessKey = opts.accessKey || await input({ message: 'Access Key:', validate: (v) => v.length > 0 || 'Required' })
  const accessKeySecret = opts.accessKeySecret || await password({ message: 'Access Key Secret:', mask: '*', validate: (v) => v.length > 0 || 'Required' })
  const baseUrl = opts.baseUrl || await input({ message: 'Base URL:', default: 'https://api.gong.io' })
  const syncFrequency = opts.syncFrequency || await select({
    message: 'Sync frequency:',
    choices: [
      { value: 'manual', name: 'Manual' },
      { value: '1h', name: 'Every hour' },
      { value: '6h', name: 'Every 6 hours' },
      { value: '24h', name: 'Every 24 hours' },
    ],
    default: '24h',
  })

  console.log('\nValidating credentials...')
  const result = await apiCall(config, 'POST', '/api/integrations/gong/connect', {
    projectId,
    accessKey,
    accessKeySecret,
    baseUrl,
    syncFrequency,
  })

  if (result.ok) {
    success('Gong connected successfully!')
    return true
  }

  const data = result.data as { error?: string }
  error(`Connection failed: ${data.error || 'Unknown error'}`)
  return false
}

export async function connectZendesk(config: HissunoConfig, projectId: string, opts: Record<string, string>): Promise<boolean> {
  const subdomain = opts.subdomain || await input({ message: 'Zendesk subdomain (e.g., mycompany):', validate: (v) => v.length > 0 || 'Required' })
  const email = opts.email || await input({ message: 'Admin email:', validate: (v) => v.includes('@') || 'Must be a valid email' })
  const apiToken = opts.apiToken || await password({ message: 'API token:', mask: '*', validate: (v) => v.length > 0 || 'Required' })
  const syncFrequency = opts.syncFrequency || await select({
    message: 'Sync frequency:',
    choices: [
      { value: 'manual', name: 'Manual' },
      { value: '1h', name: 'Every hour' },
      { value: '6h', name: 'Every 6 hours' },
      { value: '24h', name: 'Every 24 hours' },
    ],
    default: '24h',
  })

  console.log('\nValidating credentials...')
  const result = await apiCall(config, 'POST', '/api/integrations/zendesk/connect', {
    projectId,
    subdomain,
    email,
    apiToken,
    syncFrequency,
  })

  if (result.ok) {
    success('Zendesk connected successfully!')
    return true
  }

  const data = result.data as { error?: string }
  error(`Connection failed: ${data.error || 'Unknown error'}`)
  return false
}

export async function connectIntercom(config: HissunoConfig, projectId: string, opts: Record<string, string>): Promise<boolean> {
  const method = opts.accessToken ? 'token' : await select({
    message: 'Connection method:',
    choices: [
      { value: 'token', name: 'API Token' },
      { value: 'oauth', name: 'OAuth (opens browser)' },
    ],
  })

  if (method === 'oauth') {
    return connectOAuth(config, 'intercom', projectId)
  }

  const accessToken = opts.accessToken || await password({ message: 'Access Token:', mask: '*', validate: (v) => v.length > 0 || 'Required' })
  const syncFrequency = opts.syncFrequency || await select({
    message: 'Sync frequency:',
    choices: [
      { value: 'manual', name: 'Manual' },
      { value: '1h', name: 'Every hour' },
      { value: '6h', name: 'Every 6 hours' },
      { value: '24h', name: 'Every 24 hours' },
    ],
    default: '24h',
  })

  console.log('\nValidating credentials...')
  const result = await apiCall(config, 'POST', '/api/integrations/intercom/connect', {
    projectId,
    accessToken,
    syncFrequency,
  })

  if (result.ok) {
    success('Intercom connected successfully!')
    return true
  }

  const data = result.data as { error?: string }
  error(`Connection failed: ${data.error || 'Unknown error'}`)
  return false
}

// ---------------------------------------------------------------------------
// Configure flow
// ---------------------------------------------------------------------------

async function configureIntegration(config: HissunoConfig, platform: Platform, projectId: string): Promise<void> {
  if (SYNCABLE_PLATFORMS.includes(platform)) {
    const syncFrequency = await select({
      message: 'Sync frequency:',
      choices: [
        { value: 'manual', name: 'Manual' },
        { value: '1h', name: 'Every hour' },
        { value: '6h', name: 'Every 6 hours' },
        { value: '24h', name: 'Every 24 hours' },
      ],
    })

    const result = await apiCall(config, 'PATCH', `/api/integrations/${platform}?projectId=${projectId}`, {
      syncFrequency,
    })

    if (result.ok) {
      success('Settings updated!')
    } else {
      const data = result.data as { error?: string }
      error(`Update failed: ${data.error || 'Unknown error'}`)
    }
    return
  }

  if (platform === 'jira' || platform === 'linear') {
    const autoSyncEnabled = await confirm({ message: 'Enable auto-sync of issues?', default: true })

    const result = await apiCall(config, 'PATCH', `/api/integrations/${platform}?projectId=${projectId}`, {
      autoSyncEnabled,
    })

    if (result.ok) {
      success('Settings updated!')
    } else {
      const data = result.data as { error?: string }
      error(`Update failed: ${data.error || 'Unknown error'}`)
    }
    return
  }

  warn(`${PLATFORM_LABELS[platform]} is configured through its connection flow or the dashboard.`)
}

// ---------------------------------------------------------------------------
// Sync flow
// ---------------------------------------------------------------------------

async function syncIntegration(config: HissunoConfig, platform: Platform, projectId: string, mode: string): Promise<void> {
  if (!SYNCABLE_PLATFORMS.includes(platform)) {
    error(`${PLATFORM_LABELS[platform]} does not support manual sync.`)
    return
  }

  const syncMode = mode || await select({
    message: 'Sync mode:',
    choices: [
      { value: 'incremental', name: 'Incremental (new items only)' },
      { value: 'full', name: 'Full (re-sync everything)' },
    ],
    default: 'incremental',
  })

  console.log(`\nSyncing ${PLATFORM_LABELS[platform]} (${syncMode})...\n`)

  // The sync endpoint uses SSE — consume the stream for progress
  const baseUrl = getBaseUrl(config)
  const url = `${baseUrl}/api/integrations/${platform}/sync?projectId=${projectId}&mode=${syncMode}`

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.api_key}` },
    })

    if (!response.ok) {
      const text = await response.text()
      try {
        const data = JSON.parse(text) as { error?: string }
        error(`Sync failed: ${data.error || `HTTP ${response.status}`}`)
      } catch {
        error(`Sync failed: HTTP ${response.status}`)
      }
      return
    }

    // Read SSE stream
    const reader = response.body?.getReader()
    if (!reader) {
      error('No response stream.')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6)) as { type: string; message?: string; current?: number; total?: number }
          if (event.type === 'progress') {
            process.stdout.write(`\r  Syncing... ${event.current ?? 0}/${event.total ?? '?'}`)
          } else if (event.type === 'complete') {
            process.stdout.write('\n')
            success(event.message || 'Sync complete!')
          } else if (event.type === 'error') {
            process.stdout.write('\n')
            error(event.message || 'Sync error.')
          }
        } catch {
          // Skip malformed events
        }
      }
    }
  } catch (err) {
    error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

// ---------------------------------------------------------------------------
// Disconnect flow
// ---------------------------------------------------------------------------

async function disconnectIntegration(config: HissunoConfig, platform: Platform, projectId: string): Promise<void> {
  const confirmed = await confirm({
    message: `Disconnect ${PLATFORM_LABELS[platform]}? This cannot be undone.`,
    default: false,
  })

  if (!confirmed) {
    console.log('Cancelled.')
    return
  }

  const result = await apiCall(config, 'DELETE', `/api/integrations/${platform}?projectId=${projectId}`)

  if (result.ok) {
    success(`${PLATFORM_LABELS[platform]} disconnected.`)
  } else {
    const data = result.data as { error?: string }
    error(`Disconnect failed: ${data.error || 'Unknown error'}`)
  }
}

// ---------------------------------------------------------------------------
// Interactive wizard
// ---------------------------------------------------------------------------

async function interactiveWizard(config: HissunoConfig, platform: Platform, projectId: string, jsonMode: boolean): Promise<void> {
  const statusResult = await getStatus(config, platform, projectId)
  if (!statusResult.ok) {
    const data = statusResult.data as { error?: string }
    error(`Failed to get status: ${data.error || `HTTP ${statusResult.status}`}`)
    process.exit(1)
  }

  const data = statusResult.data as Record<string, unknown>

  if (jsonMode) {
    console.log(renderJson(data))
    return
  }

  console.log(renderMarkdown(formatStatus(platform, data)))

  if (!data.connected) {
    const shouldConnect = await confirm({ message: `Connect ${PLATFORM_LABELS[platform]}?`, default: true })
    if (shouldConnect) {
      if (OAUTH_PLATFORMS.includes(platform)) {
        await connectOAuth(config, platform, projectId)
      } else if (platform === 'gong') {
        await connectGong(config, projectId, {})
      } else if (platform === 'zendesk') {
        await connectZendesk(config, projectId, {})
      } else if (platform === 'intercom') {
        await connectIntercom(config, projectId, {})
      }
    }
    return
  }

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      ...(SYNCABLE_PLATFORMS.includes(platform) ? [{ value: 'configure', name: 'Configure sync settings' }] : []),
      ...(SYNCABLE_PLATFORMS.includes(platform) ? [{ value: 'sync', name: 'Trigger manual sync' }] : []),
      ...(platform === 'jira' || platform === 'linear' ? [{ value: 'configure', name: 'Configure settings' }] : []),
      { value: 'disconnect', name: 'Disconnect' },
      { value: 'cancel', name: 'Cancel' },
    ],
  })

  switch (action) {
    case 'configure':
      await configureIntegration(config, platform, projectId)
      break
    case 'sync':
      await syncIntegration(config, platform, projectId, '')
      break
    case 'disconnect':
      await disconnectIntegration(config, platform, projectId)
      break
  }
}

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

export const integrateCommand = new Command('integrate')
  .description('Manage integrations (intercom, gong, zendesk, slack, github, jira, linear)')
  .argument('[platform]', 'Integration platform')
  .argument('[action]', 'Action: status, connect, configure, sync, disconnect')
  .option('--access-key <key>', 'Gong access key')
  .option('--access-key-secret <secret>', 'Gong access key secret')
  .option('--base-url <url>', 'Gong base URL')
  .option('--subdomain <subdomain>', 'Zendesk subdomain')
  .option('--email <email>', 'Zendesk admin email')
  .option('--api-token <token>', 'Zendesk API token')
  .option('--access-token <token>', 'Intercom access token')
  .option('--sync-frequency <freq>', 'Sync frequency: manual, 1h, 6h, 24h')
  .option('--mode <mode>', 'Sync mode: incremental, full')
  .action(async (platformArg, actionArg, opts, cmd) => {
    const config = requireConfig()
    const jsonMode = cmd.parent?.opts().json

    const projectId = await getProjectId(config)

    // No platform: list all integrations
    if (!platformArg) {
      const results = await Promise.all(
        PLATFORMS.map(async (p) => {
          const result = await getStatus(config, p, projectId)
          return {
            platform: p,
            name: PLATFORM_LABELS[p],
            connected: result.ok ? (result.data as Record<string, unknown>).connected === true : false,
            data: result.ok ? result.data : null,
          }
        })
      )

      if (jsonMode) {
        console.log(renderJson(results))
        return
      }

      console.log(renderMarkdown('# Integrations\n'))
      for (const r of results) {
        const status = r.connected ? '\x1b[32mConnected\x1b[0m' : '\x1b[2mNot connected\x1b[0m'
        console.log(`  ${r.name.padEnd(12)} ${status}`)
      }
      console.log('\nRun `hissuno integrate <platform>` to manage a specific integration.')
      return
    }

    // Validate platform
    const platform = platformArg.toLowerCase() as Platform
    if (!PLATFORMS.includes(platform)) {
      error(`Unknown platform "${platformArg}". Supported: ${PLATFORMS.join(', ')}`)
      process.exit(1)
    }

    // No action: interactive wizard
    if (!actionArg) {
      await interactiveWizard(config, platform, projectId, jsonMode)
      return
    }

    const action = actionArg.toLowerCase()

    switch (action) {
      case 'status': {
        const result = await getStatus(config, platform, projectId)
        if (!result.ok) {
          const data = result.data as { error?: string }
          error(`Failed: ${data.error || `HTTP ${result.status}`}`)
          process.exit(1)
        }
        const data = result.data as Record<string, unknown>
        if (jsonMode) {
          console.log(renderJson(data))
        } else {
          console.log(renderMarkdown(formatStatus(platform, data)))
        }
        break
      }

      case 'connect': {
        // Check if already connected
        const statusResult = await getStatus(config, platform, projectId)
        if (statusResult.ok && (statusResult.data as Record<string, unknown>).connected) {
          warn(`${PLATFORM_LABELS[platform]} is already connected.`)
          return
        }

        if (OAUTH_PLATFORMS.includes(platform)) {
          await connectOAuth(config, platform, projectId)
        } else if (platform === 'gong') {
          await connectGong(config, projectId, {
            accessKey: opts.accessKey || '',
            accessKeySecret: opts.accessKeySecret || '',
            baseUrl: opts.baseUrl || '',
            syncFrequency: opts.syncFrequency || '',
          })
        } else if (platform === 'zendesk') {
          await connectZendesk(config, projectId, {
            subdomain: opts.subdomain || '',
            email: opts.email || '',
            apiToken: opts.apiToken || '',
            syncFrequency: opts.syncFrequency || '',
          })
        } else if (platform === 'intercom') {
          await connectIntercom(config, projectId, {
            accessToken: opts.accessToken || '',
            syncFrequency: opts.syncFrequency || '',
          })
        }
        break
      }

      case 'configure': {
        const statusResult = await getStatus(config, platform, projectId)
        if (!statusResult.ok || !(statusResult.data as Record<string, unknown>).connected) {
          error(`${PLATFORM_LABELS[platform]} is not connected. Run 'hissuno integrate ${platform} connect' first.`)
          process.exit(1)
        }
        await configureIntegration(config, platform, projectId)
        break
      }

      case 'sync': {
        const statusResult = await getStatus(config, platform, projectId)
        if (!statusResult.ok || !(statusResult.data as Record<string, unknown>).connected) {
          error(`${PLATFORM_LABELS[platform]} is not connected.`)
          process.exit(1)
        }
        await syncIntegration(config, platform, projectId, opts.mode || '')
        break
      }

      case 'disconnect': {
        const statusResult = await getStatus(config, platform, projectId)
        if (!statusResult.ok || !(statusResult.data as Record<string, unknown>).connected) {
          error(`${PLATFORM_LABELS[platform]} is not connected.`)
          return
        }
        await disconnectIntegration(config, platform, projectId)
        break
      }

      default:
        error(`Unknown action "${action}". Valid actions: status, connect, configure, sync, disconnect`)
        process.exit(1)
    }
  })
