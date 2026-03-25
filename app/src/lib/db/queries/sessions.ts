/**
 * Sessions Database Layer (Drizzle ORM)
 */

import {
  eq,
  and,
  desc,
  sql,
  count as countFn,
  inArray,
  ilike,
  gte,
  lte,
  isNotNull,
} from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  sessions,
  contacts,
  entityRelationships,
  issues,
} from '@/lib/db/schema/app'
import { sanitizeSearchInput, dateToIso } from '@/lib/db/server'
import { setSessionContact, setEntityProductScope, getSessionLinkedIssueIds, getRelatedIds } from '@/lib/db/queries/entity-relationships'
import { ensureSessionName } from '@/lib/sessions/name-generator'
import { sendHumanNeededNotification } from '@/lib/notifications/human-needed-notifications'
import type {
  SessionRecord,
  SessionWithProject,
  SessionFilters,
  SessionLinkedIssue,
  SessionTag,
  SessionSource,
  SessionType,
  UpdateSessionInput,
} from '@/types/session'
import { getDefaultSessionType } from '@/types/session'

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/** Convert a Drizzle session row to the SessionRecord-compatible shape */
export function rowToSessionRecord(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    ...row,
    user_metadata: row.user_metadata as Record<string, string> | null,
    analysis_status: (row.analysis_status ?? 'pending') as SessionRecord['analysis_status'],
    source: (row.source ?? 'widget') as SessionSource,
    session_type: (row.session_type ?? 'chat') as SessionType,
    message_count: row.message_count ?? 0,
    status: (row.status ?? 'active') as SessionRecord['status'],
    tags: (row.tags ?? []) as SessionTag[],
    custom_fields: (row.custom_fields as Record<string, unknown>) ?? {},
    tags_auto_applied_at: dateToIso(row.tags_auto_applied_at),
    first_message_at: dateToIso(row.first_message_at),
    last_activity_at: row.last_activity_at?.toISOString() ?? new Date().toISOString(),
    pm_reviewed_at: dateToIso(row.pm_reviewed_at),
    goodbye_detected_at: dateToIso(row.goodbye_detected_at),
    idle_prompt_sent_at: dateToIso(row.idle_prompt_sent_at),
    scheduled_close_at: dateToIso(row.scheduled_close_at),
    is_archived: row.is_archived,
    is_human_takeover: row.is_human_takeover,
    human_takeover_at: dateToIso(row.human_takeover_at),
    // These fields exist on SessionRecord but not on the Drizzle schema columns.
    // They may be populated by downstream logic or stored differently.
    human_takeover_user_id: null,
    human_takeover_slack_channel_id: null,
    human_takeover_slack_thread_ts: null,
    created_at: row.created_at?.toISOString() ?? new Date().toISOString(),
    updated_at: row.updated_at?.toISOString() ?? new Date().toISOString(),
  } as SessionRecord
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Upserts a session record. Uses admin client since this is called
 * from the copilotkit route which doesn't have user auth context.
 *
 * Note: Limits are enforced at analysis time (PM review), not at session creation.
 */
export async function upsertSession(params: {
  id: string
  projectId: string
  userId?: string | null
  userMetadata?: Record<string, string> | null
  pageUrl?: string | null
  pageTitle?: string | null
  source?: SessionSource | null
  sessionType?: SessionType | null
}): Promise<void> {
  try {
    const now = new Date()
    const mergedMetadata = {
      ...(params.userMetadata || {}),
      ...(params.userId ? { userId: params.userId } : {}),
    }
    await db
      .insert(sessions)
      .values({
        id: params.id,
        project_id: params.projectId,
        user_metadata: mergedMetadata,
        page_url: params.pageUrl || null,
        page_title: params.pageTitle || null,
        source: params.source || 'widget',
        session_type: params.sessionType || getDefaultSessionType(params.source || 'widget'),
        last_activity_at: now,
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          user_metadata: mergedMetadata,
          page_url: params.pageUrl || null,
          page_title: params.pageTitle || null,
          source: params.source || 'widget',
          session_type: params.sessionType || getDefaultSessionType(params.source || 'widget'),
          last_activity_at: now,
        },
      })
  } catch (error) {
    console.error('[db.sessions] unexpected error upserting session', params.id, error)
  }
}

