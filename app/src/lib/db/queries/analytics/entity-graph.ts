import { cache } from 'react'
import { db } from '@/lib/db'
import { eq, sql, count, countDistinct, desc, or, isNotNull, and, inArray } from 'drizzle-orm'
import {
  entityRelationships,
  companies,
  contacts,
  issues,
  sessions,
  knowledgeSources,
  productScopes,
} from '@/lib/db/schema/app'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess } from '@/lib/auth/authorization'
import type {
  EntityGraphAnalytics,
  EntityGraphCategory,
  EntityGraphCategoryNode,
  EntityGraphCategoryEdge,
  EntityGraphEntityNode,
  EdgeEntitiesData,
  EdgeEntityPair,
  DrilldownEntity,
  DrilldownGroup,
} from './types'

const ALL_CATEGORIES: EntityGraphCategory[] = [
  'customer', 'issue', 'session', 'knowledge_source', 'product_scope',
]

/**
 * Maps display categories to their DB column(s).
 * "customer" is backed by both company_id and contact_id.
 */
const CATEGORY_COLUMNS = {
  customer: [entityRelationships.company_id, entityRelationships.contact_id],
  issue: [entityRelationships.issue_id],
  session: [entityRelationships.session_id],
  knowledge_source: [entityRelationships.knowledge_source_id],
  product_scope: [entityRelationships.product_scope_id],
} as const

/** SQL expression: "at least one of the columns for this category is non-null" */
function categoryPresent(cat: EntityGraphCategory) {
  const cols = CATEGORY_COLUMNS[cat]
  if (cols.length === 1) return isNotNull(cols[0])
  return or(...cols.map(c => isNotNull(c)))!
}

// ---------------------------------------------------------------------------
// Overview query - single aggregation for counts, edges, and total
// ---------------------------------------------------------------------------

interface OverviewData {
  categories: EntityGraphCategoryNode[]
  edges: EntityGraphCategoryEdge[]
  totalRelationships: number
}

