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

import { eq, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productScopes } from '@/lib/db/schema/app'
import { isUniqueViolation } from '@/lib/db/errors'
import { fireEmbedding } from '@/lib/utils/embeddings'
import { buildProductScopeEmbeddingText } from '@/lib/product-scopes/embedding-service'
import type { ProductScopeRecord, ProductScopeType, ProductScopeGoal } from '@/types/product-scope'
import {
  getProductScopeById,
  type SyncScopeInput,
  type SyncScopesResult,
} from '@/lib/db/queries/product-scopes'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Re-export types used by callers
export type { SyncScopeInput, SyncScopesResult } from '@/lib/db/queries/product-scopes'

const MAX_SCOPES_PER_PROJECT = 20

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
}

// ============================================================================
// Admin Operations (for PM Agent Tools and Workflows)
// ============================================================================

/**
 * Creates a product scope with graph eval. No user auth required.
 * Enforces the max-scopes-per-project limit.
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

  try {
    const [created] = await db
      .insert(productScopes)
      .values({
        project_id: projectId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? '',
        color: input.color ?? '',
        position: input.position ?? existing, // append to end if not specified
        is_default: false,
        type: input.type ?? 'product_area',
        goals: (input.goals ?? null) as unknown as Record<string, unknown>,
      })
      .returning()

    const record = created as unknown as ProductScopeRecord
    fireEmbedding(record.id, 'product_scope', projectId, buildProductScopeEmbeddingText(record))
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
    if (input.type === 'initiative') {
      throw new Error('The default product scope cannot be changed to an initiative.')
    }
    if (input.name !== undefined || input.slug !== undefined) {
      throw new Error('Cannot change the name or slug of the default product scope.')
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

  if (Object.keys(updates).length === 0) {
    return existing
  }

  try {
    const [updated] = await db
      .update(productScopes)
      .set(updates)
      .where(eq(productScopes.id, scopeId))
      .returning()

    const record = updated as unknown as ProductScopeRecord
    fireEmbedding(record.id, 'product_scope', record.project_id, buildProductScopeEmbeddingText(record))
    return record
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new Error(`A product scope with slug "${input.slug}" already exists in this project.`)
    }
    throw err
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
    goalsChanged
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
          name: newScope.name,
          slug: newScope.slug,
          description: newScope.description,
          color: newScope.color,
          position: newScope.position,
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

  // Fire embeddings for created/updated scopes after transaction commits
  for (const scope of [...result.created, ...result.updated]) {
    fireEmbedding(scope.id, 'product_scope', projectId, buildProductScopeEmbeddingText(scope))
  }

  return result
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
