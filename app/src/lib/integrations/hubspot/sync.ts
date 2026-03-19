/**
 * HubSpot CRM sync logic.
 * Handles syncing companies and contacts from HubSpot into Hissuno.
 *
 * Key differences from other integrations:
 * - Writes into shared companies/contacts tables (not sessions)
 * - Supports merge strategies to avoid overwriting user-curated data
 * - Pre-validates records (companies need domain, contacts need email)
 * - Fires contact embeddings after insert
 */

import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { companies, contacts } from '@/lib/db/schema/app'
import {
  HubSpotClient,
  type HubSpotCompany,
  type HubSpotContact,
  HubSpotApiError,
  HubSpotRateLimitError,
  exchangePersonalAccessKey,
} from './client'
import {
  getHubSpotCredentials,
  isCompanySynced,
  getSyncedCompanyMap,
  recordSyncedCompany,
  updateSyncedCompanyTimestamp,
  isContactSynced,
  getSyncedContactMap,
  recordSyncedContact,
  updateSyncedContactTimestamp,
  updateSyncState,
  createSyncRun,
  completeSyncRun,
  type HubSpotFilterConfig,
  type OverwritePolicy,
} from './index'

/**
 * Progress event during sync
 */
export interface SyncProgressEvent {
  type: 'progress' | 'error'
  message: string
  current: number
  total: number
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean
  companiesFound: number
  companiesSynced: number
  companiesSkipped: number
  contactsFound: number
  contactsSynced: number
  contactsSkipped: number
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
  filterConfig?: HubSpotFilterConfig
  syncMode?: SyncMode
  onProgress?: (event: SyncProgressEvent) => void
  signal?: AbortSignal
}

/**
 * Apply merge strategy when updating an existing record.
 * Returns only the fields that should be updated based on the policy.
 */
function applyMergeStrategy(
  policy: OverwritePolicy,
  existingValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Record<string, unknown> {
  if (policy === 'never_overwrite') {
    return {}
  }

  if (policy === 'hubspot_wins') {
    // Overwrite all non-undefined new values
    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(newValues)) {
      if (value !== undefined) {
        updates[key] = value
      }
    }
    return updates
  }

  // fill_nulls: only set fields that are currently null/undefined
  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(newValues)) {
    if (value !== undefined && value !== null && (existingValues[key] === null || existingValues[key] === undefined)) {
      updates[key] = value
    }
  }
  return updates
}

/**
 * Extract extra HubSpot properties into custom_fields, prefixed with hubspot_
 */
function extractCustomFields(
  properties: Record<string, string | null | undefined>,
  mappedKeys: Set<string>
): Record<string, unknown> {
  const custom: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!mappedKeys.has(key) && value !== null && value !== undefined && value !== '') {
      custom[`hubspot_${key}`] = value
    }
  }
  return custom
}

/**
 * Map a HubSpot company to Hissuno company fields
 */
const MAPPED_COMPANY_KEYS = new Set([
  'name', 'domain', 'industry', 'country', 'numberofemployees', 'annualrevenue',
  'hs_object_id', 'notes_last_updated', 'description', 'phone', 'website',
])

function mapHubSpotCompany(hsCompany: HubSpotCompany): {
  name: string | null
  domain: string | null
  industry: string | null
  country: string | null
  employeeCount: number | null
  notes: string | null
  customFields: Record<string, unknown>
} {
  const p = hsCompany.properties
  const employeeCount = p.numberofemployees ? parseInt(p.numberofemployees, 10) : null

  // Store annual revenue in custom_fields (it's not the same as ARR)
  const customFields = extractCustomFields(p, MAPPED_COMPANY_KEYS)
  if (p.annualrevenue) {
    customFields.hubspot_annual_revenue = parseFloat(p.annualrevenue)
  }

  return {
    name: p.name || null,
    domain: p.domain || null,
    industry: p.industry || null,
    country: p.country || null,
    employeeCount: !isNaN(employeeCount as number) ? employeeCount : null,
    notes: p.description || null,
    customFields,
  }
}

/**
 * Map a HubSpot contact to Hissuno contact fields
 */
const MAPPED_CONTACT_KEYS = new Set([
  'firstname', 'lastname', 'email', 'phone', 'jobtitle', 'company',
  'hs_object_id', 'notes_last_updated', 'lifecyclestage',
])

function mapHubSpotContact(hsContact: HubSpotContact): {
  name: string | null
  email: string | null
  phone: string | null
  title: string | null
  customFields: Record<string, unknown>
} {
  const p = hsContact.properties
  const firstName = p.firstname || ''
  const lastName = p.lastname || ''
  const name = [firstName, lastName].filter(Boolean).join(' ') || null

  const customFields = extractCustomFields(p, MAPPED_CONTACT_KEYS)
  if (p.lifecyclestage) {
    customFields.hubspot_lifecycle_stage = p.lifecyclestage
  }

  return {
    name,
    email: p.email || null,
    phone: p.phone || null,
    title: p.jobtitle || null,
    customFields,
  }
}

