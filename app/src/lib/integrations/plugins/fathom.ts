/**
 * Fathom plugin — connect-only.
 *
 * Auth: API key via X-Api-Key header.
 * Sync logic lives in `src/lib/automations/skills/fathom-meetings/`.
 */

import { definePlugin } from '../plugin-kit'
import { FathomClient } from '../fathom/client'

export const fathomPlugin = definePlugin({
  id: 'fathom',
  name: 'Fathom',
  description: 'Sync your Fathom meetings as sessions for analysis.',
  category: 'sessions',
  icon: { src: '/logos/fathom.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      {
        id: 'apiKey',
        label: 'API Key',
        placeholder: 'fathom_...',
        secret: true,
        required: true,
        helpText: 'Generate at Fathom Settings → API.',
      },
    ],
    test: async (credentials) => {
      const apiKey = String(credentials.apiKey ?? '').trim()
      if (!apiKey) throw new Error('API key is required.')
      const client = new FathomClient(apiKey)
      await client.testConnection()
      const accountName = (await client.getAccountName()) ?? 'Fathom'
      return {
        externalAccountId: accountName,
        accountLabel: accountName,
        credentials: { apiKey },
      }
    },
  },
})
