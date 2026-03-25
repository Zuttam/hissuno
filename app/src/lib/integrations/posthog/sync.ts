/**
 * PostHog behavioral session sync logic.
 * Phase 1: Enriches existing contacts by matching to PostHog persons
 *          and creates behavioral sessions.
 * Phase 2 (opt-in): Creates new contacts from unmatched PostHog persons
 *                    and generates behavioral sessions for them.
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { contacts, companies } from '@/lib/db/schema/app'
import { PosthogClient, type PosthogPerson, type PosthogEvent, PosthogApiError, PosthogRateLimitError } from './client'
import {
  getPosthogCredentials,
  updateSyncState,
  type PosthogEventConfig,
  type PosthogFilterConfig,
} from './index'
import { insertSyncRun, updateSyncRun } from '@/lib/db/queries/posthog'
import { isValidEmail, extractEmailDomain, isGenericEmailDomain } from '@/lib/customers/contact-resolution'
import { createSessionWithMessagesAdmin } from '@/lib/sessions/sessions-service'
import { upsertContactAdmin } from '@/lib/customers/customers-service'

const LOG_PREFIX = '[posthog.sync]'

/**
 * Progress event during sync
 */
export interface SyncProgressEvent {
  type: 'progress' | 'matched' | 'discovery' | 'created' | 'error'
  contactId?: string
  contactName?: string
  message: string
  current: number
  total: number
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean
  contactsProcessed: number
  contactsMatched: number
  sessionsCreated: number
  contactsCreated: number
  error?: string
}

// ============================================================================
// Shared Helpers
// ============================================================================

/**
 * Fetch events for a person and compute engagement metrics.
 */