/**
 * Process a single HubSpot company
 */
async function processCompany(
  projectId: string,
  connectionId: string,
  hsCompany: HubSpotCompany,
  overwritePolicy: OverwritePolicy,
  syncedCompanyMap: Map<string, string>
): Promise<'synced' | 'updated' | 'skipped'> {
  const mapped = mapHubSpotCompany(hsCompany)

  // Pre-validate: companies.domain is NOT NULL
  if (!mapped.domain) {
    return 'skipped'
  }

  // Check if already synced via pre-fetched mapping
  const existingCompanyId = syncedCompanyMap.get(hsCompany.id)

  if (existingCompanyId) {
    // Already synced - apply merge strategy for updates
    if (overwritePolicy === 'never_overwrite') {
      await updateSyncedCompanyTimestamp(connectionId, hsCompany.id, hsCompany.updatedAt)
      return 'updated'
    }

    // Fetch existing record
    const existing = await db
      .select()
      .from(companies)
      .where(eq(companies.id, existingCompanyId))

    if (existing[0]) {
      const existingRecord = existing[0]
      const newValues: Record<string, unknown> = {
        industry: mapped.industry,
        country: mapped.country,
        employee_count: mapped.employeeCount,
        notes: mapped.notes,
      }

      const updates = applyMergeStrategy(overwritePolicy, existingRecord as unknown as Record<string, unknown>, newValues)
      if (Object.keys(updates).length > 0) {
        // Merge custom_fields
        const existingCustom = (existingRecord.custom_fields as Record<string, unknown>) || {}
        updates.custom_fields = { ...existingCustom, ...mapped.customFields }
        updates.updated_at = new Date()

        await db
          .update(companies)
          .set(updates)
          .where(eq(companies.id, existingCompanyId))
      }
    }

    await updateSyncedCompanyTimestamp(connectionId, hsCompany.id, hsCompany.updatedAt)
    return 'updated'
  }

  // Check if company already exists by domain in this project (single SELECT with all needed fields)
  const existingByDomain = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.project_id, projectId),
        eq(companies.domain, mapped.domain)
      )
    )

  if (existingByDomain[0]) {
    // Company exists by domain - create mapping and apply merge
    const existingRecord = existingByDomain[0]

    if (overwritePolicy !== 'never_overwrite') {
      const newValues: Record<string, unknown> = {
        industry: mapped.industry,
        country: mapped.country,
        employee_count: mapped.employeeCount,
        notes: mapped.notes,
      }

      const updates = applyMergeStrategy(overwritePolicy, existingRecord as unknown as Record<string, unknown>, newValues)
      if (Object.keys(updates).length > 0) {
        const existingCustom = (existingRecord.custom_fields as Record<string, unknown>) || {}
        updates.custom_fields = { ...existingCustom, ...mapped.customFields }
        updates.updated_at = new Date()

        await db
          .update(companies)
          .set(updates)
          .where(eq(companies.id, existingRecord.id))
      }
    }

    // Record the mapping
    await recordSyncedCompany({
      connectionId,
      hubspotCompanyId: hsCompany.id,
      companyId: existingRecord.id,
      hubspotUpdatedAt: hsCompany.updatedAt,
    })

    return 'synced'
  }

  // New company - insert
  const [inserted] = await db
    .insert(companies)
    .values({
      project_id: projectId,
      name: mapped.name || mapped.domain,
      domain: mapped.domain,
      industry: mapped.industry,
      country: mapped.country,
      employee_count: mapped.employeeCount,
      notes: mapped.notes,
      custom_fields: mapped.customFields,
      is_archived: false,
    })
    .returning({ id: companies.id })

  if (inserted) {
    await recordSyncedCompany({
      connectionId,
      hubspotCompanyId: hsCompany.id,
      companyId: inserted.id,
      hubspotUpdatedAt: hsCompany.updatedAt,
    })
  }

  return 'synced'
}

/**
 * Process a single HubSpot contact
 */
