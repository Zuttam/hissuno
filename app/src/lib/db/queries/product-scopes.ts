/**
 * Product Scopes Queries (Drizzle)
 */

import { cache } from 'react'
import { eq, asc, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productScopes } from '@/lib/db/schema/app'
import { isUniqueViolation } from '@/lib/db/errors'
import { UnauthorizedError } from '@/lib/auth/server'
import { resolveRequestContext } from '@/lib/db/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import type { ProductScopeRecord, ProductScopeType, ProductScopeGoal } from '@/types/product-scope'

export type ProductScopeRow = typeof productScopes.$inferSelect
export type ProductScopeInsert = typeof productScopes.$inferInsert

const MAX_SCOPES_PER_PROJECT = 20

/**
 * Lists product scopes for a project. Requires authenticated user context.
 * Only returns scopes for projects the current user has access to.
 */
export const listProjectProductScopes = cache(async (projectId: string): Promise<ProductScopeRecord[]> => {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

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
})

/**
 * Gets product scopes for a project using admin client (no auth).
 * Used by workflows and internal services.
 */
export async function getProjectProductScopes(projectId: string): Promise<ProductScopeRecord[]> {
  try {
    const rows = await db
      .select()
      .from(productScopes)
      .where(eq(productScopes.project_id, projectId))
      .orderBy(asc(productScopes.position))

    return rows as unknown as ProductScopeRecord[]
  } catch (error) {
    console.error('[db.product-scopes] unexpected error getting product scopes', error)
    return []
  }
}

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
}

/**
 * Result of syncing product scopes
 */
export interface SyncScopesResult {
  created: ProductScopeRecord[]
  updated: ProductScopeRecord[]
  deleted: string[]
}

/**
 * Syncs product scopes for a project. Compares incoming scopes with existing scopes
 * and performs create/update/delete operations as needed.
 *
 * Scopes with IDs starting with 'temp_' are treated as new and will be created.
 * Scopes that exist in DB but not in input will be deleted.
 * Scopes that exist in both will be updated if changed.
 * The default "General" scope cannot be deleted or become an initiative.
 */
export async function syncProductScopes(
  projectId: string,
  incomingScopes: SyncScopeInput[]
): Promise<SyncScopesResult> {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

    // Get existing scopes
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

    // Determine new scopes (temp_ prefix) and existing scopes
    const newScopes = incomingScopes.filter((scope) => scope.id.startsWith('temp_'))
    const existingIncomingScopes = incomingScopes.filter((scope) => !scope.id.startsWith('temp_'))

    // Check total scope count
    const existingCount = existingScopesById.size
    const newCount = newScopes.length
    const deletedCount = Array.from(existingScopesById.keys()).filter(
      (id) => !incomingScopesById.has(id)
    ).length
    const finalCount = existingCount + newCount - deletedCount

    if (finalCount > MAX_SCOPES_PER_PROJECT) {
      throw new Error(`Maximum of ${MAX_SCOPES_PER_PROJECT} product scopes per project.`)
    }

    // Wrap all mutations in a transaction for atomicity
    await db.transaction(async (tx) => {
      // Delete scopes that are no longer in the list (protect default)
      for (const existingScope of existingScopesById.values()) {
        if (!incomingScopesById.has(existingScope.id)) {
          if (existingScope.is_default) {
            throw new Error('Cannot delete the default product scope.')
          }

          await tx
            .delete(productScopes)
            .where(eq(productScopes.id, existingScope.id))

          result.deleted.push(existingScope.id)
        }
      }

      // Create new scopes
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
          console.error('[db.product-scopes] failed to create scope', err)
          throw new Error('Unable to create product scope.')
        }
      }

      // Update existing scopes that have changes
      for (const incomingScope of existingIncomingScopes) {
        const existingScope = existingScopesById.get(incomingScope.id)
        if (!existingScope) {
          console.warn('[db.product-scopes] scope ID not found in DB', incomingScope.id)
          continue
        }

        // Protect default scope: cannot become initiative
        if (existingScope.is_default && incomingScope.type === 'initiative') {
          throw new Error('The default product scope cannot be changed to an initiative.')
        }

        // Protect default scope name/slug
        if (existingScope.is_default) {
          // Only allow position, description, color, and goals changes on default scope
          const goalsChanged = JSON.stringify(existingScope.goals) !== JSON.stringify(incomingScope.goals)
          const hasChanges =
            existingScope.description !== incomingScope.description ||
            existingScope.color !== incomingScope.color ||
            existingScope.position !== incomingScope.position ||
            goalsChanged

          if (hasChanges) {
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
          }
          continue
        }

        // Check if anything changed for non-default scopes
        const goalsChanged = JSON.stringify(existingScope.goals) !== JSON.stringify(incomingScope.goals)
        const hasChanges =
          existingScope.name !== incomingScope.name ||
          existingScope.slug !== incomingScope.slug ||
          existingScope.description !== incomingScope.description ||
          existingScope.color !== incomingScope.color ||
          existingScope.position !== incomingScope.position ||
          existingScope.type !== incomingScope.type ||
          goalsChanged

        if (hasChanges) {
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
            console.error('[db.product-scopes] failed to update scope', incomingScope.id, err)
            throw new Error('Unable to update product scope.')
          }
        }
      }
    })

    return result
  } catch (error) {
    console.error('[db.product-scopes] unexpected error syncing product scopes', error)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Individual CRUD operations
// ---------------------------------------------------------------------------

/**
 * Input for creating a single product scope.
 */
export interface CreateProductScopeInput {
  name: string
  slug: string
  description?: string
  color?: string
  type?: ProductScopeType
  goals?: ProductScopeGoal[] | null
}

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
 * Create a single product scope. Enforces the max-scopes-per-project limit.
 */
export async function createProductScope(
  projectId: string,
  input: CreateProductScopeInput,
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
        position: existing, // append to end
        is_default: false,
        type: input.type ?? 'product_area',
        goals: (input.goals ?? null) as unknown as Record<string, unknown>,
      })
      .returning()

    return created as unknown as ProductScopeRecord
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new Error(`A product scope with slug "${input.slug}" already exists in this project.`)
    }
    throw err
  }
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
 */
export async function deleteProductScope(scopeId: string): Promise<void> {
  const existing = await getProductScopeById(scopeId)
  if (!existing) {
    throw new Error('Product scope not found.')
  }

  if (existing.is_default) {
    throw new Error('Cannot delete the default product scope.')
  }

  await db
    .delete(productScopes)
    .where(eq(productScopes.id, scopeId))
}