async function fetchEventsAndComputeMetrics(params: {
  client: PosthogClient
  person: PosthogPerson
  eventConfig: PosthogEventConfig
  filterConfig?: PosthogFilterConfig
}): Promise<{
  events: PosthogEvent[]
  engagementScore: number
  featureUsage: Record<string, number>
  recentSignals: Array<{ event: string; page?: string; count: number; last_seen: string }>
}> {
  const { client, person, eventConfig, filterConfig } = params
  const distinctId = person.distinct_ids?.[0] ?? null

  // Determine date range from filter config or default to last 30 days
  const afterDate = filterConfig?.fromDate
    ? new Date(filterConfig.fromDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const beforeDate = filterConfig?.toDate
    ? new Date(filterConfig.toDate)
    : undefined

  let events: PosthogEvent[] = []
  if (distinctId) {
    try {
      events = await client.getPersonEvents(distinctId, {
        after: afterDate.toISOString(),
        before: beforeDate?.toISOString(),
        limit: 1000,
      })
    } catch (err) {
      console.warn(`${LOG_PREFIX} Failed to fetch events for person ${distinctId}:`, err)
    }
  }

  const engagementScore = computeEngagementScore(events)
  const featureUsage = computeFeatureUsage(events, eventConfig)
  const recentSignals = computeRecentSignals(events, eventConfig)

  return { events, engagementScore, featureUsage, recentSignals }
}

/**
 * Merge PostHog person properties into a contact's custom_fields (posthog_ prefix).
 */
async function mergePersonPropertiesToContact(
  contactId: string,
  existingCustomFields: Record<string, unknown> | null,
  personProps: Record<string, unknown>,
  eventConfig: PosthogEventConfig
): Promise<void> {
  const propsToExtract = eventConfig.person_properties ?? ['plan', 'email', 'name']
  const extractedProperties: Record<string, unknown> = {}
  for (const propKey of propsToExtract) {
    if (personProps[propKey] !== undefined) {
      extractedProperties[propKey] = personProps[propKey]
    }
  }

  if (Object.keys(extractedProperties).length > 0) {
    const existingFields = (existingCustomFields as Record<string, unknown>) || {}
    const mergedFields: Record<string, unknown> = { ...existingFields }
    for (const [key, value] of Object.entries(extractedProperties)) {
      mergedFields[`posthog_${key}`] = value
    }
    await db
      .update(contacts)
      .set({ custom_fields: mergedFields, updated_at: new Date() })
      .where(eq(contacts.id, contactId))
  }
}

/**
 * Create a new contact from a PostHog person.
 * Returns the contactId or null on failure.
 */
async function createContactFromPosthog(params: {
  projectId: string
  email: string
  name: string
  personProps: Record<string, unknown>
}): Promise<string | null> {
  const { projectId, email, name, personProps } = params

  // Resolve company from email domain
  let companyId: string | null = null
  const domain = extractEmailDomain(email)
  if (domain && !isGenericEmailDomain(domain)) {
    const companyRows = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.project_id, projectId),
          eq(companies.domain, domain)
        )
      )
      .limit(1)

    companyId = companyRows[0]?.id ?? null
  }

  try {
    // Upsert contact - handles duplicate emails gracefully
    const { record } = await upsertContactAdmin({
      projectId,
      email,
      name,
      title: (personProps.title as string) ?? null,
      companyId,
      mergeStrategy: 'fill_nulls',
    })

    return record.id
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to create contact for ${email}:`, err)
    return null
  }
}

/**
 * Create a behavioral session summarizing PostHog activity for a contact.
 */
async function createBehavioralSession(params: {
  projectId: string
  contactId: string
  contactName: string
  contactEmail: string
  events: PosthogEvent[]
  engagementScore: number
  featureUsage: Record<string, number>
  recentSignals: Array<{ event: string; count: number; last_seen: string }>
}): Promise<void> {
  const {
    projectId, contactId, contactName, contactEmail,
    events, engagementScore, featureUsage, recentSignals,
  } = params

  const sessionId = crypto.randomUUID()
  const now = new Date()

  // Build summary message content
  const engagementTrend = computeEngagementTrend(events)
  let summaryContent = `## PostHog Behavioral Summary\n\n`
  summaryContent += `- **Engagement Score**: ${engagementScore}/100 (${engagementTrend})\n`
  summaryContent += `- **Events (30d)**: ${events.length}\n`

  if (Object.keys(featureUsage).length > 0) {
    summaryContent += `\n### Feature Usage\n`
    const sorted = Object.entries(featureUsage).sort(([, a], [, b]) => b - a).slice(0, 10)
    for (const [feature, count] of sorted) {
      summaryContent += `- **${feature}**: ${count} events\n`
    }
  }

  if (recentSignals.length > 0) {
    summaryContent += `\n### Recent Signals\n`
    for (const signal of recentSignals.slice(0, 5)) {
      summaryContent += `- **${signal.event}**: ${signal.count}x (last: ${new Date(signal.last_seen).toLocaleDateString()})\n`
    }
  }

  // Create session with summary message via service
  await createSessionWithMessagesAdmin({
    id: sessionId,
    projectId,
    source: 'posthog',
    sessionType: 'behavioral',
    status: 'closed',
    name: `PostHog Activity - ${contactName}`,
    description: `Behavioral data imported from PostHog for ${contactEmail}`,
    userMetadata: { email: contactEmail, name: contactName },
    firstMessageAt: events.length > 0 ? new Date(events[events.length - 1].timestamp) : now,
    lastActivityAt: events.length > 0 ? new Date(events[0].timestamp) : now,
    createdAt: now,
    messages: [{ sender_type: 'system', content: summaryContent }],
    contactId,
  })
}

// ============================================================================
// Main Sync Function
// ============================================================================

/**
 * Sync PostHog behavioral sessions for a project.
 * Phase 1: Enriches existing contacts matched by email and creates behavioral sessions.
 * Phase 2 (opt-in): Creates new contacts from unmatched PostHog persons.
 */