/**
 * Updates the last activity timestamp and increments message count for a session.
 * Also triggers name generation after 3+ messages if no name exists.
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  try {
    const now = new Date()

    // Single atomic update: increment count, set first_message_at if null
    const [updated] = await db
      .update(sessions)
      .set({
        last_activity_at: now,
        message_count: sql`COALESCE(${sessions.message_count}, 0) + 1`,
        first_message_at: sql`COALESCE(${sessions.first_message_at}, ${now})`,
      })
      .where(eq(sessions.id, sessionId))
      .returning({
        message_count: sessions.message_count,
        name: sessions.name,
        project_id: sessions.project_id,
      })

    // Trigger name generation after 3+ messages if no name exists (fire-and-forget)
    if (updated && (updated.message_count ?? 0) >= 3 && !updated.name && updated.project_id) {
      void ensureSessionName({
        sessionId,
        projectId: updated.project_id,
      })
    }
  } catch (error) {
    console.error('[db.sessions] error updating session activity', sessionId, error)
  }
}

// ---------------------------------------------------------------------------
// Shared filter builder
// ---------------------------------------------------------------------------

/**
 * Builds filter conditions for listSessions.
 * Handles every filter EXCEPT companyId (which needs project-scoped contact lookup).
 */
function buildSessionFilterConditions(filters: SessionFilters): SQL[] {
  const conditions: SQL[] = []
  if (!filters.showArchived) {
    conditions.push(eq(sessions.is_archived, false))
  }
  if (filters.sessionId) {
    conditions.push(ilike(sessions.id, `%${sanitizeSearchInput(filters.sessionId)}%`))
  }
  if (filters.name) {
    conditions.push(ilike(sessions.name, `%${sanitizeSearchInput(filters.name)}%`))
  }
  if (filters.status) {
    conditions.push(eq(sessions.status, filters.status))
  }
  if (filters.source) {
    conditions.push(eq(sessions.source, filters.source))
  }
  if (filters.sessionType) {
    conditions.push(eq(sessions.session_type, filters.sessionType))
  }
  if (filters.isHumanTakeover) {
    conditions.push(eq(sessions.is_human_takeover, true))
  }
  if (filters.tags && filters.tags.length > 0) {
    conditions.push(sql`${sessions.tags} && ${sql.param(filters.tags)}::text[]`)
  }
  if (filters.dateFrom) {
    conditions.push(gte(sessions.created_at, new Date(filters.dateFrom)))
  }
  if (filters.dateTo) {
    conditions.push(lte(sessions.created_at, new Date(filters.dateTo)))
  }
  if (filters.contactId) {
    conditions.push(
      inArray(
        sessions.id,
        db.select({ id: entityRelationships.session_id })
          .from(entityRelationships)
          .where(
            and(
              eq(entityRelationships.contact_id, filters.contactId),
              isNotNull(entityRelationships.session_id),
            )
          ),
      )
    )
  }
  if (filters.isAnalyzed) {
    conditions.push(eq(sessions.analysis_status, 'analyzed'))
  }
  if (filters.productScopeIds && filters.productScopeIds.length > 0) {
    conditions.push(
      inArray(
        sessions.id,
        db.select({ id: entityRelationships.session_id })
          .from(entityRelationships)
          .where(
            and(
              inArray(entityRelationships.product_scope_id, filters.productScopeIds),
              isNotNull(entityRelationships.session_id),
            )
          ),
      )
    )
  }
  return conditions
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Lists sessions for a single project. Callers are responsible for
 * verifying that the caller has access to `projectId`.
 */
export async function listSessions(
  projectId: string,
  filters: SessionFilters
): Promise<{ sessions: SessionWithProject[]; total: number }> {
  try {
    // Search across message content, session name, and contact name via database RPC
    if (filters.search && filters.search.trim().length >= 2) {
      const searchTerm = filters.search.trim()
      const sanitized = sanitizeSearchInput(searchTerm)
      const limit = filters.limit ?? 50
      const offset = filters.offset ?? 0

      // Phase 1: RPC handles search + filters + pagination
      const searchResults = await db.execute<{ session_id: string; total_count: number }>(sql`
        SELECT * FROM search_sessions_multi(
          p_project_id := ${projectId}::uuid,
          p_query := ${searchTerm},
          p_query_like := ${sanitized},
          p_status := ${filters.status || null},
          p_source := ${filters.source || null},
          p_session_type := ${filters.sessionType || null},
          p_is_human_takeover := ${filters.isHumanTakeover || null}::boolean,
          p_is_archived := ${filters.showArchived ?? false},
          p_is_analyzed := ${filters.isAnalyzed || null}::boolean,
          p_tags := ${filters.tags && filters.tags.length > 0 ? filters.tags : null}::text[],
          p_date_from := ${filters.dateFrom || null}::timestamptz,
          p_date_to := ${filters.dateTo || null}::timestamptz,
          p_contact_id := ${filters.contactId || null}::uuid,
          p_company_id := ${filters.companyId || null}::uuid,
          p_product_area_ids := ${filters.productScopeIds && filters.productScopeIds.length > 0 ? filters.productScopeIds : null}::uuid[],
          p_limit := ${limit},
          p_offset := ${offset}
        )
      `)

      if (!searchResults.rows || searchResults.rows.length === 0) {
        return { sessions: [], total: 0 }
      }

      const matchedIds = searchResults.rows.map((r) => r.session_id)
      const totalCount = searchResults.rows[0].total_count

      // Phase 2: Fetch full session data for this page of IDs
      const results = await db.query.sessions.findMany({
        where: inArray(sessions.id, matchedIds),
        with: {
          project: { columns: { id: true, name: true } },
        },
        orderBy: [desc(sessions.last_activity_at)],
      })

      // Batch-fetch contacts and issue counts from entity_relationships
      const enrichedResults = await enrichSessionsWithEntityRelationships(results)
      const mapped = enrichedResults.map((r) => toSessionWithProject(r))
      return { sessions: mapped, total: Number(totalCount) }
    }

    // Build conditions array for non-search queries
    const conditions = [eq(sessions.project_id, projectId), ...buildSessionFilterConditions(filters)]

    if (filters.companyId) {
      conditions.push(
        inArray(
          sessions.id,
          db.select({ id: entityRelationships.session_id })
            .from(entityRelationships)
            .innerJoin(contacts, eq(entityRelationships.contact_id, contacts.id))
            .where(
              and(
                eq(contacts.company_id, filters.companyId),
                eq(contacts.project_id, projectId),
                isNotNull(entityRelationships.session_id),
              )
            ),
        )
      )
    }

    const whereClause = and(...conditions)
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    // Run count + data queries in parallel
    const [countResult, results] = await Promise.all([
      db.select({ total: countFn() }).from(sessions).where(whereClause),
      db.query.sessions.findMany({
        where: whereClause,
        with: {
          project: { columns: { id: true, name: true } },
        },
        orderBy: [desc(sessions.last_activity_at)],
        limit,
        offset,
      }),
    ])
    const total = countResult[0].total

    // Batch-fetch contacts and issue counts from entity_relationships
    const enrichedResults = await enrichSessionsWithEntityRelationships(results)
    const mapped = enrichedResults.map((r) => toSessionWithProject(r))
    return { sessions: mapped, total: Number(total) }
  } catch (error) {
    console.error('[db.sessions] unexpected error listing sessions', error)
    throw error
  }
}

/**
 * Gets a session by ID. Requires authenticated user context.
 * Only returns the session if it belongs to a project owned by the current user.
 * Includes linked issues from PM review.
 */
export async function getSessionById(sessionId: string): Promise<SessionWithProject | null> {
  try {
    const result = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: {
        project: { columns: { id: true, name: true } },
      },
    })

    if (!result) return null

    // Fetch linked entities from entity_relationships (in parallel - independent queries)
    const [linkedIssueIds, contactIds, productScopeIds] = await Promise.all([
      getSessionLinkedIssueIds(result.project_id, sessionId),
      getRelatedIds(result.project_id, 'session', sessionId, 'contact'),
      getRelatedIds(result.project_id, 'session', sessionId, 'product_scope'),
    ])
    let linked_issues: SessionLinkedIssue[] = []
    if (linkedIssueIds.length > 0) {
      const issueRows = await db
        .select({
          id: issues.id,
          title: issues.title,
          type: issues.type,
          status: issues.status,
          upvote_count: issues.upvote_count,
          priority: issues.priority,
        })
        .from(issues)
        .where(inArray(issues.id, linkedIssueIds))
      linked_issues = issueRows as SessionLinkedIssue[]
    }
    let contactData: SessionWithProject['contact'] = null
    const contactId = contactIds.length > 0 ? contactIds[0] : null
    const productScopeId = productScopeIds.length > 0 ? productScopeIds[0] : null
    if (contactId) {
      const contactRows = await db.query.contacts.findFirst({
        where: eq(contacts.id, contactId),
        columns: { id: true, name: true, email: true },
        with: {
          company: { columns: { id: true, name: true, domain: true, arr: true, stage: true } },
        },
      })
      if (contactRows) {
        contactData = {
          id: contactRows.id,
          name: contactRows.name,
          email: contactRows.email,
          company: contactRows.company
            ? {
                id: contactRows.company.id,
                name: contactRows.company.name,
                domain: contactRows.company.domain,
                arr: contactRows.company.arr,
                stage: contactRows.company.stage ?? '',
              }
            : null,
        }
      }
    }

    const sessionRecord = rowToSessionRecord(result)

    const sessionWithProject: SessionWithProject = {
      ...sessionRecord,
      contact_id: contactId,
      product_scope_id: productScopeId,
      project: result.project ? { id: result.project.id, name: result.project.name } : null,
      linked_issues,
      contact: contactData,
    }

    return sessionWithProject
  } catch (error) {
    console.error('[db.sessions] unexpected error getting session', sessionId, error)
    throw error
  }
}

