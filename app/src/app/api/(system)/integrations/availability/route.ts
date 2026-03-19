import { NextResponse } from 'next/server'
import type { IntegrationAvailability } from '@/lib/api/integrations'

export const runtime = 'nodejs'

function checkEnvVars(vars: string[]): boolean {
  return vars.every((v) => !!process.env[v])
}

export async function GET() {
  const integrations: Record<string, IntegrationAvailability> = {
    slack: {
      available: checkEnvVars(['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET']),
      requiredEnvVars: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
    },
    github: {
      available: true,
      requiredEnvVars: [],
      oauthConfigured: checkEnvVars(['GITHUB_APP_SLUG', 'GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY']),
    },
    intercom: {
      available: checkEnvVars(['INTERCOM_CLIENT_ID', 'INTERCOM_CLIENT_SECRET']),
      requiredEnvVars: ['INTERCOM_CLIENT_ID', 'INTERCOM_CLIENT_SECRET'],
    },
    jira: {
      available: checkEnvVars(['JIRA_CLIENT_ID', 'JIRA_CLIENT_SECRET']),
      requiredEnvVars: ['JIRA_CLIENT_ID', 'JIRA_CLIENT_SECRET'],
    },
    linear: {
      available: checkEnvVars(['LINEAR_CLIENT_ID', 'LINEAR_CLIENT_SECRET']),
      requiredEnvVars: ['LINEAR_CLIENT_ID', 'LINEAR_CLIENT_SECRET'],
    },
    notion: {
      available: true,
      requiredEnvVars: [],
      oauthConfigured: checkEnvVars(['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET']),
    },
    hubspot: {
      available: checkEnvVars(['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET']),
      requiredEnvVars: ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET'],
    },
    widget: { available: true, requiredEnvVars: [] },
    gong: { available: true, requiredEnvVars: [] },
    zendesk: { available: true, requiredEnvVars: [] },
    posthog: { available: true, requiredEnvVars: [] },
    fathom: { available: true, requiredEnvVars: [] },
  }

  return NextResponse.json({ integrations })
}