async function processContact(
  projectId: string,
  connectionId: string,
  hsContact: HubSpotContact,
  overwritePolicy: OverwritePolicy,
  syncedContactMap: Map<string, string>
): Promise<'synced' | 'updated' | 'skipped'> {
  const mapped = mapHubSpotContact(hsContact)

  // Pre-validate: contacts.email is NOT NULL
  if (!mapped.email) {
    return 'skipped'
  }

  // Check if already synced via pre-fetched mapping
  const existingContactId = syncedContactMap.get(hsContact.id)

  if (existingContactId) {
    if (overwritePolicy === 'never_overwrite') {
      await updateSyncedContactTimestamp(connectionId, hsContact.id, hsContact.updatedAt)
      return 'updated'
    }

    const existing = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, existingContactId))

    if (existing[0]) {
      const existingRecord = existing[0]
      const newValues: Record<string, unknown> = {
        name: mapped.name,
        phone: mapped.phone,
        title: mapped.title,
      }

      const updates = applyMergeStrategy(overwritePolicy, existingRecord as unknown as Record<string, unknown>, newValues)
      if (Object.keys(updates).length > 0) {
        const existingCustom = (existingRecord.custom_fields as Record<string, unknown>) || {}
        updates.custom_fields = { ...existingCustom, ...mapped.customFields }
        updates.updated_at = new Date()

        await db
          .update(contacts)
          .set(updates)
          .where(eq(contacts.id, existingContactId))
      }
    }

    await updateSyncedContactTimestamp(connectionId, hsContact.id, hsContact.updatedAt)
    return 'updated'
  }

  // Check if contact already exists by email in this project (single SELECT with all fields)
  const existingByEmail = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.project_id, projectId),
        eq(contacts.email, mapped.email)
      )
    )

  if (existingByEmail[0]) {
    const existingRecord = existingByEmail[0]

    if (overwritePolicy !== 'never_overwrite') {
      const newValues: Record<string, unknown> = {
        name: mapped.name,
        phone: mapped.phone,
        title: mapped.title,
      }

      const updates = applyMergeStrategy(overwritePolicy, existingRecord as unknown as Record<string, unknown>, newValues)
      if (Object.keys(updates).length > 0) {
        const existingCustom = (existingRecord.custom_fields as Record<string, unknown>) || {}
        updates.custom_fields = { ...existingCustom, ...mapped.customFields }
        updates.updated_at = new Date()

        await db
          .update(contacts)
          .set(updates)
          .where(eq(contacts.id, existingRecord.id))
      }
    }

    await recordSyncedContact({
      connectionId,
      hubspotContactId: hsContact.id,
      contactId: existingRecord.id,
      hubspotUpdatedAt: hsContact.updatedAt,
    })

    return 'synced'
  }

  // New contact - insert
  const [inserted] = await db
    .insert(contacts)
    .values({
      project_id: projectId,
      name: mapped.name || mapped.email,
      email: mapped.email,
      phone: mapped.phone,
      title: mapped.title,
      custom_fields: mapped.customFields,
      is_archived: false,
    })
    .returning({ id: contacts.id })

  if (inserted) {
    await recordSyncedContact({
      connectionId,
      hubspotContactId: hsContact.id,
      contactId: inserted.id,
      hubspotUpdatedAt: hsContact.updatedAt,
    })

    // Fire-and-forget: create embedding for new contact
    void (async () => {
      try {
        const { buildContactEmbeddingText, upsertContactEmbedding } = await import(
          '@/lib/customers/contact-embedding-service'
        )
        const text = buildContactEmbeddingText({
          name: mapped.name || mapped.email!,
          email: mapped.email!,
          title: mapped.title,
        })
        await upsertContactEmbedding(inserted.id, projectId, text)
      } catch (err) {
        console.warn('[hubspot.sync] Embedding failed for contact', inserted.id, err)
      }
    })()
  }

  return 'synced'
}

/**
 * Sync HubSpot companies and contacts for a project.
 * This is the main sync function called by API routes.
 */
