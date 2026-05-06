/**
 * Scope resolution helpers for plugin sync handlers.
 *
 * Knowledge sources and codebases live under a product scope. Plugin streams
 * usually pick a target scope via a stream setting; if the user didn't set
 * one, fall back to the project's default scope so synced data lands
 * somewhere visible.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productScopes } from '@/lib/db/schema/app'

/**
 * Pick the target scope for a sync run. If `preferredScopeId` is provided it
 * is validated against the project; otherwise the project's default scope is
 * returned. Throws if neither resolves — projects are expected to always
 * have a default scope (created at project creation, backfilled by migration
 * 0008).
 */
export async function resolveTargetScopeId(
  projectId: string,
  preferredScopeId?: string | null,
): Promise<string> {
  if (preferredScopeId) {
    const [row] = await db
      .select({ id: productScopes.id })
      .from(productScopes)
      .where(and(eq(productScopes.id, preferredScopeId), eq(productScopes.project_id, projectId)))
      .limit(1)
    if (row) return row.id
  }

  const [defaultScope] = await db
    .select({ id: productScopes.id })
    .from(productScopes)
    .where(and(eq(productScopes.project_id, projectId), eq(productScopes.is_default, true)))
    .limit(1)

  if (!defaultScope) {
    throw new Error(`Project ${projectId} has no default product scope; cannot resolve target scope.`)
  }
  return defaultScope.id
}
