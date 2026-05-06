/**
 * HubSpot plugin — connect-only.
 *
 * Auth: OAuth 2.0 (rotating refresh tokens).
 * Sync logic lives in `src/lib/automations/skills/hubspot-companies/` and
 * `src/lib/automations/skills/hubspot-contacts/`.
 */

import { definePlugin, type Credentials } from '../plugin-kit'
import { HubSpotClient } from '../hubspot/client'
import { refreshHubSpotToken } from '../hubspot/oauth'

interface HubSpotCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  portalId?: string
}

export const hubspotPlugin = definePlugin({
  id: 'hubspot',
  name: 'HubSpot',
  description: 'Sync contacts and companies from HubSpot CRM.',
  category: 'customer_data',
  icon: { src: '/logos/hubspot.svg' },
  multiInstance: true,

  auth: {
    type: 'oauth2',
    scopes: ['crm.objects.contacts.read', 'crm.objects.companies.read', 'oauth'],
    authorizeUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET',
    onTokenExchanged: async (tokens) => {
      const client = new HubSpotClient(tokens.accessToken)
      const account = await client.getAccountInfo()
      return {
        externalAccountId: String(account.portalId),
        accountLabel: account.uiDomain || `Portal ${account.portalId}`,
        credentials: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt?.toISOString(),
          portalId: String(account.portalId),
        } satisfies HubSpotCredentials,
        settings: {
          portalId: account.portalId,
          accountType: account.accountType,
          uiDomain: account.uiDomain,
        },
      }
    },
    // HubSpot rotates refresh tokens — custom refresh call to preserve them.
    refresh: async (credentials) => {
      const refreshToken = String(credentials.refreshToken ?? '')
      if (!refreshToken) throw new Error('HubSpot refresh token missing.')
      const clientId = process.env.HUBSPOT_CLIENT_ID
      const clientSecret = process.env.HUBSPOT_CLIENT_SECRET
      if (!clientId || !clientSecret) throw new Error('HubSpot OAuth is not configured.')
      const tokens = await refreshHubSpotToken({ refreshToken, clientId, clientSecret })
      const next: Credentials = {
        ...credentials,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      }
      return next
    },
  },
})