/**
 * Gets recent sessions for a specific project.
 */
export async function getProjectSessions(projectId: string, limit = 5): Promise<SessionWithProject[]> {
  try {
    const results = await db.query.sessions.findMany({
      where: eq(sessions.project_id, projectId),
      with: {
        project: { columns: { id: true, name: true } },
      },
      orderBy: [desc(sessions.last_activity_at)],
      limit,
    })

    // Batch-fetch contacts and issue counts from entity_relationships
    const enrichedResults = await enrichSessionsWithEntityRelationships(results)
    const mapped = enrichedResults.map((r) => toSessionWithProject(r))
    return mapped
  } catch (error) {
    console.error('[db.sessions] unexpected error getting project sessions', projectId, error)
    throw error
  }
}

/**
 * Updates tags for a session. Uses admin client for workflow/API use.
 * Accepts both native SessionTag values and custom label slugs as strings.
 */
export async function updateSessionTags(
  sessionId: string,
  tags: string[],
  autoApplied = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date()
    const updates: Record<string, unknown> = {
      tags,
      updated_at: now,
    }

    if (autoApplied) {
      updates.tags_auto_applied_at = now
    }

    await db.update(sessions).set(updates).where(eq(sessions.id, sessionId))
    return { success: true }
  } catch (error) {
    console.error('[db.sessions] unexpected error updating session tags', sessionId, error)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Updates the product_scope_id for a session. Uses admin client for workflow/API use.
 */
export async function updateSessionProductScope(
  sessionId: string,
  productScopeId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionRow = await db.select({ project_id: sessions.project_id }).from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!sessionRow[0]) {
      return { success: false, error: 'Session not found' }
    }

    await setEntityProductScope(sessionRow[0].project_id, 'session', sessionId, productScopeId)

    // Touch updated_at on the session
    await db
      .update(sessions)
      .set({ updated_at: new Date() })
      .where(eq(sessions.id, sessionId))

    return { success: true }
  } catch (error) {
    console.error('[db.sessions] unexpected error updating session product scope', sessionId, error)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Gets integration stats for a project (for widget status indicator).
 * Returns last activity timestamp and whether there's been recent activity.
 */
export interface IntegrationStats {
  lastActivityAt: string | null
  isActive: boolean // Has sessions in last 7 days
  hasAnySessions: boolean // Has ever received any sessions
}

export async function getProjectIntegrationStats(projectId: string): Promise<IntegrationStats> {
  try {
    // Get most recent widget session
    const [latest] = await db
      .select({ last_activity_at: sessions.last_activity_at })
      .from(sessions)
      .where(and(eq(sessions.project_id, projectId), eq(sessions.source, 'widget')))
      .orderBy(desc(sessions.last_activity_at))
      .limit(1)

    // Check for widget activity in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [{ recentCount }] = await db
      .select({ recentCount: countFn() })
      .from(sessions)
      .where(
        and(
          eq(sessions.project_id, projectId),
          eq(sessions.source, 'widget'),
          gte(sessions.last_activity_at, sevenDaysAgo),
        )
      )

    return {
      lastActivityAt: latest?.last_activity_at?.toISOString() ?? null,
      isActive: Number(recentCount) > 0,
      hasAnySessions: !!latest,
    }
  } catch {
    return { lastActivityAt: null, isActive: false, hasAnySessions: false }
  }
}

/**
 * Updates the archive status of a session.
 */
export async function updateSessionArchiveStatus(
  sessionId: string,
  isArchived: boolean
): Promise<SessionRecord | null> {
  try {
    const [updated] = await db
      .update(sessions)
      .set({
        is_archived: isArchived,
        updated_at: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning()

    return updated ? rowToSessionRecord(updated) : null
  } catch (error) {
    console.error('[db.sessions] unexpected error updating session archive status', sessionId, error)
    throw error
  }
}

/**
 * Updates a session.
 */
export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput
): Promise<SessionRecord | null> {
  try {
    // Get session to find project_id for contact linking
    const [session] = await db
      .select({ project_id: sessions.project_id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)

    if (!session) return null

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date(),
    }

    if (input.name !== undefined) updates.name = input.name
    if (input.status !== undefined) updates.status = input.status
    if (input.user_metadata !== undefined) updates.user_metadata = input.user_metadata
    if (input.is_human_takeover !== undefined) {
      updates.is_human_takeover = input.is_human_takeover
      updates.human_takeover_at = input.is_human_takeover ? new Date() : null
    }
    if (input.custom_fields !== undefined) updates.custom_fields = input.custom_fields

    const [updated] = await db
      .update(sessions)
      .set(updates)
      .where(eq(sessions.id, sessionId))
      .returning()

    if (!updated) return null

    // Write contact to entity_relationships
    if (input.contact_id !== undefined) {
      await setSessionContact(session.project_id, sessionId, input.contact_id ?? null)
    }

    const result = rowToSessionRecord(updated)

    // Re-embed if name changed (fire-and-forget)
    if (input.name !== undefined && result.name && result.description) {
      const { fireEmbedding } = await import('@/lib/utils/embeddings')
      const { buildSessionEmbeddingText } = await import('@/lib/sessions/embedding-service')
      fireEmbedding(sessionId, 'session', result.project_id, buildSessionEmbeddingText(result.name, result.description))
    }

    return result
  } catch (error) {
    console.error('[db.sessions] unexpected error updating session', sessionId, error)
    throw error
  }
}

/**
 * Sets the human takeover flag on a session. Uses admin client for agent/integration use.
 * When enabling takeover, sends a notification to the project owner.
 */
export async function setSessionHumanTakeover(sessionId: string, enabled: boolean): Promise<void> {
  try {
    const now = new Date()

    const [updated] = await db
      .update(sessions)
      .set({
        is_human_takeover: enabled,
        human_takeover_at: enabled ? now : null,
        updated_at: now,
      })
      .where(eq(sessions.id, sessionId))
      .returning({ project_id: sessions.project_id, name: sessions.name })

    // Send notification when enabling human takeover (fire-and-forget)
    if (enabled && updated) {
      void sendHumanNeededNotification({
        sessionId,
        projectId: updated.project_id,
        sessionName: updated.name,
      }).catch((err) => {
        console.error('[db.sessions] failed to send human needed notification', err)
      })
    }
  } catch (error) {
    console.error('[db.sessions] unexpected error setting human takeover', sessionId, error)
  }
}

/**
 * Gets closed sessions that haven't been PM reviewed yet (pending reviews).
 * Returns limited results plus total count for the badge.
 */
export async function getPendingPMReviews(
  projectId: string,
  limit = 8
): Promise<{
  sessions: {
    id: string
    name: string | null
    user_metadata: Record<string, string> | null
    source: SessionSource
    message_count: number
    created_at: string
  }[]
  count: number
}> {
  try {
    const whereClause = and(
      eq(sessions.project_id, projectId),
      eq(sessions.analysis_status, 'pending'),
      eq(sessions.status, 'closed'),
      eq(sessions.is_archived, false),
    )

    const [{ total }] = await db.select({ total: countFn() }).from(sessions).where(whereClause)

    const rows = await db
      .select({
        id: sessions.id,
        name: sessions.name,
        user_metadata: sessions.user_metadata,
        source: sessions.source,
        message_count: sessions.message_count,
        created_at: sessions.created_at,
      })
      .from(sessions)
      .where(whereClause)
      .orderBy(desc(sessions.created_at))
      .limit(limit)

    return {
      sessions: rows.map((r) => ({
        id: r.id,
        name: r.name,
        user_metadata: r.user_metadata as Record<string, string> | null,
        source: (r.source ?? 'widget') as SessionSource,
        message_count: r.message_count ?? 0,
        created_at: r.created_at?.toISOString() ?? new Date().toISOString(),
      })),
      count: Number(total),
    }
  } catch (error) {
    console.error('[db.sessions.getPendingPMReviews] Unexpected error', projectId, error)
    return { sessions: [], count: 0 }
  }
}

/**
 * Checks if a session is in human takeover mode.
 */
export async function isSessionInHumanTakeover(sessionId: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ is_human_takeover: sessions.is_human_takeover })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)

    return row?.is_human_takeover === true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Internal: enrich sessions with contact/issue data from entity_relationships
