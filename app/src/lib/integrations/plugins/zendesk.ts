/**
 * Zendesk plugin — connect-only.
 *
 * Auth: API token (subdomain + admin email + api token).
 * Sync logic lives in `src/lib/automations/skills/zendesk-tickets/`.
 */

import { definePlugin } from '../plugin-kit'
import { ZendeskClient } from '../zendesk/client'

interface ZendeskCredentials {
  subdomain: string
  adminEmail: string
  apiToken: string
}

export const zendeskPlugin = definePlugin({
  id: 'zendesk',
  name: 'Zendesk',
  description: 'Pull solved and closed tickets as sessions for analysis.',
  category: 'sessions',
  icon: { src: '/logos/zendesk.svg', darkSrc: '/logos/zendesk-dark.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      { id: 'subdomain', label: 'Subdomain', placeholder: 'acme', required: true, helpText: 'The subdomain portion of acme.zendesk.com.' },
      { id: 'adminEmail', label: 'Admin Email', placeholder: 'admin@acme.com', required: true },
      { id: 'apiToken', label: 'API Token', secret: true, required: true, helpText: 'Settings → Channels → API → Token access.' },
    ],
    test: async (credentials) => {
      const subdomain = String(credentials.subdomain ?? '').trim().toLowerCase()
      const adminEmail = String(credentials.adminEmail ?? '').trim()
      const apiToken = String(credentials.apiToken ?? '').trim()
      if (!subdomain || !adminEmail || !apiToken) {
        throw new Error('Subdomain, admin email, and API token are required.')
      }
      const client = new ZendeskClient(subdomain, adminEmail, apiToken)
      const account = await client.testConnection()
      return {
        externalAccountId: subdomain,
        accountLabel: `${subdomain}.zendesk.com`,
        credentials: { subdomain, adminEmail, apiToken } satisfies ZendeskCredentials,
        settings: { accountName: account.name, accountEmail: account.email },
      }
    },
  },
})
