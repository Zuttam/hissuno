/**
 * Contacts Queries (Drizzle)
 *
 * Pure database operations for contacts.
 */

import { eq, and, desc, ilike, or, count as drizzleCount, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts, sessions, issues, entityRelationships } from '@/lib/db/schema/app'
import { sanitizeSearchInput } from '@/lib/db/server'
import type {
  ContactRecord,
  ContactWithCompany,
  ContactFilters,
  UpdateContactInput,
} from '@/types/customer'
import type { SessionSource } from '@/types/session'
import type { IssueType, IssueStatus } from '@/types/issue'

export type ContactRow = typeof contacts.$inferSelect
export type ContactInsert = typeof contacts.$inferInsert

// ============================================================================
// Pure DB Operations
// ============================================================================

export interface InsertContactData {
  projectId: string
  name: string
  email: string
  companyId?: string | null
  role?: string | null
  title?: string | null
  phone?: string | null
  companyUrl?: string | null
  isChampion?: boolean
  lastContactedAt?: string | null
  notes?: string | null
  customFields?: Record<string, unknown>
}

export async function insertContact(
  data: InsertContactData
): Promise<ContactRecord> {
  const [contact] = await db
    .insert(contacts)
    .values({
      project_id: data.projectId,
      name: data.name,
      email: data.email,
      company_id: data.companyId ?? null,
      role: data.role ?? null,
      title: data.title ?? null,
      phone: data.phone ?? null,
      company_url: data.companyUrl ?? null,
      is_champion: data.isChampion ?? false,
      last_contacted_at: data.lastContactedAt ? new Date(data.lastContactedAt) : null,
      notes: data.notes ?? null,
      custom_fields: data.customFields ?? {},
      is_archived: false,
    })
    .returning()

  if (!contact) {
    throw new Error('Failed to insert contact: Unknown error')
  }

  return contact as unknown as ContactRecord
}

export async function updateContactById(
  contactId: string,
  data: UpdateContactInput
): Promise<ContactRecord> {
  const updates: Record<string, unknown> = {}

  if (data.name !== undefined) updates.name = data.name
  if (data.email !== undefined) updates.email = data.email
  if (data.company_id !== undefined) updates.company_id = data.company_id
  if (data.role !== undefined) updates.role = data.role
  if (data.title !== undefined) updates.title = data.title
  if (data.phone !== undefined) updates.phone = data.phone
  if (data.company_url !== undefined) updates.company_url = data.company_url
  if (data.is_champion !== undefined) updates.is_champion = data.is_champion
  if (data.last_contacted_at !== undefined) updates.last_contacted_at = data.last_contacted_at ? new Date(data.last_contacted_at) : null
  if (data.notes !== undefined) updates.notes = data.notes
  if (data.custom_fields !== undefined) updates.custom_fields = data.custom_fields

  const [contact] = await db
    .update(contacts)
    .set(updates)
    .where(eq(contacts.id, contactId))
    .returning()

  if (!contact) {
    throw new Error('Failed to update contact: Not found')
  }

  return contact as unknown as ContactRecord
}

export async function deleteContactById(
  contactId: string
): Promise<boolean> {
  await db
    .delete(contacts)
    .where(eq(contacts.id, contactId))

  return true
}

export async function updateContactArchiveStatus(
  contactId: string,
  isArchived: boolean
): Promise<ContactRecord> {
  const [data] = await db
    .update(contacts)
    .set({ is_archived: isArchived })
    .where(eq(contacts.id, contactId))
    .returning()

  if (!data) {
    throw new Error('Failed to update contact archive status: Not found')
  }

  return data as unknown as ContactRecord
}

// ============================================================================
// Query Functions (use user-authenticated client, with caching)
// ============================================================================

