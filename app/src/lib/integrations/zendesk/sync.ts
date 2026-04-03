/**
 * Zendesk ticket sync logic.
 * Handles fetching tickets from Zendesk and creating Hissuno sessions.
 */

import { createSessionWithMessagesAdmin } from '@/lib/sessions/sessions-service'
import { upsertCompanyAdmin, upsertContactAdmin } from '@/lib/customers/customers-service'
import {
  ZendeskClient,
  type ZendeskTicket,
  type ZendeskUser,
  type ZendeskOrganization,
  type ZendeskComment,
  ZendeskApiError,
  ZendeskRateLimitError,
} from './client'
import {
  getZendeskCredentials,
  getSyncedTicketIds,
  recordSyncedTicket,
  updateSyncState,
  createSyncRun,
  completeSyncRun,
  type ZendeskFilterConfig,
} from './index'
import { stripHtml } from '@/lib/integrations/shared/sync-utils'
import { mapAuthorToSenderType, generateSessionId, buildUserMetadata } from './sync-helpers'

/**
 * Progress event during sync
 */
export interface SyncProgressEvent {
  type: 'progress' | 'synced' | 'error'
  ticketId?: number
  sessionId?: string
  message: string
  current: number
  total: number
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean
  ticketsFound: number
  ticketsSynced: number
  ticketsSkipped: number
  error?: string
}

/**
 * Sync mode
 */
export type SyncMode = 'incremental' | 'full'

/**
 * Sync options
 */
export interface SyncOptions {
  triggeredBy: 'manual' | 'cron'
  filterConfig?: ZendeskFilterConfig
  syncMode?: SyncMode
  onProgress?: (event: SyncProgressEvent) => void
  signal?: AbortSignal
}

/**
 * Find or create a contact from Zendesk user data, and link to company from org.
 */
async function enrichContact(
  projectId: string,
  user: ZendeskUser,
  organization: ZendeskOrganization | null
): Promise<string | null> {
  if (!user.email) return null

  try {
    // Resolve company first if we have org data
    let companyId: string | null = null
    if (organization) {
      companyId = await findOrCreateCompany(projectId, organization)
    }

    // Upsert contact - fill_nulls will link company if contact has no company_id
    const { record } = await upsertContactAdmin({
      projectId,
      email: user.email,
      name: user.name || user.email,
      phone: user.phone ?? null,
      companyId,
      mergeStrategy: 'fill_nulls',
    })

    return record.id
  } catch (err) {
    console.warn('[zendesk.sync] Failed to enrich contact:', err)
    return null
  }
}

/**
 * Find or create a company from Zendesk organization data
 */
async function findOrCreateCompany(
  projectId: string,
  organization: ZendeskOrganization
): Promise<string | null> {
  try {
    // Use the first domain_name, or fall back to org name as domain
    const domain = organization.domain_names?.[0] || organization.name

    const { record } = await upsertCompanyAdmin({
      projectId,
      domain,
      name: organization.name,
      mergeStrategy: 'fill_nulls',
    })

    return record.id
  } catch (err) {
    console.warn('[zendesk.sync] Failed to find/create company:', err)
    return null
  }
}

/**
 * Create a session and messages from a Zendesk ticket
 */
