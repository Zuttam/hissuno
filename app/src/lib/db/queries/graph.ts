import { db } from '@/lib/db'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
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
// Types
// ---------------------------------------------------------------------------

export interface BulkGraphNode {
  id: string
  type: EntityType
  label: string
  sublabel?: string
  parentId?: string
}

export interface BulkGraphEdge {
  id: string
  sourceId: string
  targetId: string
  sourceType: EntityType
  targetType: EntityType
  metadata: Record<string, unknown> | null
  edgeType?: 'entity' | 'hierarchy'
}

export interface BulkGraphData {
  nodes: BulkGraphNode[]
  edges: BulkGraphEdge[]
}

// ---------------------------------------------------------------------------
// Entity type column mapping (derived from canonical ENTITY_COLUMNS)
// ---------------------------------------------------------------------------

import { ENTITY_COLUMNS, columnName } from './entity-relationships'

const ENTITY_TYPE_COLUMNS = (Object.keys(ENTITY_COLUMNS) as EntityType[]).map(type => ({
  type,
  key: columnName(type) as keyof typeof entityRelationships.$inferSelect,
}))

// ---------------------------------------------------------------------------
// Main bulk query
// ---------------------------------------------------------------------------

export async function getBulkGraphData(
  projectId: string,
  opts?: { includeOrphans?: boolean },
): Promise<BulkGraphData> {
  // 1. Fetch all relationship rows for the project
  const rows = await db
    .select()
    .from(entityRelationships)
    .where(eq(entityRelationships.project_id, projectId))

  if (rows.length === 0 && !opts?.includeOrphans) return { nodes: [], edges: [] }

  // 2. Collect unique entity IDs per type and build edges
  const entityIds: Record<EntityType, Set<string>> = {
    company: new Set(),
    contact: new Set(),
    issue: new Set(),
    session: new Set(),
    knowledge_source: new Set(),
    product_scope: new Set(),
  }

  const edges: BulkGraphEdge[] = []

  for (const row of rows) {
    // Find all non-null FK columns in this row
    const presentEntities: { type: EntityType; id: string }[] = []
    for (const { type, key } of ENTITY_TYPE_COLUMNS) {
      const id = row[key] as string | null
      if (id) {
        presentEntities.push({ type, id })
        entityIds[type].add(id)
      }
    }

    // For each pair of non-null columns, create one edge
    for (let i = 0; i < presentEntities.length; i++) {
      for (let j = i + 1; j < presentEntities.length; j++) {
        edges.push({
          id: `${row.id}-${i}-${j}`,
          sourceId: presentEntities[i].id,
          targetId: presentEntities[j].id,
          sourceType: presentEntities[i].type,
          targetType: presentEntities[j].type,
          metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        })
      }
    }
  }

  // 3. Batch-fetch labels from all 6 entity tables in parallel
  const [companyRows, contactRows, issueRows, sessionRows, ksRows, psRows] = await Promise.all([
    entityIds.company.size > 0
      ? db.select({ id: companies.id, name: companies.name, domain: companies.domain })
          .from(companies).where(inArray(companies.id, [...entityIds.company]))
      : Promise.resolve([]),
    entityIds.contact.size > 0
      ? db.select({ id: contacts.id, name: contacts.name, email: contacts.email, company_id: contacts.company_id })
          .from(contacts).where(inArray(contacts.id, [...entityIds.contact]))
      : Promise.resolve([]),
    entityIds.issue.size > 0
      ? db.select({ id: issues.id, name: issues.name, type: issues.type })
          .from(issues).where(inArray(issues.id, [...entityIds.issue]))
      : Promise.resolve([]),
    entityIds.session.size > 0
      ? db.select({ id: sessions.id, name: sessions.name, source: sessions.source })
          .from(sessions).where(inArray(sessions.id, [...entityIds.session]))
      : Promise.resolve([]),
    entityIds.knowledge_source.size > 0
      ? db.select({ id: knowledgeSources.id, name: knowledgeSources.name, type: knowledgeSources.type })
          .from(knowledgeSources).where(inArray(knowledgeSources.id, [...entityIds.knowledge_source]))
      : Promise.resolve([]),
    entityIds.product_scope.size > 0
      ? db.select({ id: productScopes.id, name: productScopes.name })
          .from(productScopes).where(inArray(productScopes.id, [...entityIds.product_scope]))
      : Promise.resolve([]),
  ])

  // 4. Build nodes
  const toNode = {
    company: (r: { id: string; name: string; domain: string }): BulkGraphNode =>
      ({ id: r.id, type: 'company', label: r.name, sublabel: r.domain }),
    contact: (r: { id: string; name: string; email: string; company_id: string | null }): BulkGraphNode =>
      ({ id: r.id, type: 'contact', label: r.name, sublabel: r.email, parentId: r.company_id ?? undefined }),
    issue: (r: { id: string; name: string; type: string }): BulkGraphNode =>
      ({ id: r.id, type: 'issue', label: r.name, sublabel: r.type }),
    session: (r: { id: string; name: string | null; source: string | null }): BulkGraphNode =>
      ({ id: r.id, type: 'session', label: r.name || `Session ${r.id.slice(0, 8)}`, sublabel: r.source ?? undefined }),
    knowledge_source: (r: { id: string; name: string | null; type: string }): BulkGraphNode =>
      ({ id: r.id, type: 'knowledge_source', label: r.name || 'Untitled', sublabel: r.type }),
    product_scope: (r: { id: string; name: string }): BulkGraphNode =>
      ({ id: r.id, type: 'product_scope', label: r.name }),
  }

  const nodes: BulkGraphNode[] = [
    ...companyRows.map(toNode.company),
    ...contactRows.map(toNode.contact),
    ...issueRows.map(toNode.issue),
    ...sessionRows.map(toNode.session),
    ...ksRows.map(toNode.knowledge_source),
    ...psRows.map(toNode.product_scope),
  ]

  // 5. Add canonical edges (contact→company via FK, knowledge_source parent→child via FK)
  //    Only for entities already present in the nodes array.
  const nodeIdSet = new Set(nodes.map((n) => n.id))

  // 5a. Contact → Company (via contacts.company_id, already fetched in step 3)
  for (const row of contactRows) {
    if (row.company_id && nodeIdSet.has(row.id) && nodeIdSet.has(row.company_id)) {
      edges.push({
        id: `canonical-contact-${row.id}`,
        sourceId: row.id,
        targetId: row.company_id,
        sourceType: 'contact',
        targetType: 'company',
        metadata: null,
      })
    }
  }

  // 5b. Knowledge Source parent → child (via knowledgeSources.parent_id)
  if (entityIds.knowledge_source.size > 0) {
    const ksParentRows = await db
      .select({ id: knowledgeSources.id, parent_id: knowledgeSources.parent_id })
      .from(knowledgeSources)
      .where(
        and(
          inArray(knowledgeSources.id, [...entityIds.knowledge_source]),
          isNotNull(knowledgeSources.parent_id),
        ),
      )

    for (const row of ksParentRows) {
      if (row.parent_id && nodeIdSet.has(row.id) && nodeIdSet.has(row.parent_id)) {
        edges.push({
          id: `canonical-ks-${row.id}`,
          sourceId: row.parent_id,
          targetId: row.id,
          sourceType: 'knowledge_source',
          targetType: 'knowledge_source',
          metadata: null,
        })
      }
    }
  }

  // 5c. Product Scope parent → child (via productScopes.parent_id)
  if (entityIds.product_scope.size > 0) {
    const psParentRows = await db
      .select({ id: productScopes.id, parent_id: productScopes.parent_id })
      .from(productScopes)
      .where(
        and(
          inArray(productScopes.id, [...entityIds.product_scope]),
          isNotNull(productScopes.parent_id),
        ),
      )

    for (const row of psParentRows) {
      if (row.parent_id && nodeIdSet.has(row.id) && nodeIdSet.has(row.parent_id)) {
        edges.push({
          id: `hierarchy-ps-${row.id}`,
          sourceId: row.parent_id,
          targetId: row.id,
          sourceType: 'product_scope',
          targetType: 'product_scope',
          metadata: null,
          edgeType: 'hierarchy',
        })
      }
    }
  }

  // 6. Optionally include orphan entities (those with no relationships)
  if (opts?.includeOrphans) {
    const [allCompanies, allContacts, allIssues, allSessions, allKs, allPs] = await Promise.all([
      db.select({ id: companies.id, name: companies.name, domain: companies.domain })
        .from(companies).where(eq(companies.project_id, projectId)),
      db.select({ id: contacts.id, name: contacts.name, email: contacts.email, company_id: contacts.company_id })
        .from(contacts).where(eq(contacts.project_id, projectId)),
      db.select({ id: issues.id, name: issues.name, type: issues.type })
        .from(issues).where(eq(issues.project_id, projectId)),
      db.select({ id: sessions.id, name: sessions.name, source: sessions.source })
        .from(sessions).where(eq(sessions.project_id, projectId)),
      db.select({ id: knowledgeSources.id, name: knowledgeSources.name, type: knowledgeSources.type })
        .from(knowledgeSources).where(eq(knowledgeSources.project_id, projectId)),
      db.select({ id: productScopes.id, name: productScopes.name })
        .from(productScopes).where(eq(productScopes.project_id, projectId)),
    ])

    const addOrphans = <T extends { id: string }>(rows: T[], mapper: (r: T) => BulkGraphNode) => {
      for (const r of rows) {
        if (!nodeIdSet.has(r.id)) {
          nodes.push(mapper(r))
          nodeIdSet.add(r.id)
        }
      }
    }
    addOrphans(allCompanies, toNode.company)
    addOrphans(allContacts, toNode.contact)
    addOrphans(allIssues, toNode.issue)
    addOrphans(allSessions, toNode.session)
    addOrphans(allKs, toNode.knowledge_source)
    addOrphans(allPs, toNode.product_scope)
  }

  return { nodes, edges }
}
