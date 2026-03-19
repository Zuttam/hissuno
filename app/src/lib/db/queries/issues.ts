/**
 * Issues Database Layer (Drizzle ORM)
 *
 * Pure database operations for issues. This layer handles Drizzle queries
 * and does NOT handle embeddings or business logic orchestration.
 *
 * For service-level operations (with embeddings), use lib/issues/issues-service.ts
 */

import { cache } from 'react'
import {
  eq,
  and,
  desc,
  sql,
  count as countFn,
  inArray,
  gte,
  lte,
  not,
  isNotNull,
} from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  issues,
  sessions,
  projects,
  projectSettings,
  widgetIntegrations,
  entityRelationships,
  contacts,
} from '@/lib/db/schema/app'
import { resolveRequestContext, getUserProjectIds, sanitizeSearchInput, dateToIso } from '@/lib/db/server'
import { linkEntities, unlinkEntities, setEntityProductScope, getRelatedIds } from '@/lib/db/queries/entity-relationships'
import { hasProjectAccess } from '@/lib/auth/project-members'
import type {
  IssueRecord,
  IssueWithProject,
  IssueWithSessions,
  IssueFilters,
  UpdateIssueInput,
  ProjectSettingsRecord,
  IssuePriority,
  IssueImpactAnalysis,
  EffortEstimate,
  MetricLevel,
} from '@/types/issue'

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/** Convert a Drizzle issue row to the IssueRecord-compatible shape */
function rowToIssueRecord(row: typeof issues.$inferSelect): IssueRecord {
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type as IssueRecord['type'],
    title: row.title,
    description: row.description,
    priority: (row.priority ?? 'medium') as IssuePriority,
    priority_manual_override: row.priority_manual_override ?? false,
    upvote_count: row.upvote_count ?? 0,
    status: (row.status ?? 'open') as IssueRecord['status'],
    brief: row.brief ?? null,
    brief_generated_at: dateToIso(row.brief_generated_at),
    is_archived: row.is_archived,
    impact_score: row.impact_score ?? null,
    impact_analysis: row.impact_analysis as IssueImpactAnalysis | null,
    effort_estimate: (row.effort_estimate ?? null) as EffortEstimate | null,
    effort_reasoning: row.effort_reasoning ?? null,
    reach_score: row.reach_score ?? null,
    reach_reasoning: row.reach_reasoning ?? null,
    effort_score: row.effort_score ?? null,
    confidence_score: row.confidence_score ?? null,
    confidence_reasoning: row.confidence_reasoning ?? null,
    analysis_computed_at: dateToIso(row.analysis_computed_at),
    created_at: row.created_at?.toISOString() ?? new Date().toISOString(),
    updated_at: row.updated_at?.toISOString() ?? new Date().toISOString(),
  }
}

// ============================================================================
// Pure DB Operations
// ============================================================================

/**
 * Input for creating an issue at DB level
 */
export interface InsertIssueData {
  projectId: string
  type: 'bug' | 'feature_request' | 'change_request'
  title: string
  description: string
  priority: IssuePriority
  priorityManualOverride?: boolean
  upvoteCount?: number
  status?: 'open' | 'ready' | 'in_progress' | 'resolved' | 'closed'
  // Impact analysis fields
  impactScore?: number | null
  impactAnalysis?: IssueImpactAnalysis | null
  // Effort estimation fields
  effortEstimate?: EffortEstimate | null
  effortReasoning?: string | null
  // Product scope
  productScopeId?: string | null
}

/**
 * Insert a new issue into the database
 */
export async function insertIssue(data: InsertIssueData): Promise<IssueRecord> {
  const [issue] = await db
    .insert(issues)
    .values({
      project_id: data.projectId,
      type: data.type,
      title: data.title,
      description: data.description,
      priority: data.priority,
      priority_manual_override: data.priorityManualOverride ?? false,
      upvote_count: data.upvoteCount ?? 1,
      status: data.status ?? 'open',
      is_archived: false,
      // Impact analysis
      impact_score: data.impactScore ?? null,
      impact_analysis: data.impactAnalysis ?? null,
      // Effort estimation
      effort_estimate: data.effortEstimate ?? null,
      effort_reasoning: data.effortReasoning ?? null,
    })
    .returning()

  if (!issue) {
    throw new Error('Failed to insert issue: no row returned')
  }

  // Write product scope to entity_relationships
  if (data.productScopeId) {
    await setEntityProductScope(data.projectId, 'issue', issue.id, data.productScopeId)
  }

  return rowToIssueRecord(issue)
}

