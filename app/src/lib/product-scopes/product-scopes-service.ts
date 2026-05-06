/**
 * Product Scopes Service Layer
 *
 * This is the single source of truth for all product scope CRUD operations.
 *
 * Use this service instead of calling db queries directly
 * for any create/update/sync operations.
 *
 * Note: Product scopes are not graph-evaluated entities themselves -
 * they are targets that other entities (sessions, issues, etc.) get matched to
 * during graph evaluation. No fireGraphEval() calls needed here.
 *
 * Architecture:
 * - API Routes -> product-scopes-service.ts -> db
 * - PM Agent Tools -> product-scopes-service.ts (Admin) -> db
 */

import { eq, and, or, asc, count, ilike, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productScopes } from '@/lib/db/schema/app'
import { isUniqueViolation } from '@/lib/db/errors'
import { fireEmbedding } from '@/lib/utils/embeddings'
import { notifyAutomationEvent } from '@/lib/automations/events'
import { searchByMode, type SearchMode } from '@/lib/search/search-by-mode'
import { getScopeDescendantIds } from '@/lib/product-scopes/tree-utils'
import {
  buildProductScopeEmbeddingText,
  searchProductScopesSemantic,
} from '@/lib/product-scopes/embedding-service'
import type { ProductScopeRecord, ProductScopeType, ProductScopeGoal } from '@/types/product-scope'
import {
  getProductScopeById,
  type SyncScopeInput,
  type SyncScopesResult,
} from '@/lib/db/queries/product-scopes'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Re-export types used by callers
export type { SyncScopeInput, SyncScopesResult } from '@/lib/db/queries/product-scopes'

const MAX_SCOPES_PER_PROJECT = 50
const MAX_DEPTH = 3

// ============================================================================
// Types
// ============================================================================

/**
 * Input for creating a product scope via admin/internal context
 */
export interface CreateProductScopeAdminInput {
  name: string
  slug: string
  description?: string
  color?: string
  position?: number
  type?: ProductScopeType
  goals?: ProductScopeGoal[] | null
  parent_id?: string | null
  custom_fields?: Record<string, unknown>
}

/**
 * Input for updating a product scope via admin/internal context
 */
export interface UpdateProductScopeAdminInput {
  name?: string
  slug?: string
  description?: string
  color?: string
  position?: number
  type?: ProductScopeType
  goals?: ProductScopeGoal[] | null
  parent_id?: string | null
  custom_fields?: Record<string, unknown>
}

// ============================================================================
// Admin Operations (for PM Agent Tools and Workflows)
// ============================================================================

/**
 * Creates a product scope with graph eval. No user auth required.
 * Enforces the max-scopes-per-project limit and depth limit.
 */
export async function createProductScopeAdmin(
  projectId: string,
  input: CreateProductScopeAdminInput
): Promise<ProductScopeRecord> {
  // Count existing scopes
  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(productScopes)
    .where(eq(productScopes.project_id, projectId))

  if (existing >= MAX_SCOPES_PER_PROJECT) {
    throw new Error(`Maximum of ${MAX_SCOPES_PER_PROJECT} product scopes per project.`)
  }

  // Validate parent and compute depth
  let depth = 0
  if (input.parent_id) {
    const parent = await getProductScopeById(input.parent_id)
    if (!parent || parent.project_id !== projectId) {
      throw new Error('Parent scope not found in this project.')
    }
    depth = parent.depth + 1
    if (depth > MAX_DEPTH) {
      throw new Error(`Maximum nesting depth of ${MAX_DEPTH} exceeded.`)
    }
  }

  // Default position: append after siblings
  let position = input.position
  if (position === undefined) {
    const siblings = await db
      .select({ value: count() })
      .from(productScopes)
      .where(
        and(
          eq(productScopes.project_id, projectId),
          input.parent_id
            ? eq(productScopes.parent_id, input.parent_id)
            : sql`${productScopes.parent_id} IS NULL`
        )
      )
    position = siblings[0].value
  }

  try {
    const [created] = await db
      .insert(productScopes)
      .values({
        project_id: projectId,
        parent_id: input.parent_id ?? null,
        name: input.name,
        slug: input.slug,
        description: input.description ?? '',
        color: input.color ?? '',
        position,
        depth,
        is_default: false,
        type: input.type ?? 'product_area',
        goals: (input.goals ?? null) as unknown as Record<string, unknown>,
        custom_fields: input.custom_fields ?? null,
      })
      .returning()

    const record = created as unknown as ProductScopeRecord
    fireEmbedding(record.id, 'product_scope', projectId, buildProductScopeEmbeddingText(record))
    notifyAutomationEvent('scope.created', {
      projectId,
      entity: { type: 'scope', id: record.id, name: record.name },
    })
    return record
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new Error(`A product scope with slug "${input.slug}" already exists in this project.`)
    }
    throw err
  }
}

