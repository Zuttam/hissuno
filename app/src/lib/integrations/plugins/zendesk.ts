/**
 * Zendesk plugin — syncs solved/closed tickets as Hissuno sessions.
 *
 * Auth: API token (subdomain + admin email + api token).
 * Streams: tickets (sessions kind).
 */

import { z } from 'zod'
import { definePlugin, type SyncCtx } from '../plugin-kit'
import {
  ZendeskClient,
  ZendeskApiError,
  ZendeskRateLimitError,
  type ZendeskTicket,
  type ZendeskUser,
  type ZendeskOrganization,
} from '../zendesk/client'
import { stripHtml } from '../shared/sync-utils'
import { mapAuthorToSenderType, buildUserMetadata } from '../zendesk/sync-helpers'

const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
})

type ZendeskFilters = z.infer<typeof filterSchema>

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

  streams: {
    tickets: {
      kind: 'sessions',
      label: 'Tickets',
      description: 'Solved and closed support tickets.',
      filterSchema,
      defaultFilters: {},
      sync: runTicketsSync,
    },
  },
})

async function runTicketsSync(ctx: SyncCtx<Record<string, unknown>, ZendeskFilters>) {
  const creds = ctx.credentials as unknown as ZendeskCredentials
  if (!creds.subdomain || !creds.adminEmail || !creds.apiToken) {
    throw new Error('Zendesk credentials are incomplete.')
  }
  const client = new ZendeskClient(creds.subdomain, creds.adminEmail, creds.apiToken)

  let fromDate = ctx.filters.fromDate ? new Date(ctx.filters.fromDate) : undefined
  const toDate = ctx.filters.toDate ? new Date(ctx.filters.toDate) : undefined
  if (ctx.syncMode === 'incremental' && ctx.lastSyncAt) {
    if (!fromDate || ctx.lastSyncAt > fromDate) fromDate = ctx.lastSyncAt
  }

  const CONCURRENCY = 5
  const alreadySynced = await ctx.getSyncedIds()
  let found = 0

  const processTicket = async (ticket: ZendeskTicket) => {
    if (alreadySynced.has(String(ticket.id))) {
      ctx.progress({ type: 'skipped', externalId: String(ticket.id), message: `Skipped #${ticket.id}` })
      return
    }
    try {
      const sessionId = await ingestTicket(ctx, client, ticket)
      if (sessionId) {
        ctx.progress({
          type: 'synced',
          externalId: String(ticket.id),
          hissunoId: sessionId,
          message: `Synced #${ticket.id}: ${ticket.subject ?? ''}`,
        })
      } else {
        ctx.progress({ type: 'failed', externalId: String(ticket.id), message: `Failed #${ticket.id}` })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.logger.error('ticket ingest failed', { ticketId: ticket.id, error: message })
      ctx.progress({ type: 'failed', externalId: String(ticket.id), message })
    }
  }

  try {
    let batch: ZendeskTicket[] = []
    for await (const ticket of client.listTickets({
      fromDate,
      toDate,
      onProgress: (n) => {
        found = n
        ctx.progress({ type: 'found', current: found, total: found, message: `Scanning... ${found}` })
      },
    })) {
      if (ctx.signal.aborted) break
      batch.push(ticket)
      if (batch.length >= CONCURRENCY) {
        await Promise.all(batch.map(processTicket))
        batch = []
      }
    }
    if (batch.length) await Promise.all(batch.map(processTicket))
  } catch (err) {
    if (err instanceof ZendeskRateLimitError) {
      throw new Error(`Rate limit exceeded. Retry after ${err.retryAfter}s.`)
    }
    if (err instanceof ZendeskApiError) {
      throw new Error(`Zendesk API error: ${err.message}`)
    }
    throw err
  }
}

async function ingestTicket(
  ctx: SyncCtx<Record<string, unknown>, ZendeskFilters>,
  client: ZendeskClient,
  ticket: ZendeskTicket
): Promise<string | null> {
  const comments = (await client.getTicketComments(ticket.id)).filter((c) => c.public)

  let requester: ZendeskUser | null = null
  try {
    requester = await client.getUser(ticket.requester_id)
  } catch (err) {
    ctx.logger.warn('failed to fetch requester', { ticketId: ticket.id, error: String(err) })
  }

  let organization: ZendeskOrganization | null = null
  const orgId = requester?.organization_id || ticket.organization_id
  if (orgId) {
    try {
      organization = await client.getOrganization(orgId)
    } catch (err) {
      ctx.logger.warn('failed to fetch organization', { ticketId: ticket.id, error: String(err) })
    }
  }

  let contactId: string | undefined
  if (requester?.email) {
    try {
      let companyId: string | undefined
      if (organization) {
        const domain = organization.domain_names?.[0] || organization.name
        const companyResult = await ctx.ingest.company({
          externalId: `org:${organization.id}`,
          domain,
          name: organization.name,
        })
        companyId = companyResult.companyId
      }
      const contactResult = await ctx.ingest.contact({
        externalId: `user:${requester.id}`,
        email: requester.email,
        name: requester.name || requester.email,
        phone: requester.phone,
        companyId,
      })
      contactId = contactResult.contactId
    } catch (err) {
      ctx.logger.warn('failed to enrich contact', { ticketId: ticket.id, error: String(err) })
    }
  }

  const messages = comments
    .map((comment) => {
      const content = comment.plain_body || stripHtml(comment.html_body || comment.body || '')
      if (!content.trim()) return null
      return {
        senderType: mapAuthorToSenderType(comment.author_id, ticket.requester_id),
        content,
        createdAt: new Date(comment.created_at),
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const userMetadata = buildUserMetadata(ticket, requester, organization)

  const { sessionId } = await ctx.ingest.session({
    externalId: String(ticket.id),
    source: 'zendesk',
    sessionType: 'chat',
    status: 'closed',
    name: ticket.subject || 'Zendesk Ticket',
    userMetadata: { ...userMetadata, userId: requester?.email || String(ticket.requester_id) },
    firstMessageAt: new Date(ticket.created_at),
    lastActivityAt: new Date(ticket.updated_at),
    createdAt: new Date(ticket.created_at),
    messages,
    contactId,
  })

  return sessionId
}