export async function listContacts(
  projectId: string,
  filters: ContactFilters
): Promise<{ contacts: ContactWithCompany[]; total: number }> {
  try {
    // Build conditions
    const conditions = []

    // Filter archived (hidden by default)
    if (!filters.showArchived) {
      conditions.push(eq(contacts.is_archived, false))
    }

    conditions.push(eq(contacts.project_id, projectId))

    if (filters.companyId) {
      conditions.push(eq(contacts.company_id, filters.companyId))
    }
    if (filters.isChampion !== undefined) {
      conditions.push(eq(contacts.is_champion, filters.isChampion))
    }
    if (filters.search) {
      const s = sanitizeSearchInput(filters.search)
      conditions.push(
        or(
          ilike(contacts.name, `%${s}%`),
          ilike(contacts.email, `%${s}%`)
        )!
      )
    }
    if (filters.role) {
      conditions.push(ilike(contacts.role, `%${sanitizeSearchInput(filters.role)}%`))
    }
    if (filters.title) {
      conditions.push(ilike(contacts.title, `%${sanitizeSearchInput(filters.title)}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const [countResult] = await db
      .select({ count: drizzleCount() })
      .from(contacts)
      .where(whereClause)

    const total = countResult?.count ?? 0

    // Get paginated results with company relation
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    const rows = await db.query.contacts.findMany({
      where: whereClause,
      with: {
        company: {
          columns: { id: true, name: true, domain: true },
        },
      },
      orderBy: desc(contacts.updated_at),
      limit,
      offset,
    })

    return { contacts: rows as unknown as ContactWithCompany[], total }
  } catch (error) {
    console.error('[db.contacts] unexpected error listing contacts', error)
    throw error
  }
}

export async function getContactById(contactId: string): Promise<ContactWithCompany | null> {
  try {
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
      with: {
        company: {
          columns: { id: true, name: true, domain: true },
        },
      },
    })

    if (!contact) {
      return null
    }

    return contact as unknown as ContactWithCompany
  } catch (error) {
    console.error('[db.contacts] unexpected error getting contact', contactId, error)
    throw error
  }
}

// ============================================================================
// Linked Sessions & Issues for Contact Sidebar
// ============================================================================

export interface ContactLinkedSession {
  id: string
  name: string | null
  source: SessionSource
  message_count: number
  created_at: string
  status: string
}

export interface ContactLinkedIssue {
  id: string
  title: string
  type: IssueType
  status: IssueStatus
  upvote_count: number
  created_at: string
}

/**
 * Get sessions linked to a contact.
 */
export async function getContactLinkedSessions(contactId: string, limit = 20): Promise<ContactLinkedSession[]> {
  try {
    const rows = await db
      .select({
        id: sessions.id,
        name: sessions.name,
        source: sessions.source,
        message_count: sessions.message_count,
        created_at: sessions.created_at,
        status: sessions.status,
      })
      .from(sessions)
      .where(
        inArray(
          sessions.id,
          db
            .select({ id: entityRelationships.session_id })
            .from(entityRelationships)
            .where(
              and(
                eq(entityRelationships.contact_id, contactId),
                isNotNull(entityRelationships.session_id),
              ),
            ),
        ),
      )
      .orderBy(desc(sessions.created_at))
      .limit(limit)

    return rows.map((r) => ({
      ...r,
      created_at: r.created_at?.toISOString() ?? new Date().toISOString(),
      source: r.source as SessionSource,
      message_count: r.message_count ?? 0,
      status: r.status ?? 'active',
    })) as ContactLinkedSession[]
  } catch (error) {
    console.error('[db.contacts] unexpected error getting contact sessions', contactId, error)
    return []
  }
}

/**
 * Get issues linked to a contact (through sessions via entity_relationships).
 */
export async function getContactLinkedIssues(contactId: string, limit = 20): Promise<ContactLinkedIssue[]> {
  try {
    // Look up the contact's project to get session IDs
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
      columns: { project_id: true },
    })

    if (!contact) return []

    // Step 1: Get session IDs linked to this contact via entity_relationships
    const sessionLinks = await db
      .select({ session_id: entityRelationships.session_id })
      .from(entityRelationships)
      .where(
        and(
          eq(entityRelationships.contact_id, contactId),
          isNotNull(entityRelationships.session_id),
        ),
      )

    const sessionIds = sessionLinks
      .map((r) => r.session_id)
      .filter((id): id is string => id !== null)

    if (sessionIds.length === 0) return []

    // Step 2: Get issue IDs linked to those sessions via entity_relationships
    const issueLinks = await db
      .select({ issue_id: entityRelationships.issue_id })
      .from(entityRelationships)
      .where(
        and(
          inArray(entityRelationships.session_id, sessionIds),
          isNotNull(entityRelationships.issue_id),
        ),
      )

    const issueIds = [...new Set(
      issueLinks
        .map((r) => r.issue_id)
        .filter((id): id is string => id !== null),
    )]

    if (issueIds.length === 0) return []

    // Step 3: Fetch issue details
    const issueRows = await db
      .select({
        id: issues.id,
        title: issues.title,
        type: issues.type,
        status: issues.status,
        upvote_count: issues.upvote_count,
        created_at: issues.created_at,
      })
      .from(issues)
      .where(inArray(issues.id, issueIds.slice(0, limit)))

    return issueRows.map((issue) => ({
      id: issue.id,
      title: issue.title,
      type: issue.type as IssueType,
      status: issue.status as IssueStatus,
      upvote_count: issue.upvote_count ?? 0,
      created_at: issue.created_at?.toISOString() ?? new Date().toISOString(),
    }))
  } catch (error) {
    console.error('[db.contacts] unexpected error getting contact issues', contactId, error)
    return []
  }
}
