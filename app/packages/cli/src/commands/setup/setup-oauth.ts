import fs from 'node:fs'
import path from 'node:path'
import { input, password, select } from '@inquirer/prompts'
import { log } from '../../lib/log.js'

const OAUTH_PLATFORMS = {
  slack: {
    label: 'Slack',
    envVars: [
      { key: 'SLACK_CLIENT_ID', prompt: 'Slack Client ID:', mask: false },
      { key: 'SLACK_CLIENT_SECRET', prompt: 'Slack Client Secret:', mask: true },
    ],
  },
  github: {
    label: 'GitHub',
    envVars: [
      { key: 'GITHUB_APP_SLUG', prompt: 'GitHub App slug:', mask: false },
      { key: 'GITHUB_APP_ID', prompt: 'GitHub App ID:', mask: false },
      { key: 'GITHUB_APP_PRIVATE_KEY', prompt: 'GitHub Private Key (base64-encoded):', mask: true },
    ],
  },
  jira: {
    label: 'Jira',
    envVars: [
      { key: 'JIRA_CLIENT_ID', prompt: 'Jira Client ID:', mask: false },
      { key: 'JIRA_CLIENT_SECRET', prompt: 'Jira Client Secret:', mask: true },
    ],
  },
  linear: {
    label: 'Linear',
    envVars: [
      { key: 'LINEAR_CLIENT_ID', prompt: 'Linear Client ID:', mask: false },
      { key: 'LINEAR_CLIENT_SECRET', prompt: 'Linear Client Secret:', mask: true },
    ],
  },
  intercom: {
    label: 'Intercom',
    envVars: [
      { key: 'INTERCOM_CLIENT_ID', prompt: 'Intercom Client ID:', mask: false },
      { key: 'INTERCOM_CLIENT_SECRET', prompt: 'Intercom Client Secret:', mask: true },
    ],
  },
} as const

export type OAuthPlatform = keyof typeof OAUTH_PLATFORMS
export const OAUTH_PLATFORM_NAMES = Object.keys(OAUTH_PLATFORMS) as OAuthPlatform[]

interface SetupOAuthOptions {
  clientId?: string
  clientSecret?: string
  appSlug?: string
  appId?: string
  privateKey?: string
}

export async function setupOAuth(
  appDir: string,
  platformArg?: string,
  opts: SetupOAuthOptions = {},
): Promise<void> {
  const platform: OAuthPlatform = platformArg
    ? validatePlatform(platformArg)
    : await select({
        message: 'Which integration?',
        choices: OAUTH_PLATFORM_NAMES.map((p) => ({
          value: p as OAuthPlatform,
          name: OAUTH_PLATFORMS[p].label,
        })),
      })

  const config = OAUTH_PLATFORMS[platform]
  const values: Record<string, string> = {}

  // Collect values - use CLI flags if provided, otherwise prompt
  for (const envVar of config.envVars) {
    const flagValue = resolveFlag(envVar.key, opts)
    if (flagValue) {
      values[envVar.key] = flagValue
    } else if (envVar.mask) {
      values[envVar.key] = await password({
        message: envVar.prompt,
        mask: '*',
        validate: (v) => v.length > 0 || 'Required',
      })
    } else {
      values[envVar.key] = await input({
        message: envVar.prompt,
        validate: (v) => v.length > 0 || 'Required',
      })
    }
  }

  // Append to .env.local
  const envPath = path.join(appDir, '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}. Run 'hissuno setup' first.`)
  }

  const existing = fs.readFileSync(envPath, 'utf-8')
  const newLines: string[] = []

  for (const [key, value] of Object.entries(values)) {
    if (existing.includes(`${key}=`)) {
      log.warn(`${key} already set in .env.local - skipping`)
    } else {
      newLines.push(`${key}=${value}`)
    }
  }

  if (newLines.length > 0) {
    const suffix = (existing.endsWith('\n') ? '' : '\n') + newLines.join('\n') + '\n'
    fs.appendFileSync(envPath, suffix)
    log.success(`${config.label} OAuth credentials added to .env.local`)
  } else {
    log.info(`${config.label} credentials already present - no changes made`)
  }

  log.info('Restart the server for changes to take effect:')
  console.log(`    npm run dev`)
  console.log()
}

function validatePlatform(name: string): OAuthPlatform {
  const lower = name.toLowerCase() as OAuthPlatform
  if (!OAUTH_PLATFORM_NAMES.includes(lower)) {
    throw new Error(
      `Unknown OAuth platform "${name}". Supported: ${OAUTH_PLATFORM_NAMES.join(', ')}`,
    )
  }
  return lower
}

function resolveFlag(envKey: string, opts: SetupOAuthOptions): string | undefined {
  switch (envKey) {
    case 'SLACK_CLIENT_ID':
    case 'JIRA_CLIENT_ID':
    case 'LINEAR_CLIENT_ID':
    case 'INTERCOM_CLIENT_ID':
      return opts.clientId
    case 'SLACK_CLIENT_SECRET':
    case 'JIRA_CLIENT_SECRET':
    case 'LINEAR_CLIENT_SECRET':
    case 'INTERCOM_CLIENT_SECRET':
      return opts.clientSecret
    case 'GITHUB_APP_SLUG':
      return opts.appSlug
    case 'GITHUB_APP_ID':
      return opts.appId
    case 'GITHUB_APP_PRIVATE_KEY':
      return opts.privateKey
    default:
      return undefined
  }
}