export async function syncPosthogProfiles(
  projectId: string,
  options: {
    onProgress?: (event: SyncProgressEvent) => void
    signal?: AbortSignal
  } = {}
): Promise<SyncResult> {
  // Get credentials
  const credentials = await getPosthogCredentials(projectId)
  if (!credentials) {
    return {
      success: false,
      contactsProcessed: 0,
      contactsMatched: 0,
      sessionsCreated: 0,
      contactsCreated: 0,
      error: 'PostHog is not connected.',
    }
  }

  // Create sync run record
  const runResult = await insertSyncRun({
    projectId,
    connectionId: credentials.connectionId,
  })
  const runId = runResult?.id

  // Mark sync as in progress
  await updateSyncState(projectId, { status: 'in_progress' })

  // Initialize API client
  const client = new PosthogClient(
    credentials.apiKey,
    credentials.host,
    credentials.posthogProjectId
  )

  const eventConfig = credentials.eventConfig || {}
  const filterConfig: PosthogFilterConfig = credentials.filterConfig || {}

  // Get all project contacts with emails
  const projectContacts = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      custom_fields: contacts.custom_fields,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.project_id, projectId),
        eq(contacts.is_archived, false)
      )
    )

  const totalContacts = projectContacts.length
  let contactsMatched = 0
  let sessionsCreated = 0
  let contactsCreated = 0

  try {
    // ========================================================================
    // Phase 1: Enrich existing contacts and create behavioral sessions
    // ========================================================================
    for (let i = 0; i < projectContacts.length; i++) {
      if (options.signal?.aborted) break

      const contact = projectContacts[i]
      if (!contact.email) continue

      options.onProgress?.({
        type: 'progress',
        contactId: contact.id,
        contactName: contact.name,
        message: `Processing ${contact.name} (${i + 1}/${totalContacts})`,
        current: i + 1,
        total: totalContacts,
      })

      try {
        // Search PostHog for this person by email
        const person = await client.getPersonByEmail(contact.email)
        if (!person) continue

        contactsMatched++

        options.onProgress?.({
          type: 'matched',
          contactId: contact.id,
          contactName: contact.name,
          message: `Matched ${contact.name} in PostHog`,
          current: i + 1,
          total: totalContacts,
        })

        // Fetch events and compute engagement metrics
        const metrics = await fetchEventsAndComputeMetrics({
          client,
          person,
          eventConfig,
          filterConfig,
        })

        // Create behavioral session for this contact
        await createBehavioralSession({
          projectId,
          contactId: contact.id,
          contactName: contact.name ?? contact.email,
          contactEmail: contact.email,
          events: metrics.events,
          engagementScore: metrics.engagementScore,
          featureUsage: metrics.featureUsage,
          recentSignals: metrics.recentSignals,
        })

        // Merge person properties into contact custom_fields
        await mergePersonPropertiesToContact(
          contact.id,
          contact.custom_fields as Record<string, unknown> | null,
          person.properties as Record<string, unknown>,
          eventConfig
        )

        sessionsCreated++
      } catch (err) {
        if (err instanceof PosthogRateLimitError) throw err
        console.error(`${LOG_PREFIX} Error processing contact ${contact.email}:`, err)
        options.onProgress?.({
          type: 'error',
          contactId: contact.id,
          contactName: contact.name,
          message: `Error processing ${contact.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
          current: i + 1,
          total: totalContacts,
        })
      }
    }

    // ========================================================================
    // Phase 2: Discover and create new contacts from PostHog persons
    // ========================================================================
    if (filterConfig.sync_new_contacts && !options.signal?.aborted) {
      const maxNew = filterConfig.max_new_contacts ?? 1000

      // Build set of known emails from Phase 1 contacts
      const knownEmails = new Set(
        projectContacts
          .map((c) => c.email?.toLowerCase())
          .filter((e): e is string => !!e)
      )

      let offset = 0
      const pageSize = 100
      let discoveredCount = 0

      options.onProgress?.({
        type: 'discovery',
        message: 'Discovering new PostHog persons...',
        current: 0,
        total: maxNew,
      })

      let hasMore = true
      while (hasMore && discoveredCount < maxNew && !options.signal?.aborted) {
        let personsPage: { results: PosthogPerson[]; next: string | null }
        try {
          personsPage = await client.listPersons({ limit: pageSize, offset })
        } catch (err) {
          if (err instanceof PosthogRateLimitError) {
            // Wait and retry
            console.warn(`${LOG_PREFIX} Rate limited during Phase 2, waiting ${err.retryAfter}s...`)
            await new Promise((resolve) => setTimeout(resolve, err.retryAfter * 1000))
            continue
          }
          throw err
        }

        if (personsPage.results.length === 0) break
        hasMore = personsPage.next !== null
        offset += pageSize

        for (const person of personsPage.results) {
          if (options.signal?.aborted || discoveredCount >= maxNew) break

          const personProps = person.properties as Record<string, unknown>
          const email = ((personProps.email as string) || '').toLowerCase().trim()
          if (!email || !isValidEmail(email) || knownEmails.has(email)) continue

          // Mark as known to avoid duplicates within the same sync
          knownEmails.add(email)

          const name = (personProps.name as string) ||
            (personProps.$name as string) ||
            email.split('@')[0].replace(/[._-]/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

          options.onProgress?.({
            type: 'discovery',
            message: `Discovered ${name} (${email})`,
            current: discoveredCount + 1,
            total: maxNew,
          })

          try {
            // Create contact
            const contactId = await createContactFromPosthog({
              projectId,
              email,
              name,
              personProps,
            })

            if (!contactId) continue

            // Fetch events and compute metrics
            const metrics = await fetchEventsAndComputeMetrics({
              client,
              person,
              eventConfig,
              filterConfig,
            })

            // Merge person properties to contact custom_fields
            await mergePersonPropertiesToContact(contactId, null, personProps, eventConfig)

            // Create behavioral session
            await createBehavioralSession({
              projectId,
              contactId,
              contactName: name,
              contactEmail: email,
              events: metrics.events,
              engagementScore: metrics.engagementScore,
              featureUsage: metrics.featureUsage,
              recentSignals: metrics.recentSignals,
            })

            contactsCreated++
            sessionsCreated++
            discoveredCount++

            options.onProgress?.({
              type: 'created',
              contactId,
              contactName: name,
              message: `Created contact ${name} with behavioral session`,
              current: discoveredCount,
              total: maxNew,
            })
          } catch (err) {
            if (err instanceof PosthogRateLimitError) {
              // Wait and retry the person
              console.warn(`${LOG_PREFIX} Rate limited, waiting ${err.retryAfter}s...`)
              await new Promise((resolve) => setTimeout(resolve, err.retryAfter * 1000))
              // Remove from known so it gets retried on next page pass
              knownEmails.delete(email)
              continue
            }
            console.error(`${LOG_PREFIX} Error creating contact for ${email}:`, err)
            options.onProgress?.({
              type: 'error',
              message: `Error creating contact for ${email}: ${err instanceof Error ? err.message : 'Unknown error'}`,
              current: discoveredCount,
              total: maxNew,
            })
          }
        }
      }
    }

    // Update sync state
    await updateSyncState(projectId, { status: 'success' })

    // Complete sync run
    if (runId) {
      await updateSyncRun(runId, {
        status: 'completed',
        contactsMatched,
        sessionsCreated,
        contactsCreated,
      })
    }

    return {
      success: true,
      contactsProcessed: totalContacts,
      contactsMatched,
      sessionsCreated,
      contactsCreated,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    console.error(`${LOG_PREFIX} Sync failed:`, error)

    await updateSyncState(projectId, { status: 'error', error: errorMessage })

    if (runId) {
      await updateSyncRun(runId, {
        status: 'failed',
        contactsMatched,
        sessionsCreated,
        contactsCreated,
        errorMessage,
      })
    }

    if (error instanceof PosthogRateLimitError) {
      return {
        success: false,
        contactsProcessed: totalContacts,
        contactsMatched,
        sessionsCreated,
        contactsCreated,
        error: `Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`,
      }
    }

    if (error instanceof PosthogApiError) {
      return {
        success: false,
        contactsProcessed: totalContacts,
        contactsMatched,
        sessionsCreated,
        contactsCreated,
        error: `PostHog API error: ${error.message}`,
      }
    }

    return {
      success: false,
      contactsProcessed: totalContacts,
      contactsMatched,
      sessionsCreated,
      contactsCreated,
      error: errorMessage,
    }
  }
}

// ============================================================================
// Engagement Metrics
// ============================================================================

/**
 * Compute engagement score (0-100) based on event recency and frequency.
 * Events in last 7d weighted 3x, 8-14d weighted 2x, 15-30d weighted 1x.
 * Normalized to 0-100.
 */
function computeEngagementScore(events: PosthogEvent[]): number {
  if (events.length === 0) return 0

  const now = Date.now()
  const DAY = 1000 * 60 * 60 * 24

  let weightedSum = 0
  for (const event of events) {
    const daysAgo = (now - new Date(event.timestamp).getTime()) / DAY
    if (daysAgo <= 7) {
      weightedSum += 3
    } else if (daysAgo <= 14) {
      weightedSum += 2
    } else if (daysAgo <= 30) {
      weightedSum += 1
    }
  }

  // Normalize: max expected weighted sum for a very active user (~50 events/day * 3 weight * 7 days = 1050)
  // Use 200 as a reasonable high-water mark for normalization
  const normalized = Math.min(100, Math.round((weightedSum / 200) * 100))
  return normalized
}

/**
 * Compute engagement trend by comparing last 15 days vs prior 15 days.
 * >15% increase = growing, >15% decrease = declining, else stable.
 */
function computeEngagementTrend(events: PosthogEvent[]): string {
  if (events.length === 0) return 'stable'

  const now = Date.now()
  const DAY = 1000 * 60 * 60 * 24

  let recentCount = 0 // last 15 days
  let priorCount = 0 // 15-30 days ago

  for (const event of events) {
    const daysAgo = (now - new Date(event.timestamp).getTime()) / DAY
    if (daysAgo <= 15) {
      recentCount++
    } else if (daysAgo <= 30) {
      priorCount++
    }
  }

  if (priorCount === 0 && recentCount > 0) return 'growing'
  if (priorCount === 0 && recentCount === 0) return 'stable'

  const changeRate = (recentCount - priorCount) / priorCount
  if (changeRate > 0.15) return 'growing'
  if (changeRate < -0.15) return 'declining'
  return 'stable'
}

/**
 * Bucket events into feature areas based on event_config.feature_mapping.
 * Returns { "Feature Name": count, ... }
 */
function computeFeatureUsage(
  events: PosthogEvent[],
  eventConfig: PosthogEventConfig
): Record<string, number> {
  const featureMapping = eventConfig.feature_mapping
  if (!featureMapping || Object.keys(featureMapping).length === 0) {
    return {}
  }

  const usage: Record<string, number> = {}

  for (const event of events) {
    for (const [featureName, eventNames] of Object.entries(featureMapping)) {
      if (eventNames.includes(event.event)) {
        usage[featureName] = (usage[featureName] || 0) + 1
      }
    }
  }

  return usage
}

/**
 * Extract recent signals from events based on signal_events config.
 * Groups by event name, returns count and last seen time.
 */
function computeRecentSignals(
  events: PosthogEvent[],
  eventConfig: PosthogEventConfig
): Array<{ event: string; page?: string; count: number; last_seen: string }> {
  const signalEventNames = eventConfig.signal_events ?? ['$exception', '$rageclick']

  const signalMap = new Map<string, { count: number; lastSeen: Date; page?: string }>()

  for (const event of events) {
    const isSignal = signalEventNames.some((s) => {
      if (event.event === s) return true
      // Match events containing "error" or "fail" if those are in signal patterns
      if (s === '*error*' && event.event.toLowerCase().includes('error')) return true
      if (s === '*fail*' && event.event.toLowerCase().includes('fail')) return true
      return false
    })

    if (!isSignal) continue

    const existing = signalMap.get(event.event)
    const eventTime = new Date(event.timestamp)
    const page = (event.properties as Record<string, unknown>)?.$current_url as string | undefined

    if (existing) {
      existing.count++
      if (eventTime > existing.lastSeen) {
        existing.lastSeen = eventTime
        if (page) existing.page = page
      }
    } else {
      signalMap.set(event.event, { count: 1, lastSeen: eventTime, page })
    }
  }

  return Array.from(signalMap.entries())
    .map(([event, data]) => ({
      event,
      page: data.page,
      count: data.count,
      last_seen: data.lastSeen.toISOString(),
    }))
    .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
    .slice(0, 10)
}

/**
 * Auto-detect event configuration from PostHog event definitions.
 * Groups events by common prefixes into feature areas.
 * Identifies signal events (exceptions, rageclicks, error-related).
 */
export async function autoDetectEventConfig(
  client: PosthogClient
): Promise<PosthogEventConfig> {
  const eventDefs = await client.getEventDefinitions()
  const propDefs = await client.getPropertyDefinitions('person')

  // Build feature mapping by grouping events with common prefixes
  const featureMapping: Record<string, string[]> = {}
  const customEvents = eventDefs.filter((e) => !e.name.startsWith('$'))

  // Group by prefix (part before first underscore or camelCase boundary)
  for (const event of customEvents) {
    const parts = event.name.split(/[_.-]/)
    if (parts.length >= 2) {
      const prefix = parts[0]
      const featureName = prefix.charAt(0).toUpperCase() + prefix.slice(1)
      if (!featureMapping[featureName]) {
        featureMapping[featureName] = []
      }
      featureMapping[featureName].push(event.name)
    }
  }

  // Remove feature groups with only 1 event (not meaningful)
  for (const [key, events] of Object.entries(featureMapping)) {
    if (events.length < 2) {
      delete featureMapping[key]
    }
  }

  // Default signal events
  const signalEvents = ['$exception', '$rageclick']
  for (const event of customEvents) {
    const lower = event.name.toLowerCase()
    if (lower.includes('error') || lower.includes('fail')) {
      signalEvents.push(event.name)
    }
  }

  // Default person properties
  const defaultProps = ['plan', 'email', 'name']
  const personProperties = [...defaultProps]
  for (const prop of propDefs) {
    if (!defaultProps.includes(prop.name) && !prop.name.startsWith('$')) {
      personProperties.push(prop.name)
    }
  }

  return {
    feature_mapping: featureMapping,
    signal_events: [...new Set(signalEvents)],
    person_properties: personProperties.slice(0, 20), // Limit to 20
  }
}
