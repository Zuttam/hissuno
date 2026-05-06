/**
 * Intercom plugin — connect-only.
 *
 * Auth: access token (paste from Intercom Developer Hub).
 * Sync logic lives in `src/lib/automations/skills/intercom-conversations/`.
 */

import { definePlugin } from '../plugin-kit'
import { IntercomClient } from '../intercom/client'

export const intercomPlugin = definePlugin({
  id: 'intercom',
  name: 'Intercom',
  description: 'Import your Intercom conversations as sessions.',
  category: 'sessions',
  icon: { src: '/logos/intercom.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      {
        id: 'accessToken',
        label: 'Access Token',
        secret: true,
        required: true,
        helpText: 'Developer Hub → Your app → Authentication → Access Token.',
      },
    ],
    test: async (credentials) => {
      const accessToken = String(credentials.accessToken ?? '').trim()
      if (!accessToken) throw new Error('Access token is required.')
      const client = new IntercomClient(accessToken)
      const workspace = await client.testConnection()
      return {
        externalAccountId: workspace.id,
        accountLabel: workspace.name || workspace.id,
        credentials: { accessToken },
        settings: { workspaceName: workspace.name, region: workspace.region },
      }
    },
  },
})
