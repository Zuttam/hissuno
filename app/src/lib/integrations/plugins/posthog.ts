/**
 * PostHog plugin — connect-only.
 *
 * Auth: Personal API Key + host + project id.
 * Sync logic lives in `src/lib/automations/skills/posthog-behavioral/`.
 */

import { definePlugin } from '../plugin-kit'
import { PosthogClient } from '../posthog/client'

interface PosthogCredentials {
  apiKey: string
  host: string
  posthogProjectId: string
}

export const posthogPlugin = definePlugin({
  id: 'posthog',
  name: 'PostHog',
  description: 'Enrich contacts with product-usage signals and create behavioral sessions.',
  category: 'analytics',
  icon: { src: '/logos/posthog.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      { id: 'apiKey', label: 'Personal API Key', secret: true, required: true, helpText: 'PostHog → Settings → Personal API Keys.' },
      { id: 'host', label: 'Host', placeholder: 'https://us.posthog.com', required: true },
      { id: 'posthogProjectId', label: 'Project ID', placeholder: '12345', required: true },
    ],
    test: async (credentials) => {
      const apiKey = String(credentials.apiKey ?? '').trim()
      const host = String(credentials.host ?? '').trim() || 'https://app.posthog.com'
      const posthogProjectId = String(credentials.posthogProjectId ?? '').trim()
      if (!apiKey || !posthogProjectId) throw new Error('API key and project ID are required.')
      const client = new PosthogClient(apiKey, host, posthogProjectId)
      const info = await client.testConnection()
      return {
        externalAccountId: `${new URL(host).host}/${info.projectId}`,
        accountLabel: info.projectName || `PostHog ${info.projectId}`,
        credentials: { apiKey, host, posthogProjectId } satisfies PosthogCredentials,
      }
    },
  },
})
