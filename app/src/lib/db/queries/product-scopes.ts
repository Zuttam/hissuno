/**
 * Product Scopes Queries (Drizzle)
 */

import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productScopes } from '@/lib/db/schema/app'
import { isUniqueViolation } from '@/lib/db/errors'
import type { ProductScopeRecord, ProductScopeType, ProductScopeGoal } from '@/types/product-scope'

export type ProductScopeRow = typeof productScopes.$inferSelect
export type ProductScopeInsert = typeof productScopes.$inferInsert

/**
 * Lists product scopes for a project.
 */
export async function listProjectProductScopes(projectId: string): Promise<ProductScopeRecord[]> {
  try {
    const rows = await db
      .select()
      .from(productScopes)
      .where(eq(productScopes.project_id, projectId))
      .orderBy(asc(productScopes.position))

    return rows as unknown as ProductScopeRecord[]
  } catch (error) {
    console.error('[db.product-scopes] unexpected error listing product scopes', error)
    throw error
  }
}

/** @deprecated Use `listProjectProductScopes` instead. */
export const getProjectProductScopes = listProjectProductScopes

/**
 * Input for syncing product scopes
 */
export interface SyncScopeInput {
  id: string // Real ID for existing scopes, temp_${timestamp} for new scopes
  name: string
  slug: string
  description: string
  color: string
  position: number
  is_default: boolean
  type: ProductScopeType
  goals: ProductScopeGoal[] | null
  parent_id?: string | null
}

/**
 * Result of syncing product scopes
 */
export interface SyncScopesResult {
  created: ProductScopeRecord[]
  updated: ProductScopeRecord[]
  deleted: string[]
}

// ---------------------------------------------------------------------------
// Individual CRUD operations
// ---------------------------------------------------------------------------

/**
 * Input for updating a single product scope.
 */
export interface UpdateProductScopeInput {
  name?: string
  slug?: string
  description?: string
  color?: string
  type?: ProductScopeType
  goals?: ProductScopeGoal[] | null
  parent_id?: string | null
  custom_fields?: Record<string, unknown>
}

/**
 * Get a single product scope by ID. No auth check (caller must verify access).
 */
export async function getProductScopeById(scopeId: string): Promise<ProductScopeRecord | null> {
  const [row] = await db
    .select()
    .from(productScopes)
    .where(eq(productScopes.id, scopeId))
    .limit(1)

  return (row as unknown as ProductScopeRecord) ?? null
}

/**
 * Update a single product scope. Respects default-scope protections.
 */
export async function updateProductScope(
  scopeId: string,
  input: UpdateProductScopeInput,
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
  if (input.type !== undefined) updates.type = input.type
  if (input.goals !== undefined) updates.goals = input.goals as unknown as Record<string, unknown>
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id
  if (input.custom_fields !== undefined) updates.custom_fields = input.custom_fields

  if (Object.keys(updates).length === 0) {
    return existing
  }

  try {
    const [updated] = await db
      .update(productScopes)
      .set(updates)
      .where(eq(productScopes.id, scopeId))
      .returning()

    return updated as unknown as ProductScopeRecord
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new Error(`A product scope with slug "${input.slug}" already exists in this project.`)
    }
    throw err
  }
}

/**
 * Delete a single product scope. Cannot delete the default scope.
 * By default, reparents children to the deleted scope's parent.
 * Pass childrenMode='delete' to cascade-delete children instead.
 */
export async function deleteProductScope(
  scopeId: string,
  childrenMode: 'reparent' | 'delete' = 'reparent',
): Promise<void> {
  const existing = await getProductScopeById(scopeId)
  if (!existing) {
    throw new Error('Product scope not found.')
  }

  if (existing.is_default) {
    throw new Error('Cannot delete the default product scope.')
  }

  await db.transaction(async (tx) => {
    if (childrenMode === 'reparent') {
      // Move children up to the deleted scope's parent
      const newParentId = existing.parent_id
      const newDepth = existing.depth > 0 ? existing.depth - 1 : 0
      const children = await tx
        .select()
        .from(productScopes)
        .where(eq(productScopes.parent_id, scopeId))

      for (const child of children) {
        await tx
          .update(productScopes)
          .set({ parent_id: newParentId, depth: newDepth })
          .where(eq(productScopes.id, child.id))
        // Recursively update descendants' depth
        await updateDescendantDepths(tx, child.id, newDepth + 1)
      }
    } else {
      // Cascade delete all descendants
      await deleteDescendants(tx, scopeId)
    }

    await tx.delete(productScopes).where(eq(productScopes.id, scopeId))
  })
}

async function updateDescendantDepths(
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
    await updateDescendantDepths(tx, child.id, depth + 1)
  }
}

async function deleteDescendants(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  parentId: string,
): Promise<void> {
  const children = await tx
    .select()
    .from(productScopes)
    .where(eq(productScopes.parent_id, parentId))

  for (const child of children) {
    await deleteDescendants(tx, child.id)
    await tx.delete(productScopes).where(eq(productScopes.id, child.id))
  }
}
