/**
 * HubSpot plugin — sync CRM companies and contacts.
 *
 * Auth: OAuth 2.0 (rotating refresh tokens).
 * Streams: companies, contacts.
 */

import { z } from 'zod'
import {
  definePlugin,
  type SyncCtx,
  type Credentials,
} from '../plugin-kit'
import {
  HubSpotClient,
  HubSpotApiError,
  HubSpotRateLimitError,
  type HubSpotCompany,
  type HubSpotContact,
} from '../hubspot/client'
import {
  mapHubSpotCompany,
  mapHubSpotContact,
  toMergeStrategy,
} from '../hubspot/sync-helpers'
type OverwritePolicy = 'fill_nulls' | 'hubspot_wins' | 'never_overwrite'
import { refreshHubSpotToken } from '../hubspot/oauth'

const filterSchema = z.object({
  overwritePolicy: z.enum(['fill_nulls', 'hubspot_wins', 'never_overwrite']).optional(),
})

type HubspotFilters = z.infer<typeof filterSchema>

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

  streams: {
    companies: {
      kind: 'companies',
      label: 'Companies',
      description: 'CRM companies.',
      filterSchema,
      defaultFilters: { overwritePolicy: 'fill_nulls' },
      sync: runCompaniesSync,
    },
    contacts: {
      kind: 'contacts',
      label: 'Contacts',
      description: 'CRM contacts with company associations.',
      filterSchema,
      defaultFilters: { overwritePolicy: 'fill_nulls' },
      sync: runContactsSync,
    },
  },
})

async function runCompaniesSync(ctx: SyncCtx<Record<string, unknown>, HubspotFilters>) {
  const creds = ctx.credentials as unknown as HubSpotCredentials
  if (!creds.accessToken) throw new Error('HubSpot access token missing.')
  const client = new HubSpotClient(creds.accessToken)
  const overwritePolicy = (ctx.filters.overwritePolicy ?? 'fill_nulls') as OverwritePolicy
  const mergeStrategy = toMergeStrategy(overwritePolicy)

  const fromDate =
    ctx.syncMode === 'incremental' && ctx.lastSyncAt ? ctx.lastSyncAt : undefined

  try {
    let total = 0
    for await (const company of client.searchCompanies({
      fromDate,
      signal: ctx.signal,
      onProgress: (f, t) => {
        total = t
        ctx.progress({ type: 'found', current: f, total, message: `Scanning... ${f}/${total}` })
      },
    })) {
      if (ctx.signal.aborted) break
      try {
        const sessionId = await ingestCompany(ctx, company, mergeStrategy)
        if (sessionId) {
          ctx.progress({
            type: 'synced',
            externalId: company.id,
            hissunoId: sessionId,
            message: `Synced ${company.properties.name ?? company.id}`,
          })
        } else {
          ctx.progress({ type: 'skipped', externalId: company.id, message: `Skipped ${company.id}` })
        }
      } catch (err) {
        ctx.logger.error('company ingest failed', {
          companyId: company.id,
          error: err instanceof Error ? err.message : String(err),
        })
        ctx.progress({ type: 'failed', externalId: company.id, message: String(err) })
      }
    }
  } catch (err) {
    if (err instanceof HubSpotRateLimitError) {
      throw new Error(`Rate limit exceeded. Retry after ${err.retryAfter}s.`)
    }
    if (err instanceof HubSpotApiError) {
      throw new Error(`HubSpot API error: ${err.message}`)
    }
    throw err
  }
}

async function runContactsSync(ctx: SyncCtx<Record<string, unknown>, HubspotFilters>) {
  const creds = ctx.credentials as unknown as HubSpotCredentials
  if (!creds.accessToken) throw new Error('HubSpot access token missing.')
  const client = new HubSpotClient(creds.accessToken)
  const overwritePolicy = (ctx.filters.overwritePolicy ?? 'fill_nulls') as OverwritePolicy
  const mergeStrategy = toMergeStrategy(overwritePolicy)

  const fromDate =
    ctx.syncMode === 'incremental' && ctx.lastSyncAt ? ctx.lastSyncAt : undefined

  try {
    let total = 0
    for await (const contact of client.searchContacts({
      fromDate,
      signal: ctx.signal,
      onProgress: (f, t) => {
        total = t
        ctx.progress({ type: 'found', current: f, total, message: `Scanning... ${f}/${total}` })
      },
    })) {
      if (ctx.signal.aborted) break
      try {
        const contactId = await ingestContact(ctx, contact, mergeStrategy)
        if (contactId) {
          ctx.progress({
            type: 'synced',
            externalId: contact.id,
            hissunoId: contactId,
            message: `Synced ${contact.properties.email ?? contact.id}`,
          })
        } else {
          ctx.progress({ type: 'skipped', externalId: contact.id, message: `Skipped ${contact.id}` })
        }
      } catch (err) {
        ctx.logger.error('contact ingest failed', {
          contactId: contact.id,
          error: err instanceof Error ? err.message : String(err),
        })
        ctx.progress({ type: 'failed', externalId: contact.id, message: String(err) })
      }
    }
  } catch (err) {
    if (err instanceof HubSpotRateLimitError) {
      throw new Error(`Rate limit exceeded. Retry after ${err.retryAfter}s.`)
    }
    if (err instanceof HubSpotApiError) {
      throw new Error(`HubSpot API error: ${err.message}`)
    }
    throw err
  }
}

async function ingestCompany(
  ctx: SyncCtx<Record<string, unknown>, HubspotFilters>,
  company: HubSpotCompany,
  mergeStrategy: 'fill_nulls' | 'overwrite' | 'never_overwrite'
): Promise<string | null> {
  const mapped = mapHubSpotCompany(company)
  if (!mapped.domain) return null
  const result = await ctx.ingest.company({
    externalId: company.id,
    domain: mapped.domain,
    name: mapped.name ?? undefined,
    industry: mapped.industry,
    country: mapped.country,
    employeeCount: mapped.employeeCount,
    notes: mapped.notes,
    customFields: mapped.customFields,
    mergeStrategy,
  })
  return result.companyId
}

async function ingestContact(
  ctx: SyncCtx<Record<string, unknown>, HubspotFilters>,
  contact: HubSpotContact,
  mergeStrategy: 'fill_nulls' | 'overwrite' | 'never_overwrite'
): Promise<string | null> {
  const mapped = mapHubSpotContact(contact)
  if (!mapped.email) return null

  let companyId: string | null | undefined = null
  const companyName = contact.properties.company?.trim()
  if (companyName) {
    try {
      const companyResult = await ctx.ingest.company({
        externalId: `company:${companyName}`,
        domain: companyName.toLowerCase().replace(/\s+/g, '-'),
        name: companyName,
        mergeStrategy: 'fill_nulls',
      })
      companyId = companyResult.companyId
    } catch (err) {
      ctx.logger.warn('failed to upsert company for contact', {
        contactId: contact.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const result = await ctx.ingest.contact({
    externalId: contact.id,
    email: mapped.email,
    name: mapped.name ?? mapped.email,
    phone: mapped.phone,
    title: mapped.title,
    companyId,
    customFields: mapped.customFields,
    mergeStrategy,
  })
  return result.contactId
}
