import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNotNull } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgeSources, entityRelationships } from '@/lib/db/schema/app'
import { deleteCodebase, updateGitHubCodebase } from '@/lib/knowledge/codebase'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { setEntityProductScope } from '@/lib/db/queries/entity-relationships'

export const runtime = 'nodejs'

type RouteParams = { sourceId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/knowledge/sources/[sourceId]?projectId=...
 * Get a single knowledge source with enrichment
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const source = await db.query.knowledgeSources.findFirst({
      where: and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId)
      ),
      with: { sourceCode: true },
    })

    if (!source) {
      return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    }

    // Enrich with product_scope_id from entity_relationships
    const [areaLink] = await db.select({
      product_scope_id: entityRelationships.product_scope_id,
    })
      .from(entityRelationships)
      .where(and(
        eq(entityRelationships.knowledge_source_id, sourceId),
        isNotNull(entityRelationships.product_scope_id),
      ))
      .limit(1)

    const enriched = {
      ...source,
      product_scope_id: areaLink?.product_scope_id ?? null,
    }

    return NextResponse.json({ source: enriched })
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

    console.error('[knowledge-sources.getOne] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load knowledge source.' }, { status: 500 })
  }
}

/**
 * PATCH /api/knowledge/sources/[sourceId]?projectId=...
 * Update a knowledge source (enable/disable, update analysis_scope)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    const payload = await request.json().catch(() => null)

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    // First fetch the source to verify it exists and belongs to this project
    const source = await db.query.knowledgeSources.findFirst({
      where: and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId)
      ),
    })

    if (!source) {
      return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    }

    // Build update object with only allowed fields
    const updates: Record<string, unknown> = {}

    // Only allow enabled updates for non-codebase sources
    if (typeof payload.enabled === 'boolean' && source.type !== 'codebase') {
      updates.enabled = payload.enabled
    }

    // Allow name and description updates for all source types
    if (payload.name !== undefined) {
      updates.name = payload.name || null
    }
    if (payload.description !== undefined) {
      updates.description = payload.description || null
    }

    // Track if we're updating source_codes (for codebase)
    let updatedSourceCode = false

    // Handle codebase-specific updates
    if (source.type === 'codebase') {
      // Update analysis_scope
      if (typeof payload.analysis_scope === 'string') {
        updates.analysis_scope = payload.analysis_scope.trim() || null
      }

      // Update repositoryUrl and/or repositoryBranch via source_codes table
      if (payload.repositoryUrl || payload.repositoryBranch) {
        updatedSourceCode = true
        if (!source.source_code_id) {
          return NextResponse.json(
            { error: 'Codebase source has no linked source_code record.' },
            { status: 400 }
          )
        }

        try {
          await updateGitHubCodebase(
            source.source_code_id,
            actingUserId,
            {
              repositoryUrl: payload.repositoryUrl,
              repositoryBranch: payload.repositoryBranch,
            }
          )
        } catch (updateError) {
          console.error('[knowledge-sources.patch] Failed to update codebase:', updateError)
          return NextResponse.json({ error: 'Failed to update codebase.' }, { status: 500 })
        }
      }
    }

    const hasProductScopeUpdate = payload.product_scope_id !== undefined

    // Check if anything is being updated
    if (Object.keys(updates).length === 0 && !updatedSourceCode && !hasProductScopeUpdate) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    // Update knowledge_source if there are field updates
    if (Object.keys(updates).length > 0) {
      await db
        .update(knowledgeSources)
        .set(updates)
        .where(
          and(
            eq(knowledgeSources.id, sourceId),
            eq(knowledgeSources.project_id, projectId)
          )
        )
    }

    // Write product scope to entity_relationships
    if (payload.product_scope_id !== undefined) {
      await setEntityProductScope(projectId, 'knowledge_source', sourceId, payload.product_scope_id ?? null)
    }

    // Fetch and return updated source with source_code if codebase
    const updatedSource = await db.query.knowledgeSources.findFirst({
      where: and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId)
      ),
      with: source.type === 'codebase' ? { sourceCode: true } : undefined,
    })

    if (!updatedSource) {
      return NextResponse.json({ error: 'Failed to update knowledge source.' }, { status: 500 })
    }

    return NextResponse.json({ source: updatedSource })
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

    console.error('[knowledge-sources.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update knowledge source.' }, { status: 500 })
  }
}

/**
 * DELETE /api/knowledge/sources/[sourceId]?projectId=...
 * Delete a knowledge source
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // First fetch the source to get storage_path for cleanup
    const source = await db.query.knowledgeSources.findFirst({
      where: and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId)
      ),
    })

    if (!source) {
      return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    }

    // Clean up linked resources
    if (source.type === 'codebase' && source.source_code_id) {
      const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId
      try {
        await deleteCodebase(source.source_code_id, actingUserId)
      } catch (cleanupError) {
        console.error('[knowledge-sources.delete] Failed to clean up codebase:', cleanupError)
      }
    }

    if (source.storage_path && source.type === 'uploaded_doc') {
      const { deleteDocument } = await import('@/lib/knowledge/storage')
      await deleteDocument(source.storage_path)
    }

    // Delete the database record
    await db
      .delete(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.project_id, projectId)
        )
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

    console.error('[knowledge-sources.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete knowledge source.' }, { status: 500 })
  }
}