/**
 * Update an existing issue in the database
 */
export async function updateIssueById(issueId: string, data: UpdateIssueInput): Promise<IssueRecord> {
  const updates: Record<string, unknown> = {
    updated_at: new Date(),
  }

  if (data.title !== undefined) updates.title = data.title
  if (data.description !== undefined) updates.description = data.description
  if (data.type !== undefined) updates.type = data.type
  if (data.status !== undefined) updates.status = data.status
  if (data.priority !== undefined) {
    updates.priority = data.priority
    if (data.priority_manual_override === undefined) {
      updates.priority_manual_override = true
    }
  }
  if (data.priority_manual_override !== undefined) {
    updates.priority_manual_override = data.priority_manual_override
  }
  if (data.reach_score !== undefined) updates.reach_score = data.reach_score
  if (data.impact_score !== undefined) updates.impact_score = data.impact_score
  if (data.confidence_score !== undefined) updates.confidence_score = data.confidence_score
  if (data.effort_score !== undefined) updates.effort_score = data.effort_score

  const [issue] = await db
    .update(issues)
    .set(updates)
    .where(eq(issues.id, issueId))
    .returning()

  if (!issue) {
    throw new Error(`Failed to update issue: ${issueId}`)
  }

  // Write product scope to entity_relationships
  if (data.product_scope_id !== undefined) {
    await setEntityProductScope(issue.project_id, 'issue', issueId, data.product_scope_id ?? null)
  }

  return rowToIssueRecord(issue)
}

/**
 * Delete an issue from the database
 */
export async function deleteIssueById(issueId: string): Promise<boolean> {
  await db.delete(issues).where(eq(issues.id, issueId))
  return true
}

/**
 * Update upvote count and priority for an issue
 */
export async function updateIssueUpvote(
  issueId: string,
  newUpvoteCount: number,
  newPriority: IssuePriority
): Promise<IssueRecord> {
  const [issue] = await db
    .update(issues)
    .set({
      upvote_count: newUpvoteCount,
      priority: newPriority,
      updated_at: new Date(),
    })
    .where(eq(issues.id, issueId))
    .returning()

  if (!issue) {
    throw new Error(`Failed to update issue upvote: ${issueId}`)
  }

  return rowToIssueRecord(issue)
}

/**
 * Link a session to an issue via entity_relationships
 */
export async function linkSessionToIssue(issueId: string, sessionId: string): Promise<void> {
  const issueRow = await db.select({ project_id: issues.project_id }).from(issues).where(eq(issues.id, issueId)).limit(1)
  if (issueRow[0]) {
    await linkEntities(issueRow[0].project_id, 'issue', issueId, 'session', sessionId)
  }
}

/**
 * Unlink a session from an issue via entity_relationships
 */
export async function unlinkSessionFromIssue(issueId: string, sessionId: string): Promise<void> {
  const issueRow = await db.select({ project_id: issues.project_id }).from(issues).where(eq(issues.id, issueId)).limit(1)
  if (issueRow[0]) {
    await unlinkEntities(issueRow[0].project_id, 'issue', issueId, 'session', sessionId)
  }
}

/**
 * Mark a session as PM reviewed
 */
export async function markSessionPMReviewed(sessionId: string): Promise<void> {
  try {
    await db
      .update(sessions)
      .set({
        pm_reviewed_at: new Date(),
        analysis_status: 'analyzed',
      })
      .where(eq(sessions.id, sessionId))
  } catch (error) {
    console.error('[db.issues.markSessionPMReviewed] Failed', sessionId, error)
  }
}

/**
 * Get an issue by ID with minimal fields (for upvote operations)
 */