/**
 * Updates a product scope with graph eval. No user auth required.
 * Respects default-scope protections.
 */
export async function updateProductScopeAdmin(
  scopeId: string,
  input: UpdateProductScopeAdminInput
): Promise<ProductScopeRecord> {
  const existing = await getProductScopeById(scopeId)
  if (!existing) {
    throw new Error('Product scope not found.')
  }

  // Default scope protections
  if (existing.is_default) {
    if (input.type === 'initiative' || input.type === 'experiment') {
      throw new Error('The default product scope cannot change type.')
    }
    if (input.name !== undefined || input.slug !== undefined) {
      throw new Error('Cannot change the name or slug of the default product scope.')
    }
    if (input.parent_id !== undefined && input.parent_id !== null) {
      throw new Error('The default product scope must remain a root scope.')
    }
  }

  // Handle parent_id change: validate no cycles, recompute depth
  if (input.parent_id !== undefined && input.parent_id !== existing.parent_id) {
    if (input.parent_id === scopeId) {
      throw new Error('A scope cannot be its own parent.')
    }
    if (input.parent_id) {
      const parent = await getProductScopeById(input.parent_id)
      if (!parent || parent.project_id !== existing.project_id) {
        throw new Error('Parent scope not found in this project.')
      }
      // Check for cycles: new parent cannot be a descendant
      const allScopes = await db
        .select()
        .from(productScopes)
        .where(eq(productScopes.project_id, existing.project_id))
      const allRecords = allScopes as unknown as ProductScopeRecord[]
      const descendantIds = getScopeDescendantIds(allRecords, scopeId)
      if (descendantIds.includes(input.parent_id)) {
        throw new Error('Cannot move a scope under one of its own descendants.')
      }
      const newDepth = parent.depth + 1
      if (newDepth > MAX_DEPTH) {
        throw new Error(`Maximum nesting depth of ${MAX_DEPTH} exceeded.`)
      }
    }
  }

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.slug !== undefined) updates.slug = input.slug
  if (input.description !== undefined) updates.description = input.description
  if (input.color !== undefined) updates.color = input.color
  if (input.position !== undefined) updates.position = input.position
  if (input.type !== undefined) updates.type = input.type
  if (input.goals !== undefined) updates.goals = input.goals as unknown as Record<string, unknown>
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id
  if (input.custom_fields !== undefined) updates.custom_fields = input.custom_fields

  if (Object.keys(updates).length === 0) {
    return existing
  }

  // If parent changed, recompute depth for this scope and descendants
  if (input.parent_id !== undefined && input.parent_id !== existing.parent_id) {
    let newDepth = 0
    if (input.parent_id) {
      const parent = await getProductScopeById(input.parent_id)
      newDepth = (parent?.depth ?? 0) + 1
    }
    updates.depth = newDepth

    // Update in a transaction to also fix descendant depths
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(productScopes)
        .set(updates)
        .where(eq(productScopes.id, scopeId))
        .returning()

      // Recursively update descendant depths
      await updateSubtreeDepths(tx, scopeId, newDepth + 1)
      return [row]
    })

    const record = updated as unknown as ProductScopeRecord
    fireEmbedding(record.id, 'product_scope', record.project_id, buildProductScopeEmbeddingText(record))
    notifyAutomationEvent('scope.updated', {
      projectId: record.project_id,
      entity: { type: 'scope', id: record.id, name: record.name },
    })
    return record
  }

  try {
    const [updated] = await db
      .update(productScopes)
      .set(updates)
      .where(eq(productScopes.id, scopeId))
      .returning()

    const record = updated as unknown as ProductScopeRecord
    fireEmbedding(record.id, 'product_scope', record.project_id, buildProductScopeEmbeddingText(record))
    notifyAutomationEvent('scope.updated', {
      projectId: record.project_id,
      entity: { type: 'scope', id: record.id, name: record.name },
    })
    return record
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new Error(`A product scope with slug "${input.slug}" already exists in this project.`)
    }
    throw err
  }
}

/**
 * Recursively update depths for all descendants of a scope.
 */
