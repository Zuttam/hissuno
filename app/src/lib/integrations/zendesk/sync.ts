/**
 * Zendesk ticket sync logic.
 * Handles fetching tickets from Zendesk and creating Hissuno sessions.
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { sessions, sessionMessages, contacts, companies } from '@/lib/db/schema/app'
import { setSessionContact } from '@/lib/db/queries/entity-relationships'
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
  isTicketSynced,
  recordSyncedTicket,
  updateSyncState,
  createSyncRun,
  completeSyncRun,
  type ZendeskFilterConfig,
} from './index'

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
 * Map comment author to Hissuno sender type
 */
function mapAuthorToSenderType(authorId: number, requesterId: number): 'user' | 'human_agent' {
  return authorId === requesterId ? 'user' : 'human_agent'
}

/**
 * Generate a deterministic session ID from Zendesk ticket
 */
function generateSessionId(ticketId: number, projectId: string): string {
  return `zendesk-${ticketId}-${projectId}`
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/**
 * Build enriched user metadata from Zendesk ticket/user/org
 */
function buildUserMetadata(
  ticket: ZendeskTicket,
  user: ZendeskUser | null,
  organization: ZendeskOrganization | null
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    zendesk_ticket_id: ticket.id,
  }

  if (ticket.tags?.length) {
    metadata.zendesk_tags = ticket.tags.join(', ')
  }
  if (ticket.priority) {
    metadata.zendesk_priority = ticket.priority
  }
  if (ticket.group_id) {
    metadata.zendesk_group_id = String(ticket.group_id)
  }

  if (user) {
    if (user.name) metadata.name = user.name
    if (user.email) metadata.email = user.email
    if (user.phone) metadata.phone = user.phone
    if (user.time_zone) metadata.timezone = user.time_zone
    if (user.tags?.length) {
      metadata.zendesk_user_tags = user.tags.join(', ')
    }
  }

  if (organization) {
    metadata.company = organization.name
    if (organization.domain_names?.length) {
      metadata.company_domain = organization.domain_names[0]
    }
  }

  return metadata
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
    // Try to find existing contact by email
    const existingRows = await db
      .select({ id: contacts.id, company_id: contacts.company_id })
      .from(contacts)
      .where(
        and(
          eq(contacts.project_id, projectId),
          eq(contacts.email, user.email)
        )
      )

    const existingContact = existingRows[0]

    if (existingContact) {
      // If contact exists but has no company, and we have org data, link them
      if (!existingContact.company_id && organization) {
        const companyId = await findOrCreateCompany(projectId, organization)
        if (companyId) {
          await db
            .update(contacts)
            .set({ company_id: companyId })
            .where(eq(contacts.id, existingContact.id))
        }
      }
      return existingContact.id
    }

    // Create new contact
    let companyId: string | null = null
    if (organization) {
      companyId = await findOrCreateCompany(projectId, organization)
    }

    const inserted = await db
      .insert(contacts)
      .values({
        project_id: projectId,
        name: user.name || user.email,
        email: user.email,
        company_id: companyId,
        phone: user.phone ?? null,
      })
      .returning({ id: contacts.id })

    return inserted[0]?.id ?? null
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
    const domain = organization.domain_names?.[0] || ''

    // Try to find by name first
    const existingRows = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.project_id, projectId),
          eq(companies.name, organization.name)
        )
      )

    const existingCompany = existingRows[0]

    if (existingCompany) {
      return existingCompany.id
    }

    const inserted = await db
      .insert(companies)
      .values({
        project_id: projectId,
        name: organization.name,
        domain,
      })
      .returning({ id: companies.id })

    return inserted[0]?.id ?? null
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

  // Create session
  try {
    await db.insert(sessions).values({
      id: sessionId,
      project_id: projectId,
      source: 'zendesk',
      session_type: 'chat',
      status: 'closed',
      name: sessionName,
      user_metadata: { ...userMetadata, userId: requester?.email || String(ticket.requester_id) },
      first_message_at: new Date(ticket.created_at),
      last_activity_at: new Date(ticket.updated_at),
      created_at: new Date(ticket.created_at),
    })
  } catch (sessionError) {
    console.error(`[zendesk.sync] Failed to create session for ticket ${ticket.id}:`, sessionError)
    return null
  }

  // Link contact via entity_relationships
  if (contactId) {
    await setSessionContact(projectId, sessionId, contactId)
  }

  // Build messages from comments
  const messageValues: Array<{
    session_id: string
    project_id: string
    sender_type: string
    content: string
    created_at: Date
  }> = []

  for (const comment of ticketComments) {
    const content = comment.plain_body || stripHtml(comment.html_body || comment.body || '')
    if (!content.trim()) continue

    messageValues.push({
      session_id: sessionId,
      project_id: projectId,
      sender_type: mapAuthorToSenderType(comment.author_id, ticket.requester_id),
      content,
      created_at: new Date(comment.created_at),
    })
  }

  // Insert messages
  if (messageValues.length > 0) {
    try {
      await db.insert(sessionMessages).values(messageValues)
    } catch (messagesError) {
      console.error(`[zendesk.sync] Failed to insert messages for ticket ${ticket.id}:`, messagesError)
    }
  }

  // Update session message count
  await db
    .update(sessions)
    .set({ message_count: messageValues.length })
    .where(eq(sessions.id, sessionId))

  // Record the sync
  await recordSyncedTicket({
    connectionId,
    zendeskTicketId: ticket.id,
    sessionId,
    ticketCreatedAt: ticket.created_at,
    ticketUpdatedAt: ticket.updated_at,
    commentsCount: messageValues.length,
  })

  return { sessionId, messageCount: messageValues.length }
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
    const processTicket = async (ticket: ZendeskTicket) => {
      // Check if already synced
      const alreadySynced = await isTicketSynced(credentials.connectionId, ticket.id)

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