// ---------------------------------------------------------------------------

type SessionQueryResult = Awaited<ReturnType<typeof db.query.sessions.findMany>>[number]

/**
 * Batch-fetch contacts (with companies) and issue counts from entity_relationships
 * for a list of sessions.
 */
export async function enrichSessionsWithEntityRelationships(
  sessionList: SessionQueryResult[]
): Promise<(SessionQueryResult & {
  contact?: { id: string; name: string; email: string; company: { id: string; name: string; domain: string; arr: number | null; stage: string | null } | null } | null
  contact_id?: string | null
  product_scope_id?: string | null
  linked_issue_count?: number
})[]> {
  if (sessionList.length === 0) return sessionList

  const sessionIds = sessionList.map((s) => s.id)

  // Batch-fetch all entity_relationships rows for these sessions
  const erRows = await db
    .select({
      session_id: entityRelationships.session_id,
      contact_id: entityRelationships.contact_id,
      issue_id: entityRelationships.issue_id,
      product_scope_id: entityRelationships.product_scope_id,
    })
    .from(entityRelationships)
    .where(inArray(entityRelationships.session_id, sessionIds))

  // Build maps: session_id -> contact_id, session_id -> product_scope_id, session_id -> issue count
  const contactIdBySession = new Map<string, string>()
  const productScopeIdBySession = new Map<string, string>()
  const issueCountBySession = new Map<string, number>()

  for (const row of erRows) {
    if (!row.session_id) continue
    if (row.contact_id && !contactIdBySession.has(row.session_id)) {
      contactIdBySession.set(row.session_id, row.contact_id)
    }
    if (row.product_scope_id && !productScopeIdBySession.has(row.session_id)) {
      productScopeIdBySession.set(row.session_id, row.product_scope_id)
    }
    if (row.issue_id) {
      issueCountBySession.set(row.session_id, (issueCountBySession.get(row.session_id) ?? 0) + 1)
    }
  }

  // Batch-fetch contacts with companies
  const uniqueContactIds = [...new Set(contactIdBySession.values())]
  const contactMap = new Map<string, {
    id: string; name: string; email: string
    company: { id: string; name: string; domain: string; arr: number | null; stage: string | null } | null
  }>()

  if (uniqueContactIds.length > 0) {
    const contactRows = await db.query.contacts.findMany({
      where: inArray(contacts.id, uniqueContactIds),
      columns: { id: true, name: true, email: true },
      with: {
        company: { columns: { id: true, name: true, domain: true, arr: true, stage: true } },
      },
    })
    for (const c of contactRows) {
      contactMap.set(c.id, {
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company ?? null,
      })
    }
  }

  // Merge data onto session results
  return sessionList.map((s) => {
    const contactId = contactIdBySession.get(s.id)
    return {
      ...s,
      contact: contactId ? (contactMap.get(contactId) ?? null) : null,
      contact_id: contactId ?? null,
      product_scope_id: productScopeIdBySession.get(s.id) ?? null,
      linked_issue_count: issueCountBySession.get(s.id) ?? 0,
    }
  })
}

// ---------------------------------------------------------------------------
// Internal: transform relational query result to SessionWithProject
// ---------------------------------------------------------------------------

export type SessionRelationalResult = Awaited<ReturnType<typeof enrichSessionsWithEntityRelationships>>[number]

export function toSessionWithProject(r: SessionRelationalResult): SessionWithProject {
  const record = rowToSessionRecord(r)

  const projectData = ('project' in r && r.project)
    ? { id: (r.project as { id: string; name: string }).id, name: (r.project as { id: string; name: string }).name }
    : null

  const contact = r.contact
  const contactData = contact
    ? {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company: contact.company
          ? {
              id: contact.company.id,
              name: contact.company.name,
              domain: contact.company.domain,
              arr: contact.company.arr,
              stage: contact.company.stage ?? '',
            }
          : null,
      }
    : null

  return {
    ...record,
    contact_id: r.contact_id ?? null,
    product_scope_id: r.product_scope_id ?? null,
    project: projectData,
    contact: contactData,
    linked_issue_count: r.linked_issue_count ?? 0,
  }
}
