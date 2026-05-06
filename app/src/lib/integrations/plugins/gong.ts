/**
 * Gong plugin — connect-only.
 *
 * Auth: Basic auth (access key + access key secret + region base URL).
 * Sync logic lives in `src/lib/automations/skills/gong-calls/`.
 */

import { definePlugin } from '../plugin-kit'
import { GongClient } from '../gong/client'

interface GongCredentials {
  accessKey: string
  accessKeySecret: string
  baseUrl: string
}

export const gongPlugin = definePlugin({
  id: 'gong',
  name: 'Gong',
  description: 'Sync Gong calls and transcripts as sessions.',
  category: 'sessions',
  icon: { src: '/logos/gong.svg' },
  multiInstance: true,

  auth: {
    type: 'api_key',
    fields: [
      { id: 'accessKey', label: 'Access Key', secret: true, required: true },
      { id: 'accessKeySecret', label: 'Access Key Secret', secret: true, required: true },
      {
        id: 'baseUrl',
        label: 'API Base URL',
        placeholder: 'https://us-12345.api.gong.io',
        required: true,
        helpText: 'Region-specific base URL from Gong API settings.',
      },
    ],
    test: async (credentials) => {
      const accessKey = String(credentials.accessKey ?? '').trim()
      const accessKeySecret = String(credentials.accessKeySecret ?? '').trim()
      const baseUrl = String(credentials.baseUrl ?? '').trim()
      if (!accessKey || !accessKeySecret || !baseUrl) {
        throw new Error('Access key, secret, and base URL are required.')
      }
      const client = new GongClient(accessKey, accessKeySecret, baseUrl)
      await client.testConnection()
      const host = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`).host
      return {
        externalAccountId: host,
        accountLabel: host,
        credentials: { accessKey, accessKeySecret, baseUrl } satisfies GongCredentials,
      }
    },
  },
})
