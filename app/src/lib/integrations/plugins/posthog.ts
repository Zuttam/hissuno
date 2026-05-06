/**
 * PostHog plugin — enriches existing contacts with behavioral signals,
 * optionally discovers new contacts, and creates behavioral sessions.
 *
 * Auth: Personal API Key + host + project id.
 * Streams: behavioral (sessions kind).
 */

import { z } from 'zod'
import { db } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { contacts } from '@/lib/db/schema/app'
import { definePlugin, type SyncCtx } from '../plugin-kit'
import {
  PosthogClient,
  PosthogApiError,
  PosthogRateLimitError,
  type PosthogPerson,
  type PosthogEvent,
} from '../posthog/client'
interface PosthogEventConfig {
  feature_mapping?: Record<string, string[]>
  signal_events?: string[]
  person_properties?: string[]
}

interface PosthogFilterConfig {
  sync_new_contacts?: boolean
  max_new_contacts?: number
  fromDate?: string
  toDate?: string
}
import {
  computeEngagementScore,
  computeEngagementTrend,
  computeFeatureUsage,
  computeRecentSignals,
} from '../posthog/sync-computations'
import { isValidEmail, extractEmailDomain, isGenericEmailDomain } from '@/lib/customers/contact-resolution'

const filterSchema = z.object({
  sync_new_contacts: z.boolean().optional(),
  max_new_contacts: z.number().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
})

const settingsSchema = z.object({
  feature_mapping: z.record(z.array(z.string())).optional(),
  signal_events: z.array(z.string()).optional(),
  person_properties: z.array(z.string()).optional(),
})

type PosthogFilters = z.infer<typeof filterSchema>
type PosthogSettings = z.infer<typeof settingsSchema>

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

  streams: {
    behavioral: {
      kind: 'sessions',
      label: 'Behavioral sessions',
      description: 'Behavioral signals and engagement scores per contact.',
      filterSchema,
      settingsSchema,
      defaultFilters: { sync_new_contacts: false, max_new_contacts: 1000 },
      sync: runBehavioralSync,
    },
  },
})

async function runBehavioralSync(ctx: SyncCtx<PosthogSettings, PosthogFilters>) {
  const creds = ctx.credentials as unknown as PosthogCredentials
  if (!creds.apiKey || !creds.posthogProjectId) {
    throw new Error('PostHog credentials are incomplete.')
  }
  const client = new PosthogClient(creds.apiKey, creds.host || 'https://app.posthog.com', creds.posthogProjectId)

  const eventConfig = ctx.settings as PosthogEventConfig
  const filterConfig = ctx.filters as PosthogFilterConfig

  const projectContacts = await db
    .select({ id: contacts.id, name: contacts.name, email: contacts.email, custom_fields: contacts.custom_fields })
    .from(contacts)
    .where(and(eq(contacts.project_id, ctx.projectId), eq(contacts.is_archived, false)))

  const total = projectContacts.length

  try {
    for (let i = 0; i < projectContacts.length; i++) {
      if (ctx.signal.aborted) break
      const contact = projectContacts[i]
      if (!contact.email) continue

      ctx.progress({
        type: 'progress',
        current: i + 1,
        total,
        message: `Processing ${contact.name ?? contact.email}`,
      })

      try {
        const person = await client.getPersonByEmail(contact.email)
        if (!person) continue
        const metrics = await collectMetrics(client, person, eventConfig, filterConfig)
        await createBehavioralSession(ctx, {
          externalId: `contact:${contact.id}`,
          contactId: contact.id,
          contactName: contact.name ?? contact.email,
          contactEmail: contact.email,
          events: metrics.events,
          engagementScore: metrics.engagementScore,
          featureUsage: metrics.featureUsage,
          recentSignals: metrics.recentSignals,
        })
        mergePersonProperties(ctx, contact.id, contact.custom_fields as Record<string, unknown> | null, person.properties, eventConfig)
        ctx.progress({
          type: 'synced',
          externalId: `contact:${contact.id}`,
          message: `Matched ${contact.name ?? contact.email}`,
        })
      } catch (err) {
        if (err instanceof PosthogRateLimitError) throw err
        ctx.logger.error('contact enrichment failed', {
          contactId: contact.id,
          error: err instanceof Error ? err.message : String(err),
        })
        ctx.progress({ type: 'failed', externalId: contact.id, message: String(err) })
      }
    }

    if (filterConfig.sync_new_contacts && !ctx.signal.aborted) {
      await discoverNewContacts(ctx, client, eventConfig, filterConfig, projectContacts)
    }
  } catch (err) {
    if (err instanceof PosthogRateLimitError) {
      throw new Error(`Rate limit exceeded. Retry after ${err.retryAfter}s.`)
    }
    if (err instanceof PosthogApiError) {
      throw new Error(`PostHog API error: ${err.message}`)
    }
    throw err
  }
}

