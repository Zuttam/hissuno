/**
 * Entity Relationships Database Layer (Drizzle ORM)
 *
 * Universal graph edges between core entities: companies, contacts, issues,
 * sessions, knowledge sources, and product scopes.
 * Each row has exactly 2 non-null entity FK columns = one edge.
 */

import { eq, and, isNotNull, inArray } from 'drizzle-orm'
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
    // Silently handle duplicate - link already exists
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

export interface RelatedEntitiesResult {
  companies: Array<{ id: string; name: string; domain: string }>
  contacts: Array<{ id: string; name: string; email: string }>
  issues: Array<{ id: string; title: string; type: string; status: string | null }>
  sessions: Array<{ id: string; name: string | null; source: string | null; created_at: Date | null }>
  knowledgeSources: Array<{ id: string; name: string | null; type: string; status: string }>
  productScopes: Array<{ id: string; name: string; color: string; metadata?: Record<string, unknown> | null }>
}

const RELATED_TYPES: EntityType[] = ['company', 'contact', 'issue', 'session', 'knowledge_source', 'product_scope']

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
    product_scope: [],
  }

  const metadataByProductScopeId = new Map<string, Record<string, unknown> | null>()

  for (const row of rows) {
    for (const rt of RELATED_TYPES) {
      if (rt === entityType) continue
      const val = row[columnName(rt) as keyof typeof row] as string | null
      if (val) {
        idsByType[rt].push(val)
        // Track metadata for product scope relationships
        if (rt === 'product_scope') {
          metadataByProductScopeId.set(val, (row.metadata as Record<string, unknown>) ?? null)
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
      ? db.select({ id: contacts.id, name: contacts.name, email: contacts.email })
          .from(contacts).where(inArray(contacts.id, idsByType.contact))
      : [],
    idsByType.issue.length > 0
      ? db.select({ id: issues.id, title: issues.title, type: issues.type, status: issues.status })
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

  return {
    companies: companyRows,
    contacts: contactRows,
    issues: issueRows,
    sessions: sessionRows,
    knowledgeSources: ksRows,
    productScopes: paRows.map((ps) => ({
      ...ps,
      metadata: metadataByProductScopeId.get(ps.id) ?? null,
    })),
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

    // Link new contact
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
// Helpers
// ---------------------------------------------------------------------------

export function columnName(type: EntityType): string {
  const map: Record<EntityType, string> = {
    company: 'company_id',
    contact: 'contact_id',
    issue: 'issue_id',
    session: 'session_id',
    knowledge_source: 'knowledge_source_id',
    product_scope: 'product_scope_id',
  }
  return map[type]
}