export async function getIssueForUpvote(
  issueId: string
): Promise<{
  id: string
  title: string
  projectId: string
  upvoteCount: number
  priorityManualOverride: boolean
  priority: IssuePriority
  brief: string | null
} | null> {
  const [row] = await db
    .select({
      id: issues.id,
      title: issues.title,
      project_id: issues.project_id,
      upvote_count: issues.upvote_count,
      priority_manual_override: issues.priority_manual_override,
      priority: issues.priority,
      brief: issues.brief,
    })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    upvoteCount: row.upvote_count ?? 1,
    priorityManualOverride: row.priority_manual_override ?? false,
    priority: (row.priority ?? 'medium') as IssuePriority,
    brief: row.brief ?? null,
  }
}

/**
 * Get issue with current title/description for embedding comparison
 */
export async function getIssueForEmbedding(
  issueId: string
): Promise<{ projectId: string; title: string; description: string } | null> {
  const [row] = await db
    .select({
      project_id: issues.project_id,
      title: issues.title,
      description: issues.description,
    })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1)

  if (!row) return null

  return {
    projectId: row.project_id,
    title: row.title,
    description: row.description,
  }
}

/**
 * Update issue archive status
 */
export async function updateIssueArchiveStatusById(
  issueId: string,
  isArchived: boolean
): Promise<IssueRecord> {
  const [row] = await db
    .update(issues)
    .set({
      is_archived: isArchived,
      updated_at: new Date(),
    })
    .where(eq(issues.id, issueId))
    .returning()

  if (!row) {
    throw new Error(`Failed to update issue archive status: ${issueId}`)
  }

  return rowToIssueRecord(row)
}

// ============================================================================
// Query Functions (use user-authenticated client, with caching)
// ============================================================================

/**
 * Lists issues with optional filters. Requires authenticated user context.
 * Only returns issues for projects owned by the current user.
 */
