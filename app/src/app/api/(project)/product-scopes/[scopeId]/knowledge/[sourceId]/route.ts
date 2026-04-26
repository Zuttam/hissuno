import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgeSources, entityRelationships, productScopes } from '@/lib/db/schema/app'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { setEntityProductScope } from '@/lib/db/queries/entity-relationships'

export const runtime = 'nodejs'

type RouteParams = { scopeId: string; sourceId: string }
type RouteContext = { params: Promise<RouteParams> }

async function assertSourceInScope(sourceId: string, scopeId: string, projectId: string): Promise<boolean> {
  // entity_relationships row implies the scope exists (FK), so a single lookup is enough.
  const [link] = await db
    .select({ id: entityRelationships.id })
    .from(entityRelationships)
    .where(
      and(
        eq(entityRelationships.project_id, projectId),
        eq(entityRelationships.knowledge_source_id, sourceId),
        eq(entityRelationships.product_scope_id, scopeId),
      ),
    )
    .limit(1)
  return Boolean(link)
}

/**
 * GET /api/product-scopes/[scopeId]/knowledge/[sourceId]?projectId=...
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { scopeId, sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    if (!(await assertSourceInScope(sourceId, scopeId, projectId))) {
      return NextResponse.json({ error: 'Source not found in scope.' }, { status: 404 })
    }

    const source = await db.query.knowledgeSources.findFirst({
      where: and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId),
      ),
    })

    if (!source) {
      return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    }

    return NextResponse.json({ source: { ...source, product_scope_id: scopeId } })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[scope-knowledge.getOne] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load knowledge source.' }, { status: 500 })
  }
}

/**
 * PATCH /api/product-scopes/[scopeId]/knowledge/[sourceId]?projectId=...
 * Update a knowledge source. To move to a different scope, pass `product_scope_id`.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { scopeId, sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const payload = await request.json().catch(() => null)
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    if (!(await assertSourceInScope(sourceId, scopeId, projectId))) {
      return NextResponse.json({ error: 'Source not found in scope.' }, { status: 404 })
    }

    const source = await db.query.knowledgeSources.findFirst({
      where: and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId),
      ),
    })
    if (!source) {
      return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}

    if (typeof payload.enabled === 'boolean') {
      updates.enabled = payload.enabled
    }
    if (payload.name !== undefined) {
      updates.name = payload.name || null
    }
    if (payload.description !== undefined) {
      updates.description = payload.description || null
    }
    if (payload.custom_fields !== undefined) {
      updates.custom_fields = payload.custom_fields
    }
    if (typeof payload.analysis_scope === 'string') {
      updates.analysis_scope = payload.analysis_scope.trim() || null
    }
    if (typeof payload.sort_order === 'number') {
      updates.sort_order = payload.sort_order
    }

    if (payload.parent_id !== undefined) {
      const newParentId = payload.parent_id || null
      if (newParentId) {
        let currentId: string | null = newParentId
        while (currentId) {
          if (currentId === sourceId) {
            return NextResponse.json(
              { error: 'Cannot move a source into its own descendant.' },
              { status: 400 },
            )
          }
          const parent = await db.query.knowledgeSources.findFirst({
            where: eq(knowledgeSources.id, currentId),
            columns: { parent_id: true },
          })
          currentId = parent?.parent_id ?? null
        }
      }
      updates.parent_id = newParentId
    }

    const hasProductScopeUpdate =
      typeof payload.product_scope_id === 'string' && payload.product_scope_id !== scopeId

    if (Object.keys(updates).length === 0 && !hasProductScopeUpdate) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(knowledgeSources)
        .set(updates)
        .where(
          and(
            eq(knowledgeSources.id, sourceId),
            eq(knowledgeSources.project_id, projectId),
          ),
        )
    }

    let resolvedScopeId = scopeId
    if (hasProductScopeUpdate && typeof payload.product_scope_id === 'string') {
      const [targetScope] = await db
        .select({ id: productScopes.id })
        .from(productScopes)
        .where(and(eq(productScopes.id, payload.product_scope_id), eq(productScopes.project_id, projectId)))
        .limit(1)
      if (!targetScope) {
        return NextResponse.json({ error: 'Target scope not found.' }, { status: 400 })
      }
      await setEntityProductScope(projectId, 'knowledge_source', sourceId, payload.product_scope_id)
      resolvedScopeId = payload.product_scope_id
    }

    const updatedSource = await db.query.knowledgeSources.findFirst({
      where: and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId),
      ),
    })

    if (!updatedSource) {
      return NextResponse.json({ error: 'Failed to update knowledge source.' }, { status: 500 })
    }

    return NextResponse.json({ source: { ...updatedSource, product_scope_id: resolvedScopeId } })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[scope-knowledge.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update knowledge source.' }, { status: 500 })
  }
}

/**
 * DELETE /api/product-scopes/[scopeId]/knowledge/[sourceId]?projectId=...&children=reparent|delete
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { scopeId, sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    if (!(await assertSourceInScope(sourceId, scopeId, projectId))) {
      return NextResponse.json({ error: 'Source not found in scope.' }, { status: 404 })
    }

    const childrenMode = request.nextUrl.searchParams.get('children') ?? 'reparent'

    const source = await db.query.knowledgeSources.findFirst({
      where: and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId),
      ),
    })

    if (!source) {
      return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    }

    const children = await db.query.knowledgeSources.findMany({
      where: and(
        eq(knowledgeSources.parent_id, sourceId),
        eq(knowledgeSources.project_id, projectId),
      ),
      columns: { id: true },
    })

    if (children.length > 0) {
      if (childrenMode === 'delete') {
        const toDelete: string[] = []
        const queue = children.map((c) => c.id)
        while (queue.length > 0) {
          const id = queue.pop()!
          toDelete.push(id)
          const grandchildren = await db.query.knowledgeSources.findMany({
            where: and(
              eq(knowledgeSources.parent_id, id),
              eq(knowledgeSources.project_id, projectId),
            ),
            columns: { id: true },
          })
          queue.push(...grandchildren.map((c) => c.id))
        }
        if (toDelete.length > 0) {
          await db
            .delete(knowledgeSources)
            .where(inArray(knowledgeSources.id, toDelete))
        }
      } else {
        const childIds = children.map((c) => c.id)
        await db
          .update(knowledgeSources)
          .set({ parent_id: source.parent_id ?? null })
          .where(inArray(knowledgeSources.id, childIds))
      }
    }

    if (source.storage_path && source.type === 'uploaded_doc') {
      const { deleteDocument } = await import('@/lib/knowledge/storage')
      await deleteDocument(source.storage_path)
    }

    await db
      .delete(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.project_id, projectId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[scope-knowledge.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete knowledge source.' }, { status: 500 })
  }
}