async function createSessionFromTicket(
  zendesk: ZendeskClient,
  projectId: string,
  connectionId: string,
  ticket: ZendeskTicket
): Promise<{ sessionId: string; messageCount: number } | null> {
  const sessionId = generateSessionId(ticket.id, projectId)

  // Fetch ticket comments (skip private/internal)
  let ticketComments: ZendeskComment[]
  try {
    const allComments = await zendesk.getTicketComments(ticket.id)
    ticketComments = allComments.filter((c) => c.public)
  } catch (err) {
    console.error(`[zendesk.sync] Failed to fetch comments for ticket ${ticket.id}:`, err)
    return null
  }

  // Fetch requester profile
  let requester: ZendeskUser | null = null
  try {
    requester = await zendesk.getUser(ticket.requester_id)
  } catch (err) {
    console.warn(`[zendesk.sync] Failed to fetch requester for ticket ${ticket.id}:`, err)
  }

  // Fetch organization if available
  let organization: ZendeskOrganization | null = null
  const orgId = requester?.organization_id || ticket.organization_id
  if (orgId) {
    try {
      organization = await zendesk.getOrganization(orgId)
    } catch (err) {
      console.warn(`[zendesk.sync] Failed to fetch organization for ticket ${ticket.id}:`, err)
    }
  }

  // Enrich contact
  let contactId: string | null = null
  if (requester) {
    contactId = await enrichContact(projectId, requester, organization)
  }

  const userMetadata = buildUserMetadata(ticket, requester, organization)
  const sessionName = ticket.subject || 'Zendesk Ticket'

  // Build messages from comments
  const messages: Array<{ sender_type: string; content: string; created_at: Date }> = []

  for (const comment of ticketComments) {
    const content = comment.plain_body || stripHtml(comment.html_body || comment.body || '')
    if (!content.trim()) continue

    messages.push({
      sender_type: mapAuthorToSenderType(comment.author_id, ticket.requester_id),
      content,
      created_at: new Date(comment.created_at),
    })
  }

  // Create session with messages via service
  const result = await createSessionWithMessagesAdmin({
    id: sessionId,
    projectId,
    source: 'zendesk',
    sessionType: 'chat',
    status: 'closed',
    name: sessionName,
    userMetadata: { ...userMetadata, userId: requester?.email || String(ticket.requester_id) },
    firstMessageAt: new Date(ticket.created_at),
    lastActivityAt: new Date(ticket.updated_at),
    createdAt: new Date(ticket.created_at),
    messages,
    contactId: contactId ?? undefined,
  })

  if (!result) {
    console.error(`[zendesk.sync] Failed to create session for ticket ${ticket.id}`)
    return null
  }

  // Record the sync
  await recordSyncedTicket({
    connectionId,
    zendeskTicketId: ticket.id,
    sessionId,
    ticketCreatedAt: ticket.created_at,
    ticketUpdatedAt: ticket.updated_at,
    commentsCount: result.messageCount,
  })

  return { sessionId, messageCount: result.messageCount }
}

/**
 * Sync Zendesk tickets for a project.
 * This is the main sync function called by API routes.
 */