async function collectMetrics(
  client: PosthogClient,
  person: PosthogPerson,
  eventConfig: PosthogEventConfig,
  filterConfig: PosthogFilterConfig
) {
  const distinctId = person.distinct_ids?.[0] ?? null
  const afterDate = filterConfig.fromDate
    ? new Date(filterConfig.fromDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const beforeDate = filterConfig.toDate ? new Date(filterConfig.toDate) : undefined

  let events: PosthogEvent[] = []
  if (distinctId) {
    try {
      events = await client.getPersonEvents(distinctId, {
        after: afterDate.toISOString(),
        before: beforeDate?.toISOString(),
        limit: 1000,
      })
    } catch {
      events = []
    }
  }
  return {
    events,
    engagementScore: computeEngagementScore(events),
    featureUsage: computeFeatureUsage(events, eventConfig),
    recentSignals: computeRecentSignals(events, eventConfig),
  }
}

async function createBehavioralSession(
  ctx: SyncCtx<PosthogSettings, PosthogFilters>,
  params: {
    externalId: string
    contactId: string
    contactName: string
    contactEmail: string
    events: PosthogEvent[]
    engagementScore: number
    featureUsage: Record<string, number>
    recentSignals: Array<{ event: string; count: number; last_seen: string }>
  }
) {
  const { contactId, contactName, contactEmail, events, engagementScore, featureUsage, recentSignals } = params
  const trend = computeEngagementTrend(events)
  const lines = [
    `## PostHog Behavioral Summary`,
    ``,
    `- **Engagement Score**: ${engagementScore}/100 (${trend})`,
    `- **Events (30d)**: ${events.length}`,
  ]
  const sortedFeatures = Object.entries(featureUsage).sort(([, a], [, b]) => b - a).slice(0, 10)
  if (sortedFeatures.length) {
    lines.push('', '### Feature Usage')
    for (const [feature, count] of sortedFeatures) lines.push(`- **${feature}**: ${count} events`)
  }
  if (recentSignals.length) {
    lines.push('', '### Recent Signals')
    for (const signal of recentSignals.slice(0, 5)) {
      lines.push(`- **${signal.event}**: ${signal.count}x (last: ${new Date(signal.last_seen).toLocaleDateString()})`)
    }
  }

  const now = new Date()
  await ctx.ingest.session({
    externalId: params.externalId,
    source: 'posthog',
    sessionType: 'behavioral',
    status: 'closed',
    name: `PostHog Activity - ${contactName}`,
    description: `Behavioral data imported from PostHog for ${contactEmail}`,
    userMetadata: { email: contactEmail, name: contactName },
    firstMessageAt: events.length > 0 ? new Date(events[events.length - 1].timestamp) : now,
    lastActivityAt: events.length > 0 ? new Date(events[0].timestamp) : now,
    createdAt: now,
    messages: [{ senderType: 'system', content: lines.join('\n') }],
    contactId,
  })
}

async function mergePersonProperties(
  ctx: SyncCtx<PosthogSettings, PosthogFilters>,
  contactId: string,
  existingCustomFields: Record<string, unknown> | null,
  personProps: Record<string, unknown>,
  eventConfig: PosthogEventConfig
): Promise<void> {
  const propsToExtract = eventConfig.person_properties ?? ['plan', 'email', 'name']
  const extracted: Record<string, unknown> = {}
  for (const key of propsToExtract) {
    if (personProps[key] !== undefined) extracted[key] = personProps[key]
  }
  if (!Object.keys(extracted).length) return
  const existing = (existingCustomFields as Record<string, unknown>) || {}
  const merged = { ...existing }
  for (const [k, v] of Object.entries(extracted)) merged[`posthog_${k}`] = v
  try {
    await db
      .update(contacts)
      .set({ custom_fields: merged, updated_at: new Date() })
      .where(eq(contacts.id, contactId))
  } catch (err) {
    ctx.logger.warn('failed to merge custom fields', {
      contactId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function discoverNewContacts(
  ctx: SyncCtx<PosthogSettings, PosthogFilters>,
  client: PosthogClient,
  eventConfig: PosthogEventConfig,
  filterConfig: PosthogFilterConfig,
  existing: Array<{ email: string | null }>
) {
  const maxNew = filterConfig.max_new_contacts ?? 1000
  const knownEmails = new Set(existing.map((c) => c.email?.toLowerCase()).filter((e): e is string => !!e))

  let offset = 0
  const pageSize = 100
  let discovered = 0
  let hasMore = true

  while (hasMore && discovered < maxNew && !ctx.signal.aborted) {
    const page = await client.listPersons({ limit: pageSize, offset })
    if (!page.results.length) break
    hasMore = page.next !== null
    offset += pageSize

    for (const person of page.results) {
      if (ctx.signal.aborted || discovered >= maxNew) break
      const props = person.properties as Record<string, unknown>
      const email = String(props.email ?? '').toLowerCase().trim()
      if (!email || !isValidEmail(email) || knownEmails.has(email)) continue
      knownEmails.add(email)

      const name = String(props.name ?? props.$name ?? '').trim() ||
        email.split('@')[0].replace(/[._-]/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

      try {
        const domain = extractEmailDomain(email)
        let companyId: string | undefined
        if (domain && !isGenericEmailDomain(domain)) {
          const company = await ctx.ingest.company({
            externalId: `domain:${domain}`,
            domain,
          })
          companyId = company.companyId
        }
        const contactResult = await ctx.ingest.contact({
          externalId: `ph:${person.id}`,
          email,
          name,
          title: String(props.title ?? '') || null,
          companyId: companyId ?? null,
        })

        const metrics = await collectMetrics(client, person, eventConfig, filterConfig)
        mergePersonProperties(ctx, contactResult.contactId, null, props, eventConfig)
        await createBehavioralSession(ctx, {
          externalId: `ph:person:${person.id}`,
          contactId: contactResult.contactId,
          contactName: name,
          contactEmail: email,
          events: metrics.events,
          engagementScore: metrics.engagementScore,
          featureUsage: metrics.featureUsage,
          recentSignals: metrics.recentSignals,
        })
        discovered++
        ctx.progress({
          type: 'synced',
          externalId: `ph:person:${person.id}`,
          message: `Discovered ${name} (${email})`,
        })
      } catch (err) {
        ctx.logger.error('failed to create contact', {
          email,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }
}