async function updateSubtreeDepths(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  parentId: string,
  depth: number,
): Promise<void> {
  const children = await tx
    .select()
    .from(productScopes)
    .where(eq(productScopes.parent_id, parentId))

  for (const child of children) {
    await tx
      .update(productScopes)
      .set({ depth })
      .where(eq(productScopes.id, child.id))
    await updateSubtreeDepths(tx, child.id, depth + 1)
  }
}

// ============================================================================
// Sync Helpers (operate within a transaction)
// ============================================================================

function detectScopeChanges(
  existing: ProductScopeRecord,
  incoming: SyncScopeInput,
  isDefault: boolean
): boolean {
  const goalsChanged = JSON.stringify(existing.goals) !== JSON.stringify(incoming.goals)
  const parentChanged = (existing.parent_id ?? null) !== (incoming.parent_id ?? null)
  if (isDefault) {
    return (
      existing.description !== incoming.description ||
      existing.color !== incoming.color ||
      existing.position !== incoming.position ||
      goalsChanged
    )
  }
  return (
    existing.name !== incoming.name ||
    existing.slug !== incoming.slug ||
    existing.description !== incoming.description ||
    existing.color !== incoming.color ||
    existing.position !== incoming.position ||
    existing.type !== incoming.type ||
    goalsChanged ||
    parentChanged
  )
}

async function deleteRemovedScopes(
  tx: Tx,
  existingScopesById: Map<string, ProductScopeRecord>,
  incomingScopesById: Map<string, SyncScopeInput>,
  result: SyncScopesResult
): Promise<void> {
  for (const existingScope of existingScopesById.values()) {
    if (!incomingScopesById.has(existingScope.id)) {
      if (existingScope.is_default) {
        throw new Error('Cannot delete the default product scope.')
      }
      await tx.delete(productScopes).where(eq(productScopes.id, existingScope.id))
      result.deleted.push(existingScope.id)
    }
  }
}

async function createNewScopes(
  tx: Tx,
  projectId: string,
  newScopes: SyncScopeInput[],
  result: SyncScopesResult
): Promise<void> {
  for (const newScope of newScopes) {
    try {
      const [created] = await tx
        .insert(productScopes)
        .values({
          project_id: projectId,
          parent_id: newScope.parent_id ?? null,
          name: newScope.name,
          slug: newScope.slug,
          description: newScope.description,
          color: newScope.color,
          position: newScope.position,
          depth: 0, // Caller should set correct depth via parent resolution
          is_default: false,
          type: newScope.type ?? 'product_area',
          goals: newScope.goals as unknown as Record<string, unknown>,
        })
        .returning()

      result.created.push(created as unknown as ProductScopeRecord)
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new Error(`A product scope with slug "${newScope.slug}" already exists in this project.`)
      }
      console.error('[product-scopes-service] failed to create scope', err)
      throw new Error('Unable to create product scope.')
    }
  }
}

async function updateExistingScopes(
  tx: Tx,
  existingIncomingScopes: SyncScopeInput[],
  existingScopesById: Map<string, ProductScopeRecord>,
  result: SyncScopesResult
): Promise<void> {
  for (const incomingScope of existingIncomingScopes) {
    const existingScope = existingScopesById.get(incomingScope.id)
    if (!existingScope) {
      console.warn('[product-scopes-service] scope ID not found in DB', incomingScope.id)
      continue
    }

    // Protect default scope: cannot become initiative
    if (existingScope.is_default && incomingScope.type === 'initiative') {
      throw new Error('The default product scope cannot be changed to an initiative.')
    }

    if (!detectScopeChanges(existingScope, incomingScope, existingScope.is_default)) {
      continue
    }

    if (existingScope.is_default) {
      const [updated] = await tx
        .update(productScopes)
        .set({
          description: incomingScope.description,
          color: incomingScope.color,
          position: incomingScope.position,
          goals: incomingScope.goals as unknown as Record<string, unknown>,
        })
        .where(eq(productScopes.id, incomingScope.id))
        .returning()

      result.updated.push(updated as unknown as ProductScopeRecord)
      continue
    }

    try {
      const [updated] = await tx
        .update(productScopes)
        .set({
          parent_id: incomingScope.parent_id ?? null,
          name: incomingScope.name,
          slug: incomingScope.slug,
          description: incomingScope.description,
          color: incomingScope.color,
          position: incomingScope.position,
          type: incomingScope.type ?? 'product_area',
          goals: incomingScope.goals as unknown as Record<string, unknown>,
        })
        .where(eq(productScopes.id, incomingScope.id))
        .returning()

      result.updated.push(updated as unknown as ProductScopeRecord)
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new Error(`A product scope with slug "${incomingScope.slug}" already exists in this project.`)
      }
      console.error('[product-scopes-service] failed to update scope', incomingScope.id, err)
      throw new Error('Unable to update product scope.')
    }
  }
}