export async function syncZendeskTickets(
  projectId: string,
  options: SyncOptions
): Promise<SyncResult> {
  // Get credentials
  const credentials = await getZendeskCredentials(projectId)
  if (!credentials) {
    return {
      success: false,
      ticketsFound: 0,
      ticketsSynced: 0,
      ticketsSkipped: 0,
      error: 'Zendesk is not connected.',
    }
  }

  // Create sync run record
  const runResult = await createSyncRun(credentials.connectionId, options.triggeredBy)
  const runId = runResult?.runId

  // Mark sync as in progress
  await updateSyncState(projectId, { status: 'in_progress' })

  // Handle sync mode
  const syncMode = options.syncMode ?? 'incremental'

  if (syncMode === 'full') {
    console.log('[zendesk.sync] Full sync: scanning from configured start date')
  }

  // Initialize API client
  const zendesk = new ZendeskClient(credentials.subdomain, credentials.adminEmail, credentials.apiToken)

  // Parse date filters
  let fromDate: Date | undefined
  let toDate: Date | undefined
  if (options.filterConfig?.fromDate) {
    fromDate = new Date(options.filterConfig.fromDate)
  }
  if (options.filterConfig?.toDate) {
    toDate = new Date(options.filterConfig.toDate)
  }

  // In incremental mode, use lastSyncAt as fromDate floor
  if (syncMode === 'incremental' && credentials.lastSyncAt) {
    const lastSyncDate = new Date(credentials.lastSyncAt)
    if (!fromDate || lastSyncDate > fromDate) {
      fromDate = lastSyncDate
      console.log(`[zendesk.sync] Incremental sync: using lastSyncAt ${credentials.lastSyncAt} as fromDate`)
    }
  }

  const CONCURRENCY = 5
  let ticketsFound = 0
  let ticketsSynced = 0
  let ticketsSkipped = 0

  try {
    // Pre-fetch all synced ticket IDs to avoid N+1 queries
    const syncedTicketIds = await getSyncedTicketIds(credentials.connectionId)

    const processTicket = async (ticket: ZendeskTicket) => {
      // Check if already synced
      const alreadySynced = syncedTicketIds.has(ticket.id)

      if (alreadySynced) {
        ticketsSkipped++
        console.log(`[zendesk.sync] Skipped ticket ${ticket.id} (already synced)`)
        return
      }

      try {
        const result = await createSessionFromTicket(
          zendesk,
          projectId,
          credentials.connectionId,
          ticket
        )

        if (result) {
          ticketsSynced++
          console.log(`[zendesk.sync] Synced ticket ${ticket.id} -> session ${result.sessionId} (${result.messageCount} messages)`)
        } else {
          ticketsSkipped++
          console.warn(`[zendesk.sync] Failed to create session for ticket ${ticket.id}`)
        }
      } catch (ticketError) {
        console.error(`[zendesk.sync] Error processing ticket ${ticket.id}:`, ticketError)
        ticketsSkipped++
      }
    }

    // Single pass: iterate tickets, process in parallel batches
    let batch: ZendeskTicket[] = []

    for await (const ticket of zendesk.listTickets({
      fromDate,
      toDate,
      onProgress: (fetched) => {
        ticketsFound = fetched
      },
    })) {
      if (options.signal?.aborted) break

      batch.push(ticket)

      if (batch.length >= CONCURRENCY) {
        await Promise.all(batch.map(processTicket))
        batch = []

        options.onProgress?.({
          type: 'progress',
          message: `Syncing... ${ticketsSynced} synced, ${ticketsSkipped} skipped of ${ticketsFound}`,
          current: ticketsSynced + ticketsSkipped,
          total: ticketsFound,
        })
      }
    }

    // Process remaining partial batch
    if (batch.length > 0 && !options.signal?.aborted) {
      await Promise.all(batch.map(processTicket))

      options.onProgress?.({
        type: 'progress',
        message: `Syncing... ${ticketsSynced} synced, ${ticketsSkipped} skipped of ${ticketsFound}`,
        current: ticketsSynced + ticketsSkipped,
        total: ticketsFound,
      })
    }

    // Update sync state
    await updateSyncState(projectId, {
      status: 'success',
      ticketsCount: ticketsSynced,
    })

    // Complete sync run
    if (runId) {
      await completeSyncRun(runId, {
        status: 'success',
        ticketsFound,
        ticketsSynced,
        ticketsSkipped,
      })
    }

    return {
      success: true,
      ticketsFound,
      ticketsSynced,
      ticketsSkipped,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    console.error('[zendesk.sync] Sync failed:', error)

    await updateSyncState(projectId, {
      status: 'error',
      error: errorMessage,
    })

    if (runId) {
      await completeSyncRun(runId, {
        status: 'error',
        ticketsFound,
        ticketsSynced,
        ticketsSkipped,
        errorMessage,
      })
    }

    if (error instanceof ZendeskRateLimitError) {
      return {
        success: false,
        ticketsFound,
        ticketsSynced,
        ticketsSkipped,
        error: `Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`,
      }
    }

    if (error instanceof ZendeskApiError) {
      return {
        success: false,
        ticketsFound,
        ticketsSynced,
        ticketsSkipped,
        error: `Zendesk API error: ${error.message}`,
      }
    }

    return {
      success: false,
      ticketsFound,
      ticketsSynced,
      ticketsSkipped,
      error: errorMessage,
    }
  }
}