async function getOverviewData(projectId: string): Promise<OverviewData> {
  // Category counts + total
  const [countsRow] = await db
    .select({
      total: count(),
      company: countDistinct(entityRelationships.company_id),
      contact: countDistinct(entityRelationships.contact_id),
      issue: countDistinct(entityRelationships.issue_id),
      session: countDistinct(entityRelationships.session_id),
      knowledge_source: countDistinct(entityRelationships.knowledge_source_id),
      product_scope: countDistinct(entityRelationships.product_scope_id),
      // Count rows that reference any customer entity (company or contact)
      customer_rows: sql<number>`count(*) filter (where ${entityRelationships.company_id} is not null or ${entityRelationships.contact_id} is not null)`,
    })
    .from(entityRelationships)
    .where(eq(entityRelationships.project_id, projectId))

  if (!countsRow) {
    return {
      categories: ALL_CATEGORIES.map(c => ({ category: c, count: 0 })),
      edges: [],
      totalRelationships: 0,
    }
  }

  // Customer count = distinct companies + distinct contacts
  const customerCount = (countsRow.company ?? 0) + (countsRow.contact ?? 0)

  const categories: EntityGraphCategoryNode[] = ALL_CATEGORIES.map(category => ({
    category,
    count: category === 'customer'
      ? customerCount
      : (countsRow[category] ?? 0),
  }))

  // Edge pair counts - single query with conditional aggregation
  const pairs: [EntityGraphCategory, EntityGraphCategory][] = []
  for (let i = 0; i < ALL_CATEGORIES.length; i++) {
    for (let j = i + 1; j < ALL_CATEGORIES.length; j++) {
      pairs.push([ALL_CATEGORIES[i], ALL_CATEGORIES[j]])
    }
  }

  const pairCols = pairs.map(([a, b]) =>
    sql<number>`count(*) filter (where (${categoryPresent(a)}) and (${categoryPresent(b)}))`.as(`${a}__${b}`)
  )

  const [edgeRow] = pairCols.length > 0
    ? await db
        .select(Object.fromEntries(pairs.map(([a, b], i) => [`${a}__${b}`, pairCols[i]])))
        .from(entityRelationships)
        .where(eq(entityRelationships.project_id, projectId))
    : [{}]

  const edges: EntityGraphCategoryEdge[] = pairs
    .map(([a, b]) => ({
      source: a,
      target: b,
      count: Number((edgeRow as Record<string, unknown>)?.[`${a}__${b}`] ?? 0),
    }))
    .filter(e => e.count > 0)

  return {
    categories,
    edges,
    totalRelationships: countsRow.total ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Recent entities per category (5 most recent each)
// ---------------------------------------------------------------------------

async function fetchRecentEntities(
  projectId: string,
): Promise<Record<EntityGraphCategory, EntityGraphEntityNode[]>> {
  const [companyRows, contactRows, issueRows, sessionRows, knowledgeRows, productScopeRows] =
    await Promise.all([
      db
        .select({ id: companies.id, name: companies.name, domain: companies.domain, created_at: companies.created_at })
        .from(companies)
        .where(eq(companies.project_id, projectId))
        .orderBy(desc(companies.created_at))
        .limit(5),
      db
        .select({ id: contacts.id, name: contacts.name, email: contacts.email, created_at: contacts.created_at })
        .from(contacts)
        .where(eq(contacts.project_id, projectId))
        .orderBy(desc(contacts.created_at))
        .limit(5),
      db
        .select({ id: issues.id, name: issues.name, type: issues.type })
        .from(issues)
        .where(eq(issues.project_id, projectId))
        .orderBy(desc(issues.created_at))
        .limit(5),
      db
        .select({ id: sessions.id, name: sessions.name, source: sessions.source })
        .from(sessions)
        .where(eq(sessions.project_id, projectId))
        .orderBy(desc(sessions.created_at))
        .limit(5),
      db
        .select({ id: knowledgeSources.id, name: knowledgeSources.name, type: knowledgeSources.type })
        .from(knowledgeSources)
        .where(eq(knowledgeSources.project_id, projectId))
        .orderBy(desc(knowledgeSources.created_at))
        .limit(5),
      db
        .select({ id: productScopes.id, name: productScopes.name, color: productScopes.color })
        .from(productScopes)
        .where(eq(productScopes.project_id, projectId))
        .orderBy(desc(productScopes.created_at))
        .limit(5),
    ])

  // Merge companies + contacts into a single "customer" list, sorted by recency, limited to 5
  const customerEntities = [
    ...companyRows.map(r => ({
      id: r.id,
      category: 'customer' as const,
      label: r.name,
      sublabel: r.domain,
      _sortDate: r.created_at?.getTime() ?? 0,
    })),
    ...contactRows.map(r => ({
      id: r.id,
      category: 'customer' as const,
      label: r.name,
      sublabel: r.email,
      _sortDate: r.created_at?.getTime() ?? 0,
    })),
  ]
    .sort((a, b) => b._sortDate - a._sortDate)
    .slice(0, 5)

  return {
    customer: customerEntities.map(({ _sortDate: _, ...rest }) => rest),
    issue: issueRows.map(r => ({ id: r.id, category: 'issue' as const, label: r.name, sublabel: r.type })),
    session: sessionRows.map(r => ({
      id: r.id,
      category: 'session' as const,
      label: r.name || `Session ${r.id.slice(0, 8)}`,
      sublabel: r.source ?? undefined,
    })),
    knowledge_source: knowledgeRows.map(r => ({ id: r.id, category: 'knowledge_source' as const, label: r.name || 'Untitled', sublabel: r.type })),
    product_scope: productScopeRows.map(r => ({ id: r.id, category: 'product_scope' as const, label: r.name, sublabel: r.color })),
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export const getEntityGraphAnalytics = cache(async (
  projectId: string,
): Promise<EntityGraphAnalytics> => {
  const identity = await requireRequestIdentity()
  await assertProjectAccess(identity, projectId)

  const [overview, recentEntities] = await Promise.all([
    getOverviewData(projectId),
    fetchRecentEntities(projectId),
  ])

  return {
    overview: {
      ...overview,
      recentEntities,
    },
  }
})

// ---------------------------------------------------------------------------
// Edge entities (Phase 2) - entities connecting two categories
// ---------------------------------------------------------------------------

async function batchFetchEntityLabels(
  type: string,
  ids: Set<string>,
): Promise<Map<string, { label: string; sublabel?: string }>> {
  if (ids.size === 0) return new Map()
  const idArray = [...ids]
  const map = new Map<string, { label: string; sublabel?: string }>()

  switch (type) {
    case 'company': {
      const rows = await db.select({ id: companies.id, name: companies.name, domain: companies.domain })
        .from(companies).where(inArray(companies.id, idArray))
      for (const r of rows) map.set(r.id, { label: r.name, sublabel: r.domain })
      break
    }
    case 'contact': {
      const rows = await db.select({ id: contacts.id, name: contacts.name, email: contacts.email })
        .from(contacts).where(inArray(contacts.id, idArray))
      for (const r of rows) map.set(r.id, { label: r.name, sublabel: r.email })
      break
    }
    case 'issue': {
      const rows = await db.select({ id: issues.id, name: issues.name, type: issues.type })
        .from(issues).where(inArray(issues.id, idArray))
      for (const r of rows) map.set(r.id, { label: r.name, sublabel: r.type })
      break
    }
    case 'session': {
      const rows = await db.select({ id: sessions.id, name: sessions.name, source: sessions.source })
        .from(sessions).where(inArray(sessions.id, idArray))
      for (const r of rows) map.set(r.id, { label: r.name || `Session ${r.id.slice(0, 8)}`, sublabel: r.source ?? undefined })
      break
    }
    case 'knowledge_source': {
      const rows = await db.select({ id: knowledgeSources.id, name: knowledgeSources.name, type: knowledgeSources.type })
        .from(knowledgeSources).where(inArray(knowledgeSources.id, idArray))
      for (const r of rows) map.set(r.id, { label: r.name || 'Untitled', sublabel: r.type })
      break
    }
    case 'product_scope': {
      const rows = await db.select({ id: productScopes.id, name: productScopes.name })
        .from(productScopes).where(inArray(productScopes.id, idArray))
      for (const r of rows) map.set(r.id, { label: r.name })
      break
    }
  }

  return map
}

function resolveEntityFromRow(
  row: typeof entityRelationships.$inferSelect,
  category: EntityGraphCategory,
  maps: Record<string, Map<string, { label: string; sublabel?: string }>>,
): { id: string; label: string; sublabel?: string } | null {
  if (category === 'customer') {
    if (row.company_id) {
      const info = maps.company?.get(row.company_id)
      if (info) return { id: row.company_id, ...info }
    }
    if (row.contact_id) {
      const info = maps.contact?.get(row.contact_id)
      if (info) return { id: row.contact_id, ...info }
    }
    return null
  }

  const colMap: Record<string, keyof typeof row> = {
    issue: 'issue_id',
    session: 'session_id',
    knowledge_source: 'knowledge_source_id',
    product_scope: 'product_scope_id',
  }

  const colName = colMap[category]
  if (!colName) return null
  const id = row[colName] as string | null
  if (!id) return null

  const info = maps[category]?.get(id)
  return info ? { id, ...info } : null
}

export async function getEdgeEntities(
  projectId: string,
  sourceCategory: EntityGraphCategory,
  targetCategory: EntityGraphCategory,
  limit: number = 10,
): Promise<EdgeEntitiesData> {
  const sourceCond = categoryPresent(sourceCategory)
  const targetCond = categoryPresent(targetCategory)

  // Count total + fetch rows in parallel
  const [countResult, rows] = await Promise.all([
    db.select({ total: count() })
      .from(entityRelationships)
      .where(and(eq(entityRelationships.project_id, projectId), sourceCond, targetCond)),
    db.select()
      .from(entityRelationships)
      .where(and(eq(entityRelationships.project_id, projectId), sourceCond, targetCond))
      .orderBy(desc(entityRelationships.created_at))
      .limit(limit),
  ])

  const totalCount = countResult[0]?.total ?? 0
  if (rows.length === 0) return { pairs: [], totalCount }

  // Collect entity IDs to look up
  const entityIds: Record<string, Set<string>> = {
    company: new Set(), contact: new Set(), issue: new Set(),
    session: new Set(), knowledge_source: new Set(), product_scope: new Set(),
  }
  for (const row of rows) {
    if (row.company_id) entityIds.company.add(row.company_id)
    if (row.contact_id) entityIds.contact.add(row.contact_id)
    if (row.issue_id) entityIds.issue.add(row.issue_id)
    if (row.session_id) entityIds.session.add(row.session_id)
    if (row.knowledge_source_id) entityIds.knowledge_source.add(row.knowledge_source_id)
    if (row.product_scope_id) entityIds.product_scope.add(row.product_scope_id)
  }

  // Batch fetch
  const [companyMap, contactMap, issueMap, sessionMap, ksMap, paMap] = await Promise.all([
    batchFetchEntityLabels('company', entityIds.company),
    batchFetchEntityLabels('contact', entityIds.contact),
    batchFetchEntityLabels('issue', entityIds.issue),
    batchFetchEntityLabels('session', entityIds.session),
    batchFetchEntityLabels('knowledge_source', entityIds.knowledge_source),
    batchFetchEntityLabels('product_scope', entityIds.product_scope),
  ])

  const maps: Record<string, Map<string, { label: string; sublabel?: string }>> = {
    company: companyMap, contact: contactMap, issue: issueMap,
    session: sessionMap, knowledge_source: ksMap, product_scope: paMap,
  }

  // Build pairs
  const pairs: EdgeEntityPair[] = []
  for (const row of rows) {
    const source = resolveEntityFromRow(row, sourceCategory, maps)
    const target = resolveEntityFromRow(row, targetCategory, maps)
    if (source && target) pairs.push({ source, target })
  }

  return { pairs: pairs.slice(0, limit), totalCount }
}

// ---------------------------------------------------------------------------
// Drilldown (Phase 3) - category sub-groups and individual entities
// ---------------------------------------------------------------------------

export async function getCategorySubgroups(
  projectId: string,
  category: EntityGraphCategory,
): Promise<DrilldownGroup[]> {
  switch (category) {
    case 'customer': {
      const [companyCount, contactCount] = await Promise.all([
        db.select({ total: count() }).from(companies).where(eq(companies.project_id, projectId)),
        db.select({ total: count() }).from(contacts).where(eq(contacts.project_id, projectId)),
      ])
      return [
        { id: 'companies', label: 'Companies', count: companyCount[0]?.total ?? 0 },
        { id: 'contacts', label: 'Contacts', count: contactCount[0]?.total ?? 0 },
      ].filter(g => g.count > 0)
    }
    case 'issue': {
      const rows = await db
        .select({ status: issues.status, total: count() })
        .from(issues)
        .where(eq(issues.project_id, projectId))
        .groupBy(issues.status)
      return rows.map(r => ({
        id: r.status ?? 'unknown',
        label: (r.status ?? 'Unknown').charAt(0).toUpperCase() + (r.status ?? 'unknown').slice(1),
        count: r.total,
      }))
    }
    case 'session': {
      const rows = await db
        .select({ status: sessions.status, total: count() })
        .from(sessions)
        .where(eq(sessions.project_id, projectId))
        .groupBy(sessions.status)
      return rows.map(r => ({
        id: r.status ?? 'unknown',
        label: (r.status ?? 'Unknown').charAt(0).toUpperCase() + (r.status ?? 'unknown').slice(1),
        count: r.total,
      }))
    }
    case 'knowledge_source': {
      const rows = await db
        .select({ type: knowledgeSources.type, total: count() })
        .from(knowledgeSources)
        .where(eq(knowledgeSources.project_id, projectId))
        .groupBy(knowledgeSources.type)
      return rows.map(r => ({
        id: r.type,
        label: r.type.charAt(0).toUpperCase() + r.type.slice(1),
        count: r.total,
      }))
    }
    case 'product_scope': {
      // Group by type: product areas vs initiatives
      const rows = await db
        .select({ type: productScopes.type, total: count() })
        .from(productScopes)
        .where(eq(productScopes.project_id, projectId))
        .groupBy(productScopes.type)
      return rows.map(r => ({
        id: r.type,
        label: r.type === 'initiative' ? 'Initiatives' : 'Product Areas',
        count: r.total,
      })).filter(g => g.count > 0)
    }
    default:
      return []
  }
}

export async function getCategoryEntities(
  projectId: string,
  category: EntityGraphCategory,
  groupBy?: string,
  groupValue?: string,
  limit: number = 20,
): Promise<DrilldownEntity[]> {
  switch (category) {
    case 'customer': {
      if (groupBy === 'entity_type' && groupValue === 'companies') {
        const rows = await db.select({ id: companies.id, name: companies.name, domain: companies.domain })
          .from(companies).where(eq(companies.project_id, projectId))
          .orderBy(desc(companies.created_at)).limit(limit)
        return rows.map(r => ({ id: r.id, label: r.name, sublabel: r.domain, entityType: 'company' as const }))
      }
      if (groupBy === 'entity_type' && groupValue === 'contacts') {
        const rows = await db.select({ id: contacts.id, name: contacts.name, email: contacts.email })
          .from(contacts).where(eq(contacts.project_id, projectId))
          .orderBy(desc(contacts.created_at)).limit(limit)
        return rows.map(r => ({ id: r.id, label: r.name, sublabel: r.email, entityType: 'contact' as const }))
      }
      // No group - return mixed
      const [companyRows, contactRows] = await Promise.all([
        db.select({ id: companies.id, name: companies.name, domain: companies.domain, created_at: companies.created_at })
          .from(companies).where(eq(companies.project_id, projectId)).orderBy(desc(companies.created_at)).limit(limit),
        db.select({ id: contacts.id, name: contacts.name, email: contacts.email, created_at: contacts.created_at })
          .from(contacts).where(eq(contacts.project_id, projectId)).orderBy(desc(contacts.created_at)).limit(limit),
      ])
      const mixed = [
        ...companyRows.map(r => ({ id: r.id, label: r.name, sublabel: r.domain, entityType: 'company' as const, _d: r.created_at?.getTime() ?? 0 })),
        ...contactRows.map(r => ({ id: r.id, label: r.name, sublabel: r.email, entityType: 'contact' as const, _d: r.created_at?.getTime() ?? 0 })),
      ].sort((a, b) => b._d - a._d).slice(0, limit)
      return mixed.map(({ _d: _, ...rest }) => rest)
    }
    case 'issue': {
      const conditions = [eq(issues.project_id, projectId)]
      if (groupBy === 'status' && groupValue) conditions.push(eq(issues.status, groupValue))
      const rows = await db.select({ id: issues.id, name: issues.name, type: issues.type })
        .from(issues).where(and(...conditions)).orderBy(desc(issues.created_at)).limit(limit)
      return rows.map(r => ({ id: r.id, label: r.name, sublabel: r.type, entityType: 'issue' as const }))
    }
    case 'session': {
      const conditions = [eq(sessions.project_id, projectId)]
      if (groupBy === 'status' && groupValue) conditions.push(eq(sessions.status, groupValue))
      const rows = await db.select({ id: sessions.id, name: sessions.name, source: sessions.source })
        .from(sessions).where(and(...conditions)).orderBy(desc(sessions.created_at)).limit(limit)
      return rows.map(r => ({
        id: r.id,
        label: r.name || `Session ${r.id.slice(0, 8)}`,
        sublabel: r.source ?? undefined,
        entityType: 'session' as const,
      }))
    }
    case 'knowledge_source': {
      const conditions = [eq(knowledgeSources.project_id, projectId)]
      if (groupBy === 'type' && groupValue) conditions.push(eq(knowledgeSources.type, groupValue))
      const rows = await db.select({ id: knowledgeSources.id, name: knowledgeSources.name, type: knowledgeSources.type })
        .from(knowledgeSources).where(and(...conditions)).orderBy(desc(knowledgeSources.created_at)).limit(limit)
      return rows.map(r => ({ id: r.id, label: r.name || 'Untitled', sublabel: r.type, entityType: 'knowledge_source' as const }))
    }
    case 'product_scope': {
      const conditions = [eq(productScopes.project_id, projectId)]
      if (groupBy === 'type' && groupValue) conditions.push(eq(productScopes.type, groupValue))
      const rows = await db.select({
        id: productScopes.id,
        name: productScopes.name,
        type: productScopes.type,
        goals: productScopes.goals,
      })
        .from(productScopes).where(and(...conditions))
        .orderBy(desc(productScopes.created_at)).limit(limit)
      return rows.map(r => {
        const goals = Array.isArray(r.goals) ? r.goals as Array<{ id: string; text: string }> : []
        const typeLabel = r.type === 'initiative' ? 'Initiative' : 'Product Area'
        const goalCount = goals.length
        const sublabel = goalCount > 0 ? `${typeLabel} - ${goalCount} goal${goalCount !== 1 ? 's' : ''}` : typeLabel
        return {
          id: r.id,
          label: r.name,
          sublabel,
          entityType: 'product_scope' as const,
          goals: goals.length > 0 ? goals : undefined,
        }
      })
    }
    default:
      return []
  }
}

export async function getChildEntityEdges(
  projectId: string,
  parentCategory: EntityGraphCategory,
  childIds: string[],
): Promise<Record<string, EntityGraphCategory[]>> {
  if (childIds.length === 0) return {}

  // Determine which column(s) to match for the parent category
  const cols = CATEGORY_COLUMNS[parentCategory]
  const inCond = cols.length === 1
    ? inArray(cols[0], childIds)
    : or(...cols.map(c => inArray(c, childIds)))!

  const rows = await db.select()
    .from(entityRelationships)
    .where(and(eq(entityRelationships.project_id, projectId), inCond))

  // For each child entity, find which other categories it connects to
  const result: Record<string, Set<EntityGraphCategory>> = {}

  for (const row of rows) {
    // Find which child this row belongs to
    let childId: string | null = null
    if (parentCategory === 'customer') {
      childId = row.company_id ?? row.contact_id
    } else {
      const colName = {
        issue: 'issue_id', session: 'session_id',
        knowledge_source: 'knowledge_source_id', product_scope: 'product_scope_id',
      }[parentCategory] as keyof typeof row
      childId = row[colName] as string | null
    }
    if (!childId || !childIds.includes(childId)) continue

    if (!result[childId]) result[childId] = new Set()

    // Check which other categories are present in this row
    for (const cat of ALL_CATEGORIES) {
      if (cat === parentCategory) continue
      let hasValue = false
      if (cat === 'customer') {
        hasValue = row.company_id != null || row.contact_id != null
      } else if (cat === 'issue') {
        hasValue = row.issue_id != null
      } else if (cat === 'session') {
        hasValue = row.session_id != null
      } else if (cat === 'knowledge_source') {
        hasValue = row.knowledge_source_id != null
      } else if (cat === 'product_scope') {
        hasValue = row.product_scope_id != null
      }
      if (hasValue) result[childId].add(cat)
    }
  }

  // Convert sets to arrays
  const output: Record<string, EntityGraphCategory[]> = {}
  for (const [id, cats] of Object.entries(result)) {
    output[id] = [...cats]
  }
  return output
}