// ============================================================================
// Sync Operation
// ============================================================================

/**
 * Syncs product scopes for a project. No user auth required.
 * Compares incoming scopes with existing scopes and performs
 * create/update/delete operations atomically in a transaction.
 *
 * Scopes with IDs starting with 'temp_' are treated as new.
 * Scopes in DB but not in input will be deleted.
 * The default "General" scope cannot be deleted or become an initiative.
 */
export async function syncProductScopesAdmin(
  projectId: string,
  incomingScopes: SyncScopeInput[]
): Promise<SyncScopesResult> {
  const existingRows = await db
    .select()
    .from(productScopes)
    .where(eq(productScopes.project_id, projectId))

  const existingScopesById = new Map(
    existingRows.map((scope) => [scope.id, scope as unknown as ProductScopeRecord])
  )
  const incomingScopesById = new Map(incomingScopes.map((scope) => [scope.id, scope]))

  const result: SyncScopesResult = {
    created: [],
    updated: [],
    deleted: [],
  }

  const newScopes = incomingScopes.filter((scope) => scope.id.startsWith('temp_'))
  const existingIncomingScopes = incomingScopes.filter((scope) => !scope.id.startsWith('temp_'))

  // Check total scope count
  const deletedCount = Array.from(existingScopesById.keys()).filter(
    (id) => !incomingScopesById.has(id)
  ).length
  const finalCount = existingScopesById.size + newScopes.length - deletedCount

  if (finalCount > MAX_SCOPES_PER_PROJECT) {
    throw new Error(`Maximum of ${MAX_SCOPES_PER_PROJECT} product scopes per project.`)
  }

  await db.transaction(async (tx) => {
    await deleteRemovedScopes(tx, existingScopesById, incomingScopesById, result)
    await createNewScopes(tx, projectId, newScopes, result)
    await updateExistingScopes(tx, existingIncomingScopes, existingScopesById, result)
  })

  // Fire embeddings + automation events for created/updated scopes after txn commits
  for (const scope of result.created) {
    fireEmbedding(scope.id, 'product_scope', projectId, buildProductScopeEmbeddingText(scope))
    notifyAutomationEvent('scope.created', {
      projectId,
      entity: { type: 'scope', id: scope.id, name: scope.name },
    })
  }
  for (const scope of result.updated) {
    fireEmbedding(scope.id, 'product_scope', projectId, buildProductScopeEmbeddingText(scope))
    notifyAutomationEvent('scope.updated', {
      projectId,
      entity: { type: 'scope', id: scope.id, name: scope.name },
    })
  }

  return result
}

// ============================================================================
// Search
// ============================================================================

export interface SearchScopeResult {
  id: string
  name: string
  snippet: string
  score?: number
}

export async function searchScopes(
  projectId: string,
  query: string,
  limit: number = 10,
  options?: { mode?: SearchMode; threshold?: number }
): Promise<SearchScopeResult[]> {
  return searchByMode<SearchScopeResult>({
    logPrefix: '[product-scopes-service]',
    mode: options?.mode,
    semanticSearch: async () => {
      const results = await searchProductScopesSemantic(projectId, query, {
        limit,
        threshold: options?.threshold ?? 0.4,
      })
      return results.map((r) => ({
        id: r.scopeId,
        name: r.name,
        snippet: r.description.slice(0, 200),
        score: r.similarity,
      }))
    },
    keywordSearch: async () => {
      const s = `%${query}%`
      const data = await db
        .select({
          id: productScopes.id,
          name: productScopes.name,
          description: productScopes.description,
        })
        .from(productScopes)
        .where(
          and(
            eq(productScopes.project_id, projectId),
            or(
              ilike(productScopes.name, s),
              ilike(productScopes.description, s),
              sql`${productScopes.goals}::text ILIKE ${s}`,
            )
          )
        )
        .orderBy(asc(productScopes.position))
        .limit(limit)
      return data.map((r) => ({
        id: r.id,
        name: r.name,
        snippet: (r.description || '').slice(0, 200),
      }))
    },
  })
}

// ============================================================================
// Aliases - auth is handled at the route level, not in the service layer
// ============================================================================

export const createProductScope = createProductScopeAdmin
export const updateProductScope = updateProductScopeAdmin

export async function syncProductScopes(
  projectId: string,
  incomingScopes: SyncScopeInput[]
): Promise<SyncScopesResult> {
  return syncProductScopesAdmin(projectId, incomingScopes)
}