export const listIssues = cache(
  async (filters: IssueFilters = {}): Promise<{ issues: IssueWithProject[]; total: number }> => {
    try {
      const { userId, apiKeyProjectId } = await resolveRequestContext()

      if (apiKeyProjectId && !filters.projectId) {
        throw new Error('API key requests must include a projectId filter.')
      }

      // Get projects accessible by this user
      const projectIds = apiKeyProjectId ? [apiKeyProjectId] : await getUserProjectIds(userId)

      if (projectIds.length === 0) {
        return { issues: [], total: 0 }
      }

      // Search across issue title/description and linked session messages via database RPC
      if (filters.search && filters.search.trim().length >= 2 && filters.projectId) {
        const searchTerm = filters.search.trim()
        const sanitized = sanitizeSearchInput(searchTerm)
        const limit = filters.limit ?? 50
        const offset = filters.offset ?? 0

        // Build metric range params
        const reachRange = filters.reachLevel ? metricLevelToRange(filters.reachLevel) : undefined
        const impactRange = filters.impactLevel ? metricLevelToRange(filters.impactLevel) : undefined
        const confidenceRange = filters.confidenceLevel ? metricLevelToRange(filters.confidenceLevel) : undefined
        const effortRange = filters.effortLevel ? metricLevelToRange(filters.effortLevel) : undefined

        // Phase 1: RPC handles search + filters + pagination
        const searchResults = await db.execute<{ issue_id: string; total_count: number }>(sql`
          SELECT * FROM search_issues_multi(
            p_project_id := ${filters.projectId}::uuid,
            p_query := ${searchTerm},
            p_query_like := ${sanitized},
            p_type := ${filters.type || null},
            p_priority := ${filters.priority || null},
            p_status := ${filters.status || null},
            p_is_archived := ${filters.showArchived ?? false},
            p_reach_min := ${reachRange?.[0] ?? null}::double precision,
            p_reach_max := ${reachRange?.[1] ?? null}::double precision,
            p_impact_min := ${impactRange?.[0] ?? null}::double precision,
            p_impact_max := ${impactRange?.[1] ?? null}::double precision,
            p_confidence_min := ${confidenceRange?.[0] ?? null}::double precision,
            p_confidence_max := ${confidenceRange?.[1] ?? null}::double precision,
            p_effort_min := ${effortRange?.[0] ?? null}::double precision,
            p_effort_max := ${effortRange?.[1] ?? null}::double precision,
            p_product_area_ids := ${filters.productScopeIds && filters.productScopeIds.length > 0 ? filters.productScopeIds : null}::uuid[],
            p_limit := ${limit},
            p_offset := ${offset}
          )
        `)

        if (!searchResults.rows || searchResults.rows.length === 0) {
          return { issues: [], total: 0 }
        }

        const matchedIds = searchResults.rows.map((r) => r.issue_id)
        const totalCount = searchResults.rows[0].total_count

        // Phase 2: Fetch full issue objects by returned IDs
        const results = await db.query.issues.findMany({
          where: inArray(issues.id, matchedIds),
          with: {
            project: { columns: { id: true, name: true } },
          },
          orderBy: [desc(issues.updated_at)],
        })

        const mapped = results.map((r) => toIssueWithProject(r))
        const enriched = await enrichIssuesWithProductScope(mapped)
        return { issues: enriched, total: Number(totalCount) }
      }

      // Build conditions for non-search queries
      const conditions = [inArray(issues.project_id, projectIds)]

      if (!filters.showArchived) {
        conditions.push(eq(issues.is_archived, false))
      }
      if (filters.projectId) {
        conditions.push(eq(issues.project_id, filters.projectId))
      }
      if (filters.type) {
        conditions.push(eq(issues.type, filters.type))
      }
      if (filters.priority) {
        conditions.push(eq(issues.priority, filters.priority))
      }
      if (filters.status) {
        conditions.push(eq(issues.status, filters.status))
      }
      if (filters.productScopeIds && filters.productScopeIds.length > 0) {
        conditions.push(
          inArray(
            issues.id,
            db
              .select({ id: entityRelationships.issue_id })
              .from(entityRelationships)
              .where(
                and(
                  inArray(entityRelationships.product_scope_id, filters.productScopeIds),
                  isNotNull(entityRelationships.issue_id),
                ),
              ),
          ),
        )
      }
      if (filters.goalId) {
        conditions.push(
          inArray(
            issues.id,
            db
              .select({ id: entityRelationships.issue_id })
              .from(entityRelationships)
              .where(
                and(
                  isNotNull(entityRelationships.issue_id),
                  isNotNull(entityRelationships.product_scope_id),
                  sql`${entityRelationships.metadata}->>'matchedGoalId' = ${filters.goalId}`,
                ),
              ),
          ),
        )
      }
      if (filters.reachLevel) {
        const [min, max] = metricLevelToRange(filters.reachLevel)
        conditions.push(gte(issues.reach_score, min))
        conditions.push(lte(issues.reach_score, max))
      }
      if (filters.impactLevel) {
        const [min, max] = metricLevelToRange(filters.impactLevel)
        conditions.push(gte(issues.impact_score, min))
        conditions.push(lte(issues.impact_score, max))
      }
      if (filters.confidenceLevel) {
        const [min, max] = metricLevelToRange(filters.confidenceLevel)
        conditions.push(gte(issues.confidence_score, min))
        conditions.push(lte(issues.confidence_score, max))
      }
      if (filters.effortLevel) {
        const [min, max] = metricLevelToRange(filters.effortLevel)
        conditions.push(gte(issues.effort_score, min))
        conditions.push(lte(issues.effort_score, max))
      }

      const whereClause = and(...conditions)

      // Count query
      const [{ total }] = await db.select({ total: countFn() }).from(issues).where(whereClause)

      // Data query with relations
      const limit = filters.limit ?? 50
      const offset = filters.offset ?? 0

      const results = await db.query.issues.findMany({
        where: whereClause,
        with: {
          project: { columns: { id: true, name: true } },
        },
        orderBy: [desc(issues.updated_at)],
        limit,
        offset,
      })

      const mapped = results.map((r) => toIssueWithProject(r))
      const enriched = await enrichIssuesWithProductScope(mapped)
      return { issues: enriched, total: Number(total) }
    } catch (error) {
      console.error('[db.issues] unexpected error listing issues', error)
      throw error
    }
  }
)

/**
 * Gets an issue by ID with linked feedback. Requires authenticated user context.
 * Only returns the issue if it belongs to a project owned by the current user.
 * Sessions are resolved via entity_relationships.
 */