export async function syncHubSpotData(
  projectId: string,
  options: SyncOptions
): Promise<SyncResult> {
  const credentials = await getHubSpotCredentials(projectId)
  if (!credentials) {
    return {
      success: false,
      companiesFound: 0, companiesSynced: 0, companiesSkipped: 0,
      contactsFound: 0, contactsSynced: 0, contactsSkipped: 0,
      error: 'HubSpot is not connected.',
    }
  }

  const runResult = await createSyncRun(credentials.connectionId, options.triggeredBy)
  const runId = runResult?.runId

  await updateSyncState(projectId, { status: 'in_progress' })

  const syncMode = options.syncMode ?? 'incremental'
  const filterConfig = options.filterConfig || credentials.filterConfig || {}
  const overwritePolicy: OverwritePolicy = filterConfig.overwritePolicy || 'fill_nulls'

  // Pre-fetch sync mappings to avoid N+1 queries
  const [syncedCompanyMap, syncedContactMap] = await Promise.all([
    getSyncedCompanyMap(credentials.connectionId),
    getSyncedContactMap(credentials.connectionId),
  ])

  // Exchange PAK for OAuth token, or use as direct bearer token
  let client: HubSpotClient
  try {
    const tokenResponse = await exchangePersonalAccessKey(credentials.accessToken)
    client = new HubSpotClient(tokenResponse.oauthAccessToken)
  } catch {
    // Not a PAK - use as direct bearer token (private app / OAuth)
    client = new HubSpotClient(credentials.accessToken)
  }

  // Parse date filters
  let fromDate: Date | undefined
  if (filterConfig.fromDate) {
    fromDate = new Date(filterConfig.fromDate)
  }

  // In incremental mode, use lastSyncAt as fromDate floor
  if (syncMode === 'incremental' && credentials.lastSyncAt) {
    const lastSyncDate = new Date(credentials.lastSyncAt)
    if (!fromDate || lastSyncDate > fromDate) {
      fromDate = lastSyncDate
      console.log(`[hubspot.sync] Incremental sync: using lastSyncAt ${credentials.lastSyncAt} as fromDate`)
    }
  }

  let companiesFound = 0
  let companiesSynced = 0
  let companiesSkipped = 0
  let contactsFound = 0
  let contactsSynced = 0
  let contactsSkipped = 0

  try {
    // Phase 1: Sync companies
    options.onProgress?.({
      type: 'progress',
      message: 'Syncing companies...',
      current: 0,
      total: 0,
    })

    for await (const hsCompany of client.searchCompanies({
      fromDate,
      signal: options.signal,
      onProgress: (_fetched, total) => { companiesFound = total },
    })) {
      if (options.signal?.aborted) break

      try {
        const result = await processCompany(projectId, credentials.connectionId, hsCompany, overwritePolicy, syncedCompanyMap)
        if (result === 'synced' || result === 'updated') {
          companiesSynced++
        } else {
          companiesSkipped++
        }
      } catch (err) {
        console.error(`[hubspot.sync] Error processing company ${hsCompany.id}:`, err)
        companiesSkipped++
      }

      if ((companiesSynced + companiesSkipped) % 10 === 0) {
        options.onProgress?.({
          type: 'progress',
          message: `Companies: ${companiesSynced} synced, ${companiesSkipped} skipped of ${companiesFound}`,
          current: companiesSynced + companiesSkipped,
          total: companiesFound,
        })
      }
    }

    if (options.signal?.aborted) {
      throw new Error('Sync aborted')
    }

    // Phase 2: Sync contacts
    options.onProgress?.({
      type: 'progress',
      message: `Companies done (${companiesSynced} synced). Syncing contacts...`,
      current: 0,
      total: 0,
    })

    for await (const hsContact of client.searchContacts({
      fromDate,
      signal: options.signal,
      onProgress: (_fetched, total) => { contactsFound = total },
    })) {
      if (options.signal?.aborted) break

      try {
        const result = await processContact(projectId, credentials.connectionId, hsContact, overwritePolicy, syncedContactMap)
        if (result === 'synced' || result === 'updated') {
          contactsSynced++
        } else {
          contactsSkipped++
        }
      } catch (err) {
        console.error(`[hubspot.sync] Error processing contact ${hsContact.id}:`, err)
        contactsSkipped++
      }

      if ((contactsSynced + contactsSkipped) % 10 === 0) {
        options.onProgress?.({
          type: 'progress',
          message: `Contacts: ${contactsSynced} synced, ${contactsSkipped} skipped of ${contactsFound}`,
          current: contactsSynced + contactsSkipped,
          total: contactsFound,
        })
      }
    }

    // Update sync state
    await updateSyncState(projectId, {
      status: 'success',
      companiesCount: companiesSynced,
      contactsCount: contactsSynced,
    })

    if (runId) {
      await completeSyncRun(runId, {
        status: 'success',
        companiesFound, companiesSynced, companiesSkipped,
        contactsFound, contactsSynced, contactsSkipped,
      })
    }

    return {
      success: true,
      companiesFound, companiesSynced, companiesSkipped,
      contactsFound, contactsSynced, contactsSkipped,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    console.error('[hubspot.sync] Sync failed:', error)

    await updateSyncState(projectId, { status: 'error', error: errorMessage })

    if (runId) {
      await completeSyncRun(runId, {
        status: 'error',
        companiesFound, companiesSynced, companiesSkipped,
        contactsFound, contactsSynced, contactsSkipped,
        errorMessage,
      })
    }

    if (error instanceof HubSpotRateLimitError) {
      return {
        success: false,
        companiesFound, companiesSynced, companiesSkipped,
        contactsFound, contactsSynced, contactsSkipped,
        error: `Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`,
      }
    }

    if (error instanceof HubSpotApiError) {
      return {
        success: false,
        companiesFound, companiesSynced, companiesSkipped,
        contactsFound, contactsSynced, contactsSkipped,
        error: `HubSpot API error: ${error.message}`,
      }
    }

    return {
      success: false,
      companiesFound, companiesSynced, companiesSkipped,
      contactsFound, contactsSynced, contactsSkipped,
      error: errorMessage,
    }
  }
}
