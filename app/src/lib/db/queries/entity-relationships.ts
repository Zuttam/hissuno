/**
 * Entity Relationships Database Layer (Drizzle ORM)
 *
 * Universal graph edges between core entities: companies, contacts, issues,
 * sessions, knowledge sources, and product scopes.
 * Each row has exactly 2 non-null entity FK columns = one edge.
 */

import { eq, and, isNotNull, inArray, count as drizzleCount } from 'drizzle-orm'
import { db } from '@/lib/db'
import { isUniqueViolation } from '@/lib/db/errors'
import {
  entityRelationships,
  companies,
  contacts,
  issues,
  sessions,
  knowledgeSources,
  productScopes,
} from '@/lib/db/schema/app'
import type { EntityType } from './types'

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

export const ENTITY_COLUMNS = {
  company: entityRelationships.company_id,
  contact: entityRelationships.contact_id,
  issue: entityRelationships.issue_id,
  session: entityRelationships.session_id,
  knowledge_source: entityRelationships.knowledge_source_id,
  codebase: entityRelationships.codebase_id,
  product_scope: entityRelationships.product_scope_id,
} as const

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/**
 * Link two entities. Uses insert with conflict handling to avoid TOCTOU races.
 */
export async function linkEntities(
  projectId: string,
  typeA: EntityType,
  idA: string,
  typeB: EntityType,
  idB: string,
  metadata?: Record<string, unknown> | null,
): Promise<void> {
  // Check if edge already exists
  const existing = await db
    .select({ id: entityRelationships.id, metadata: entityRelationships.metadata })
    .from(entityRelationships)
    .where(
      and(
        eq(entityRelationships.project_id, projectId),
        eq(ENTITY_COLUMNS[typeA], idA),
        eq(ENTITY_COLUMNS[typeB], idB),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    // Edge exists - update metadata if caller provides it
    if (metadata) {
      await db
        .update(entityRelationships)
        .set({ metadata })
        .where(eq(entityRelationships.id, existing[0].id))
    }
    return
  }

  const values: Record<string, unknown> = {
    project_id: projectId,
    [columnName(typeA)]: idA,
    [columnName(typeB)]: idB,
  }
  if (metadata !== undefined && metadata !== null) {
    values.metadata = metadata
  }

  try {
    await db.insert(entityRelationships).values(values as never)
  } catch (err) {
    if (isUniqueViolation(err)) return
    throw err
  }
}

/**
 * Unlink two entities.
 */
export async function unlinkEntities(
  projectId: string,
  typeA: EntityType,
  idA: string,
  typeB: EntityType,
  idB: string,
): Promise<void> {
  await db
    .delete(entityRelationships)
    .where(
      and(
        eq(entityRelationships.project_id, projectId),
        eq(ENTITY_COLUMNS[typeA], idA),
        eq(ENTITY_COLUMNS[typeB], idB),
      ),
    )
}

/**
 * Get IDs of related entities of a specific type.
 */
export async function getRelatedIds(
  projectId: string,
  entityType: EntityType,
  entityId: string,
  relatedType: EntityType,
): Promise<string[]> {
  const rows = await db
    .select({ relatedId: ENTITY_COLUMNS[relatedType] })
    .from(entityRelationships)
    .where(
      and(
        eq(entityRelationships.project_id, projectId),
        eq(ENTITY_COLUMNS[entityType], entityId),
        isNotNull(ENTITY_COLUMNS[relatedType]),
      ),
    )

  return rows.map((r) => r.relatedId).filter((id): id is string => id !== null)
}

// ---------------------------------------------------------------------------
// Detail fetch (grouped by type)
// ---------------------------------------------------------------------------

export interface ViaAttribution {
  type: EntityType
  ids: string[]
}

export interface RelationshipInfo {
  metadata?: Record<string, unknown> | null
  linkedAt?: string | null
}

export interface RelatedEntitiesResult {
  companies: Array<{ id: string; name: string; domain: string; via?: ViaAttribution } & RelationshipInfo>
  contacts: Array<{ id: string; name: string; email: string; company_id: string | null; via?: ViaAttribution } & RelationshipInfo>
  issues: Array<{ id: string; name: string; type: string; status: string | null; via?: ViaAttribution } & RelationshipInfo>
  sessions: Array<{ id: string; name: string | null; source: string | null; created_at: Date | null; via?: ViaAttribution } & RelationshipInfo>
  knowledgeSources: Array<{ id: string; name: string | null; type: string; status: string } & RelationshipInfo>
  productScopes: Array<{ id: string; name: string; color: string } & RelationshipInfo>
}

const RELATED_TYPES: EntityType[] = ['company', 'contact', 'issue', 'session', 'knowledge_source', 'codebase', 'product_scope']

/**
 * Get all relationships for an entity, grouped by type with display-friendly data.
 */
export async function getRelatedEntitiesWithDetails(
  projectId: string,
  entityType: EntityType,
  entityId: string,
): Promise<RelatedEntitiesResult> {
  // Fetch all relationship rows for this entity
  const rows = await db
    .select()
    .from(entityRelationships)
    .where(
      and(
        eq(entityRelationships.project_id, projectId),
        eq(ENTITY_COLUMNS[entityType], entityId),
      ),
    )

  // Collect IDs per related type
  const idsByType: Record<EntityType, string[]> = {
    company: [],
    contact: [],
    issue: [],
    session: [],
    knowledge_source: [],
    codebase: [],
    product_scope: [],
  }

  // Track metadata + created_at for every relationship, keyed by "type:id"
  const relInfoMap = new Map<string, RelationshipInfo>()

  for (const row of rows) {
    for (const rt of RELATED_TYPES) {
      if (rt === entityType) continue
      const val = row[columnName(rt) as keyof typeof row] as string | null
      if (val) {
        const key = `${rt}:${val}`
        const existing = relInfoMap.get(key)
        // On duplicate edges, prefer the one with metadata (LLM-enriched context)
        if (!existing || (row.metadata && !existing.metadata)) {
          if (!existing) idsByType[rt].push(val)
          relInfoMap.set(key, {
            metadata: (row.metadata as Record<string, unknown>) ?? null,
            linkedAt: row.created_at?.toISOString() ?? null,
          })
        }
      }
    }
  }

  // Batch-fetch details for each type that has IDs
  const [companyRows, contactRows, issueRows, sessionRows, ksRows, paRows] = await Promise.all([
    idsByType.company.length > 0
      ? db.select({ id: companies.id, name: companies.name, domain: companies.domain })
          .from(companies).where(inArray(companies.id, idsByType.company))
      : [],
    idsByType.contact.length > 0
      ? db.select({ id: contacts.id, name: contacts.name, email: contacts.email, company_id: contacts.company_id })
          .from(contacts).where(inArray(contacts.id, idsByType.contact))
      : [],
    idsByType.issue.length > 0
      ? db.select({ id: issues.id, name: issues.name, type: issues.type, status: issues.status })
          .from(issues).where(inArray(issues.id, idsByType.issue))
      : [],
    idsByType.session.length > 0
      ? db.select({ id: sessions.id, name: sessions.name, source: sessions.source, created_at: sessions.created_at })
          .from(sessions).where(inArray(sessions.id, idsByType.session))
      : [],
    idsByType.knowledge_source.length > 0
      ? db.select({ id: knowledgeSources.id, name: knowledgeSources.name, type: knowledgeSources.type, status: knowledgeSources.status })
          .from(knowledgeSources).where(inArray(knowledgeSources.id, idsByType.knowledge_source))
      : [],
    idsByType.product_scope.length > 0
      ? db.select({ id: productScopes.id, name: productScopes.name, color: productScopes.color })
          .from(productScopes).where(inArray(productScopes.id, idsByType.product_scope))
      : [],
  ])

  // -------------------------------------------------------------------------
  // 2-hop traversal: discover indirect connections through intermediate types
  // For each target type, query through intermediate types that have 1st-degree
  // links to find 2nd-degree connections. Tracks attribution (which intermediates
  // contributed each connection).
  // -------------------------------------------------------------------------
  const TRAVERSABLE_TARGETS: EntityType[] = ['contact', 'company', 'issue', 'session']

  const secondDegreeByTarget: Record<string, Set<string>> = {
    contact: new Set(),
    company: new Set(),
    issue: new Set(),
    session: new Set(),
  }

  // Per-target: targetId -> { intermediateType -> Set<intermediateId> }
  const viaMapByTarget = new Map<EntityType, Map<string, Map<EntityType, Set<string>>>>()

  // Build all 2-hop queries upfront, then execute in parallel
  const hopQueries: { target: EntityType; intermediate: EntityType; promise: Promise<{ targetId: string | null; intermediateId: string | null }[]> }[] = []

  for (const target of TRAVERSABLE_TARGETS) {
    if (target === entityType) continue
    for (const intermediate of RELATED_TYPES) {
      if (intermediate === target || intermediate === entityType) continue
      if (idsByType[intermediate].length === 0) continue
      hopQueries.push({
        target,
        intermediate,
        promise: db
          .select({
            targetId: ENTITY_COLUMNS[target],
            intermediateId: ENTITY_COLUMNS[intermediate],
          })
          .from(entityRelationships)
          .where(
            and(
              eq(entityRelationships.project_id, projectId),
              inArray(ENTITY_COLUMNS[intermediate], idsByType[intermediate]),
              isNotNull(ENTITY_COLUMNS[target]),
            ),
          ),
      })
    }
  }

  const hopResults = await Promise.all(hopQueries.map(q => q.promise))

  for (let qi = 0; qi < hopQueries.length; qi++) {
    const { target, intermediate } = hopQueries[qi]
    const hopRows = hopResults[qi]
    const directIds = new Set(idsByType[target])

    if (!viaMapByTarget.has(target)) {
      viaMapByTarget.set(target, new Map())
    }
    const targetVia = viaMapByTarget.get(target)!

    for (const row of hopRows) {
      const tid = row.targetId as string | null
      const iid = row.intermediateId as string | null
      if (!tid || !iid || tid === entityId) continue

      if (!directIds.has(tid)) {
        secondDegreeByTarget[target].add(tid)
      }

      if (!targetVia.has(tid)) {
        targetVia.set(tid, new Map())
      }
      const byType = targetVia.get(tid)!
      if (!byType.has(intermediate)) {
        byType.set(intermediate, new Set())
      }
      byType.get(intermediate)!.add(iid)
    }
  }

  // Batch-fetch 2nd-degree details
  const newContactIds = [...secondDegreeByTarget.contact]
  const newCompanyIds = [...secondDegreeByTarget.company]
  const newIssueIds = [...secondDegreeByTarget.issue]
  const newSessionIds = [...secondDegreeByTarget.session]

  const [newContacts, newCompanies, newIssues, newSessions] = await Promise.all([
    newContactIds.length > 0
      ? db.select({ id: contacts.id, name: contacts.name, email: contacts.email, company_id: contacts.company_id })
          .from(contacts).where(inArray(contacts.id, newContactIds))
      : [],
    newCompanyIds.length > 0
      ? db.select({ id: companies.id, name: companies.name, domain: companies.domain })
          .from(companies).where(inArray(companies.id, newCompanyIds))
      : [],
    newIssueIds.length > 0
      ? db.select({ id: issues.id, name: issues.name, type: issues.type, status: issues.status })
          .from(issues).where(inArray(issues.id, newIssueIds))
      : [],
    newSessionIds.length > 0
      ? db.select({ id: sessions.id, name: sessions.name, source: sessions.source, created_at: sessions.created_at })
          .from(sessions).where(inArray(sessions.id, newSessionIds))
      : [],
  ])

  // Helper to build ViaAttribution from the per-target viaMap
  function buildVia(target: EntityType, id: string): ViaAttribution | undefined {
    const targetVia = viaMapByTarget.get(target)
    if (!targetVia) return undefined
    const byType = targetVia.get(id)
    if (!byType) return undefined
    // Pick the intermediate type with the most connections
    let bestType: EntityType | null = null
    let bestIds: Set<string> | null = null
    for (const [iType, iIds] of byType) {
      if (!bestIds || iIds.size > bestIds.size) {
        bestType = iType
        bestIds = iIds
      }
    }
    if (!bestType || !bestIds) return undefined
    return { type: bestType, ids: [...bestIds] }
  }

  // Helper to merge relationship info (metadata + linkedAt) into entity rows
  const withRelInfo = <T extends { id: string }>(type: EntityType, row: T): T & RelationshipInfo => ({
    ...row,
    ...relInfoMap.get(`${type}:${row.id}`),
  })

  return {
    companies: [
      ...companyRows.map(c => withRelInfo('company', c)),
      ...newCompanies.map(c => ({ ...withRelInfo('company', c), via: buildVia('company', c.id) })),
    ],
    contacts: [
      ...contactRows.map(c => withRelInfo('contact', c)),
      ...newContacts.map(c => ({ ...withRelInfo('contact', c), via: buildVia('contact', c.id) })),
    ],
    issues: [
      ...issueRows.map(i => withRelInfo('issue', i)),
      ...newIssues.map(i => ({ ...withRelInfo('issue', i), via: buildVia('issue', i.id) })),
    ],
    sessions: [
      ...sessionRows.map(s => withRelInfo('session', s)),
      ...newSessions.map(s => ({ ...withRelInfo('session', s), via: buildVia('session', s.id) })),
    ],
    knowledgeSources: ksRows.map(k => withRelInfo('knowledge_source', k)),
    productScopes: paRows.map(ps => withRelInfo('product_scope', ps)),
  }
}

// ---------------------------------------------------------------------------
// Batch helpers for session → contact enrichment
// ---------------------------------------------------------------------------

export interface SessionContactInfo {
  contactId: string
  contactName: string
  contactEmail: string
  companyName: string | null
}

/**
 * Batch-fetch contact info (name, email, company name) for a list of session IDs.
 * Performs exactly 2 queries regardless of session count.
 */
export async function batchGetSessionContacts(
  sessionIds: string[],
): Promise<Map<string, SessionContactInfo>> {
  if (sessionIds.length === 0) return new Map()

  // 1. Batch-fetch all contact links
  const rels = await db
    .select({
      session_id: entityRelationships.session_id,
      contact_id: entityRelationships.contact_id,
    })
    .from(entityRelationships)
    .where(
      and(
        inArray(entityRelationships.session_id, sessionIds),
        isNotNull(entityRelationships.contact_id),
      ),
    )

  const contactIdBySession = new Map<string, string>()
  for (const r of rels) {
    if (r.session_id && r.contact_id && !contactIdBySession.has(r.session_id)) {
      contactIdBySession.set(r.session_id, r.contact_id)
    }
  }

  if (contactIdBySession.size === 0) return new Map()

  // 2. Batch-fetch contacts with companies
  const uniqueContactIds = [...new Set(contactIdBySession.values())]
  const contactRows = await db.query.contacts.findMany({
    where: inArray(contacts.id, uniqueContactIds),
    columns: { id: true, name: true, email: true },
    with: {
      company: { columns: { id: true, name: true } },
    },
  })

  const contactMap = new Map<string, (typeof contactRows)[number]>()
  for (const c of contactRows) {
    contactMap.set(c.id, c)
  }

  // 3. Build result map
  const result = new Map<string, SessionContactInfo>()
  for (const [sessionId, contactId] of contactIdBySession) {
    const contact = contactMap.get(contactId)
    if (contact) {
      result.set(sessionId, {
        contactId: contact.id,
        contactName: contact.name,
        contactEmail: contact.email,
        companyName: contact.company?.name ?? null,
      })
    }
  }

  return result
}

/**
 * Get contact info for a single session. Convenience wrapper around batchGetSessionContacts.
 */
export async function getSessionContactInfo(
  sessionId: string,
): Promise<SessionContactInfo | null> {
  const map = await batchGetSessionContacts([sessionId])
  return map.get(sessionId) ?? null
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Get session IDs linked to an issue.
 */
export async function getIssueLinkedSessionIds(projectId: string, issueId: string): Promise<string[]> {
  return getRelatedIds(projectId, 'issue', issueId, 'session')
}

/**
 * Get issue IDs linked to a session.
 */
export async function getSessionLinkedIssueIds(projectId: string, sessionId: string): Promise<string[]> {
  return getRelatedIds(projectId, 'session', sessionId, 'issue')
}

/**
 * Set (or clear) the contact for a session. Unlinks old contact if exists, links new one.
 * Wrapped in a transaction for atomicity.
 */
export async function setSessionContact(
  projectId: string,
  sessionId: string,
  contactId: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Remove existing contact links
    await tx
      .delete(entityRelationships)
      .where(
        and(
          eq(entityRelationships.project_id, projectId),
          eq(ENTITY_COLUMNS['session'], sessionId),
          isNotNull(ENTITY_COLUMNS['contact']),
        ),
      )

    // Link new contact (metadata is added later by graph evaluation enrichment)
    if (contactId) {
      const values: Record<string, unknown> = {
        project_id: projectId,
        [columnName('session')]: sessionId,
        [columnName('contact')]: contactId,
      }

      try {
        await tx.insert(entityRelationships).values(values as never)
      } catch (err) {
        if (isUniqueViolation(err)) return
        throw err
      }
    }
  })
}