export const getIssueById = cache(async (issueId: string): Promise<IssueWithSessions | null> => {
  try {
    const { userId } = await resolveRequestContext()

    const result = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        project: { columns: { id: true, name: true } },
      },
    })

    if (!result) return null

    const hasAccess = await hasProjectAccess(result.project_id, userId)
    if (!hasAccess) return null

    // Fetch linked session IDs and product scope in parallel
    const [sessionIds, [productScopeId]] = await Promise.all([
      getRelatedIds(result.project_id, 'issue', issueId, 'session'),
      getRelatedIds(result.project_id, 'issue', issueId, 'product_scope'),
    ])

    let sessionsArr: IssueWithSessions['sessions'] = []
    if (sessionIds.length > 0) {
      const sessionRows = await db.query.sessions.findMany({
        where: inArray(sessions.id, sessionIds),
        columns: {
          id: true,
          page_url: true,
          message_count: true,
          created_at: true,
          name: true,
          source: true,
        },
      })

      // Batch-fetch contact links for these sessions via entity_relationships
      const sIds = sessionRows.map((s) => s.id)
      const contactLinks = sIds.length > 0
        ? await db.select({
            session_id: entityRelationships.session_id,
            contact_id: entityRelationships.contact_id,
          })
          .from(entityRelationships)
          .where(and(
            inArray(entityRelationships.session_id, sIds),
            isNotNull(entityRelationships.contact_id),
          ))
        : []

      const contactIdBySession = new Map<string, string>()
      for (const cl of contactLinks) {
        if (cl.session_id && cl.contact_id && !contactIdBySession.has(cl.session_id)) {
          contactIdBySession.set(cl.session_id, cl.contact_id)
        }
      }

      const uniqueContactIds = [...new Set(contactIdBySession.values())]
      const contactMap = new Map<string, { id: string; name: string; email: string; company: { id: string; name: string; arr: number | null; stage: string } | null }>()

      if (uniqueContactIds.length > 0) {
        const contactRows = await db.query.contacts.findMany({
          where: inArray(contacts.id, uniqueContactIds),
          columns: { id: true, name: true, email: true },
          with: { company: { columns: { id: true, name: true, arr: true, stage: true } } },
        })
        for (const c of contactRows) {
          contactMap.set(c.id, {
            id: c.id,
            name: c.name,
            email: c.email,
            company: c.company
              ? { id: c.company.id, name: c.company.name, arr: c.company.arr, stage: c.company.stage ?? '' }
              : null,
          })
        }
      }

      sessionsArr = sessionRows.map((s) => {
        const contactId = contactIdBySession.get(s.id)
        const contact = contactId ? contactMap.get(contactId) ?? null : null
        return {
          id: s.id,
          page_url: s.page_url,
          message_count: s.message_count ?? 0,
          created_at: s.created_at?.toISOString() ?? new Date().toISOString(),
          name: s.name,
          source: (s.source ?? 'widget') as IssueWithSessions['sessions'][number]['source'],
          contact_id: contactId ?? null,
          contact,
        }
      })
    }

    const issueRecord = rowToIssueRecord(result)

    return {
      ...issueRecord,
      product_scope_id: productScopeId ?? null,
      project: result.project ? { id: result.project.id, name: result.project.name } : null,
      sessions: sessionsArr,
    } as IssueWithSessions
  } catch (error) {
    console.error('[db.issues] unexpected error getting issue', issueId, error)
    throw error
  }
})

/**
 * Gets issues for a specific project.
 */
export const getProjectIssues = cache(
  async (projectId: string, limit = 20): Promise<IssueWithProject[]> => {
    try {
      const { userId } = await resolveRequestContext()

      const hasAccess = await hasProjectAccess(projectId, userId)
      if (!hasAccess) return []

      const results = await db.query.issues.findMany({
        where: eq(issues.project_id, projectId),
        with: {
          project: { columns: { id: true, name: true } },
        },
        orderBy: [desc(issues.updated_at)],
        limit,
      })

      return enrichIssuesWithProductScope(results.map((r) => toIssueWithProject(r)))
    } catch (error) {
      console.error('[db.issues] unexpected error getting project issues', projectId, error)
      throw error
    }
  }
)

/**
 * Gets project settings.
 */
export async function getProjectSettings(projectId: string): Promise<ProjectSettingsRecord | null> {
  try {
    const [settingsRows, widgetRows] = await Promise.all([
      db
        .select()
        .from(projectSettings)
        .where(eq(projectSettings.project_id, projectId))
        .limit(1),
      db
        .select()
        .from(widgetIntegrations)
        .where(eq(widgetIntegrations.project_id, projectId))
        .limit(1),
    ])
    const [settingsRow] = settingsRows
    const [widgetRow] = widgetRows

    if (!settingsRow && !widgetRow) return null

    return {
      project_id: projectId,
      issue_tracking_enabled: settingsRow?.issue_tracking_enabled ?? true,
      pm_dedup_include_closed: settingsRow?.pm_dedup_include_closed ?? false,
      widget_trigger_type: (widgetRow?.trigger_type ?? 'bubble') as ProjectSettingsRecord['widget_trigger_type'],
      widget_display_type: (widgetRow?.display_type ?? 'popup') as ProjectSettingsRecord['widget_display_type'],
      widget_shortcut: widgetRow?.shortcut ?? null,
      widget_drawer_badge_label: widgetRow?.drawer_badge_label ?? 'Help',
      allowed_origins: widgetRow?.allowed_origins ?? null,
      widget_token_required: widgetRow?.token_required ?? null,
      session_idle_timeout_minutes: settingsRow?.session_idle_timeout_minutes ?? 30,
      session_goodbye_delay_seconds: settingsRow?.session_goodbye_delay_seconds ?? 60,
      session_idle_response_timeout_seconds: settingsRow?.session_idle_response_timeout_seconds ?? 300,
      created_at: settingsRow?.created_at?.toISOString() ?? widgetRow?.created_at?.toISOString() ?? new Date().toISOString(),
      updated_at: settingsRow?.updated_at?.toISOString() ?? widgetRow?.updated_at?.toISOString() ?? new Date().toISOString(),
    } as ProjectSettingsRecord
  } catch (error) {
    console.error('[db.issues] unexpected error getting project settings', projectId, error)
    return null
  }
}

/**
 * Gets issues count by status for a project.
 */
export const getProjectIssueStats = cache(
  async (
    projectId: string
  ): Promise<{
    total: number
    open: number
    ready: number
    inProgress: number
    resolved: number
    closed: number
  }> => {
    try {
      const { userId } = await resolveRequestContext()

      const hasAccess = await hasProjectAccess(projectId, userId)
      if (!hasAccess) {
        throw new Error('Access denied.')
      }

      const rows = await db
        .select({ status: issues.status, cnt: countFn() })
        .from(issues)
        .where(eq(issues.project_id, projectId))
        .groupBy(issues.status)

      const counts: Record<string, number> = {}
      for (const row of rows) {
        counts[row.status ?? 'open'] = Number(row.cnt)
      }

      const open = counts['open'] ?? 0
      const ready = counts['ready'] ?? 0
      const inProgress = counts['in_progress'] ?? 0
      const resolved = counts['resolved'] ?? 0
      const closed = counts['closed'] ?? 0

      return {
        total: open + ready + inProgress + resolved + closed,
        open,
        ready,
        inProgress,
        resolved,
        closed,
      }
    } catch (error) {
      console.error('[db.issues] unexpected error getting issue stats', projectId, error)
      throw error
    }
  }
)

// ============================================================================
// Analysis helpers
// ============================================================================

/**
 * Map metric level to score range: high=4-5, medium=2-3, low=1
 */
function metricLevelToRange(level: MetricLevel): [number, number] {
  switch (level) {
    case 'high':
      return [4, 5]
    case 'medium':
      return [2, 3]
    case 'low':
      return [1, 1]
  }
}

/**
 * Get session timestamps linked to an issue (for reach computation).
 * Uses entity_relationships created_at as a proxy for when the link was made.
 */
export async function getIssueSessionTimestamps(issueId: string): Promise<Date[]> {
  const rows = await db
    .select({ created_at: entityRelationships.created_at })
    .from(entityRelationships)
    .where(
      and(
        eq(entityRelationships.issue_id, issueId),
        isNotNull(entityRelationships.session_id),
      ),
    )

  return rows.map((row) => row.created_at ?? new Date())
}

/**
 * Get issue with sessions data for analysis (admin client).
 * Sessions are resolved via entity_relationships.
 */