/**
 * Set (or clear) the product scope for an entity.
 * Wrapped in a transaction for atomicity.
 */
export async function setEntityProductScope(
  projectId: string,
  entityType: EntityType,
  entityId: string,
  productScopeId: string | null,
  metadata?: Record<string, unknown> | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Remove existing product scope links
    await tx
      .delete(entityRelationships)
      .where(
        and(
          eq(entityRelationships.project_id, projectId),
          eq(ENTITY_COLUMNS[entityType], entityId),
          isNotNull(ENTITY_COLUMNS['product_scope']),
        ),
      )

    // Link new product scope
    if (productScopeId) {
      const values: Record<string, unknown> = {
        project_id: projectId,
        [columnName(entityType)]: entityId,
        [columnName('product_scope')]: productScopeId,
      }
      if (metadata !== undefined && metadata !== null) {
        values.metadata = metadata
      }

      try {
        await tx.insert(entityRelationships).values(values as never)
      } catch (err) {
        if (isUniqueViolation(err)) return
        throw err
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Issue session counts (replaces deprecated upvote_count)
// ---------------------------------------------------------------------------

/**
 * Count the number of sessions linked to an issue via entity_relationships.
 */
export async function getIssueSessionCount(issueId: string): Promise<number> {
  const [row] = await db
    .select({ count: drizzleCount() })
    .from(entityRelationships)
    .where(
      and(
        eq(entityRelationships.issue_id, issueId),
        isNotNull(entityRelationships.session_id),
      ),
    )

  return row?.count ?? 0
}

/**
 * Batch-fetch session counts for multiple issues in a single query.
 * Returns a Map from issueId to count (0 for issues with no sessions).
 */
export async function batchGetIssueSessionCounts(
  issueIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (issueIds.length === 0) return result

  // Pre-fill all requested IDs with 0
  for (const id of issueIds) {
    result.set(id, 0)
  }

  const rows = await db
    .select({
      issue_id: entityRelationships.issue_id,
      count: drizzleCount(),
    })
    .from(entityRelationships)
    .where(
      and(
        inArray(entityRelationships.issue_id, issueIds),
        isNotNull(entityRelationships.session_id),
      ),
    )
    .groupBy(entityRelationships.issue_id)

  for (const row of rows) {
    if (row.issue_id) {
      result.set(row.issue_id, row.count)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function columnName(type: EntityType): string {
  const map: Record<EntityType, string> = {
    company: 'company_id',
    contact: 'contact_id',
    issue: 'issue_id',
    session: 'session_id',
    knowledge_source: 'knowledge_source_id',
    codebase: 'codebase_id',
    product_scope: 'product_scope_id',
  }
  return map[type]
}