export async function getIssueForAnalysisAdmin(
  issueId: string
): Promise<{
  id: string
  projectId: string
  title: string
  description: string
  type: string
  upvoteCount: number
  impactScore: number | null
  effortEstimate: string | null
  priorityManualOverride: boolean
  sessions: Array<{
    id: string
    createdAt: string
    contactId: string | null
    contact: {
      id: string
      company: {
        id: string
        arr: number | null
        stage: string
      } | null
    } | null
  }>
} | null> {
  const result = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: {
      id: true,
      project_id: true,
      title: true,
      description: true,
      type: true,
      upvote_count: true,
      impact_score: true,
      effort_estimate: true,
      priority_manual_override: true,
    },
  })

  if (!result) return null

  // Fetch linked session IDs via entity_relationships
  const sessionIds = await getRelatedIds(result.project_id, 'issue', issueId, 'session')

  let sessionsArr: Array<{
    id: string
    createdAt: string
    contactId: string | null
    contact: { id: string; company: { id: string; arr: number | null; stage: string } | null } | null
  }> = []

  if (sessionIds.length > 0) {
    const sessionRows = await db.query.sessions.findMany({
      where: inArray(sessions.id, sessionIds),
      columns: { id: true, created_at: true },
    })

    // Batch-fetch contact links for these sessions via entity_relationships
    const sIds = sessionRows.map((s) => s.id)
    const contactLinks = sIds.length > 0
      ? await db.select({
          session_id: entityRelationships.session_id,
          contact_id: entityRelationships.contact_id,
        })
        .from(entityRelationships)
        .where(and(
          inArray(entityRelationships.session_id, sIds),
          isNotNull(entityRelationships.contact_id),
        ))
      : []

    const contactIdBySession = new Map<string, string>()
    for (const cl of contactLinks) {
      if (cl.session_id && cl.contact_id && !contactIdBySession.has(cl.session_id)) {
        contactIdBySession.set(cl.session_id, cl.contact_id)
      }
    }

    const uniqueContactIds = [...new Set(contactIdBySession.values())]
    const contactMap = new Map<string, { id: string; company: { id: string; arr: number | null; stage: string } | null }>()

    if (uniqueContactIds.length > 0) {
      const contactRows = await db.query.contacts.findMany({
        where: inArray(contacts.id, uniqueContactIds),
        columns: { id: true },
        with: { company: { columns: { id: true, arr: true, stage: true } } },
      })
      for (const c of contactRows) {
        contactMap.set(c.id, {
          id: c.id,
          company: c.company
            ? { id: c.company.id, arr: c.company.arr, stage: c.company.stage ?? '' }
            : null,
        })
      }
    }

    sessionsArr = sessionRows.map((s) => {
      const contactId = contactIdBySession.get(s.id)
      const contact = contactId ? contactMap.get(contactId) ?? null : null
      return {
        id: s.id,
        createdAt: s.created_at?.toISOString() ?? new Date().toISOString(),
        contactId: contactId ?? null,
        contact,
      }
    })
  }

  return {
    id: result.id,
    projectId: result.project_id,
    title: result.title,
    description: result.description ?? '',
    type: result.type,
    upvoteCount: result.upvote_count ?? 1,
    impactScore: result.impact_score,
    effortEstimate: result.effort_estimate,
    priorityManualOverride: result.priority_manual_override ?? false,
    sessions: sessionsArr,
  }
}

/**
 * Update issue analysis columns
 */
export async function updateIssueAnalysis(
  issueId: string,
  data: {
    reachScore?: number | null
    reachReasoning?: string | null
    impactScore?: number | null
    impactAnalysis?: IssueImpactAnalysis | null
    confidenceScore?: number | null
    confidenceReasoning?: string | null
    effortScore?: number | null
    effortEstimate?: EffortEstimate | null
    effortReasoning?: string | null
    priority?: IssuePriority
    analysisComputedAt?: string
  }
): Promise<IssueRecord> {
  const updates: Record<string, unknown> = {
    updated_at: new Date(),
  }

  if (data.reachScore !== undefined) updates.reach_score = data.reachScore
  if (data.reachReasoning !== undefined) updates.reach_reasoning = data.reachReasoning
  if (data.impactScore !== undefined) updates.impact_score = data.impactScore
  if (data.impactAnalysis !== undefined) updates.impact_analysis = data.impactAnalysis
  if (data.confidenceScore !== undefined) updates.confidence_score = data.confidenceScore
  if (data.confidenceReasoning !== undefined) updates.confidence_reasoning = data.confidenceReasoning
  if (data.effortScore !== undefined) updates.effort_score = data.effortScore
  if (data.effortEstimate !== undefined) updates.effort_estimate = data.effortEstimate
  if (data.effortReasoning !== undefined) updates.effort_reasoning = data.effortReasoning
  if (data.priority !== undefined) updates.priority = data.priority
  if (data.analysisComputedAt !== undefined) updates.analysis_computed_at = new Date(data.analysisComputedAt)

  const [issue] = await db
    .update(issues)
    .set(updates)
    .where(eq(issues.id, issueId))
    .returning()

  if (!issue) {
    throw new Error(`Failed to update issue analysis: ${issueId}`)
  }

  return rowToIssueRecord(issue)
}

// ============================================================================
// Auth helpers for service layer
// ============================================================================

/**
 * Verify user has access to a project. Returns project info if accessible, null otherwise.
 */
export async function verifyProjectAccess(
  projectId: string
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  return row ?? null
}

/**
 * Get project_id for an issue
 */
export async function getIssueProjectId(issueId: string): Promise<string | null> {
  const [row] = await db
    .select({ project_id: issues.project_id })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1)

  return row?.project_id ?? null
}

/**
 * Gets top ranked issues for a project, sorted by combined score.
 * Score = (upvote_count * 2) + (impact_score ?? 0) + priorityWeight(priority)
 */
export async function getTopRankedIssues(
  projectId: string,
  limit = 5
): Promise<IssueWithProject[]> {
  try {
    await resolveRequestContext()
  } catch {
    return []
  }

  try {
    const results = await db.query.issues.findMany({
      where: and(
        eq(issues.project_id, projectId),
        eq(issues.is_archived, false),
        not(eq(issues.status, 'closed')),
      ),
      with: {
        project: { columns: { id: true, name: true } },
      },
      orderBy: [desc(issues.upvote_count)],
      limit: 50,
    })

    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 }

    const mapped = results.map((r) => toIssueWithProject(r))

    const scored = mapped.map((issue) => ({
      issue,
      score:
        (issue.upvote_count ?? 0) * 2 +
        (issue.impact_score ?? 0) +
        (priorityWeight[issue.priority] ?? 0),
    }))

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map((s) => s.issue)
  } catch (error) {
    console.error('[db.issues.getTopRankedIssues] Failed', projectId, error)
    return []
  }
}

// ---------------------------------------------------------------------------
// Internal: enrich issues with product_scope_id from entity_relationships
// ---------------------------------------------------------------------------

async function enrichIssuesWithProductScope(
  issueList: IssueWithProject[]
): Promise<IssueWithProject[]> {
  if (issueList.length === 0) return issueList

  const issueIds = issueList.map((i) => i.id)
  const erRows = await db
    .select({
      issue_id: entityRelationships.issue_id,
      product_scope_id: entityRelationships.product_scope_id,
    })
    .from(entityRelationships)
    .where(
      and(
        inArray(entityRelationships.issue_id, issueIds),
        isNotNull(entityRelationships.product_scope_id),
      ),
    )

  const scopeByIssue = new Map<string, string>()
  for (const row of erRows) {
    if (row.issue_id && row.product_scope_id && !scopeByIssue.has(row.issue_id)) {
      scopeByIssue.set(row.issue_id, row.product_scope_id)
    }
  }

  return issueList.map((i) => ({
    ...i,
    product_scope_id: scopeByIssue.get(i.id) ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Internal: transform relational query result to IssueWithProject
// ---------------------------------------------------------------------------

type IssueRelationalResult = Awaited<ReturnType<typeof db.query.issues.findMany>>[number]

function toIssueWithProject(r: IssueRelationalResult): IssueWithProject {
  const record = rowToIssueRecord(r)

  const projectData =
    'project' in r && r.project
      ? { id: (r.project as { id: string; name: string }).id, name: (r.project as { id: string; name: string }).name }
      : null

  return {
    ...record,
    project: projectData,
  }
}
