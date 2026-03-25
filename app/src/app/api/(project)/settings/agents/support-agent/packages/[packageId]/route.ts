import { NextRequest, NextResponse } from 'next/server'
import { eq, and, ne, inArray, notInArray } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgePackages, knowledgePackageSources, knowledgeSources, projectSettings } from '@/lib/db/schema/app'
import type { KnowledgePackageWithSources } from '@/lib/knowledge/types'

export const runtime = 'nodejs'

type RouteParams = { packageId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/settings/agents/support-agent/packages/[packageId]
 * Get a single named knowledge package with all relations
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[knowledge-packages.getOne] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Fetch the package
    const [pkg] = await db
      .select()
      .from(knowledgePackages)
      .where(
        and(
          eq(knowledgePackages.id, packageId),
          eq(knowledgePackages.project_id, projectId)
        )
      )
      .limit(1)

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Get linked sources
    const sourcesData = await db
      .select({ source_id: knowledgePackageSources.source_id })
      .from(knowledgePackageSources)
      .where(eq(knowledgePackageSources.package_id, pkg.id))

    const sourceIds = sourcesData.map((s) => s.source_id)

    const rawSources = sourceIds.length > 0
      ? await db.select().from(knowledgeSources).where(inArray(knowledgeSources.id, sourceIds))
      : []
    const sources = rawSources as unknown as KnowledgePackageWithSources['sources']

    // Compute lastAnalyzedAt from source data (analyzed_at is Date from Drizzle)
    const lastAnalyzedAt = rawSources.length > 0
      ? rawSources.reduce((latest: string | null, s) => {
          if (!s.analyzed_at) return latest
          const analyzedStr = s.analyzed_at.toISOString()
          if (!latest) return analyzedStr
          return new Date(analyzedStr) > new Date(latest) ? analyzedStr : latest
        }, null as string | null)
      : null

    const result = {
      ...pkg,
      created_at: pkg.created_at?.toISOString() ?? null,
      updated_at: pkg.updated_at?.toISOString() ?? null,
      compiled_at: pkg.compiled_at?.toISOString() ?? null,
      sources,
      sourceCount: sources.length,
      lastAnalyzedAt,
    }

    return NextResponse.json({ package: result })
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

    console.error('[knowledge-packages.getOne] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load knowledge package.' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/agents/support-agent/packages/[packageId]
 * Update a named knowledge package
 *
 * Body:
 * - name?: string
 * - description?: string
 * - guidelines?: string
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[knowledge-packages.patch] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify package exists and belongs to project
    const [existing] = await db
      .select()
      .from(knowledgePackages)
      .where(
        and(
          eq(knowledgePackages.id, packageId),
          eq(knowledgePackages.project_id, projectId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, guidelines, sourceIds, faq_content, howto_content, feature_docs_content, troubleshooting_content } = body as {
      name?: string
      description?: string
      guidelines?: string
      sourceIds?: string[]
      faq_content?: string | null
      howto_content?: string | null
      feature_docs_content?: string | null
      troubleshooting_content?: string | null
    }

    const updates: Record<string, unknown> = {}
    let sourceIdsChanged = false

    if (name !== undefined) {
      const trimmedName = name.trim()
      if (trimmedName.length === 0) {
        return NextResponse.json({ error: 'Package name cannot be empty.' }, { status: 400 })
      }

      // Check for duplicate name (if changing)
      if (trimmedName !== existing.name) {
        const [duplicate] = await db
          .select({ id: knowledgePackages.id })
          .from(knowledgePackages)
          .where(
            and(
              eq(knowledgePackages.project_id, projectId),
              eq(knowledgePackages.name, trimmedName),
              ne(knowledgePackages.id, packageId)
            )
          )
          .limit(1)

        if (duplicate) {
          return NextResponse.json({ error: 'A package with this name already exists.' }, { status: 409 })
        }
      }

      updates.name = trimmedName
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null
    }

    if (guidelines !== undefined) {
      updates.guidelines = guidelines?.trim() || null
    }

    if (faq_content !== undefined) {
      updates.faq_content = faq_content?.trim() || null
    }

    if (howto_content !== undefined) {
      updates.howto_content = howto_content?.trim() || null
    }

    if (feature_docs_content !== undefined) {
      updates.feature_docs_content = feature_docs_content?.trim() || null
    }

    if (troubleshooting_content !== undefined) {
      updates.troubleshooting_content = troubleshooting_content?.trim() || null
    }

    if (sourceIds !== undefined) {
      sourceIdsChanged = true
    }

    if (Object.keys(updates).length === 0 && !sourceIdsChanged) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    // Update package fields if any changed
    let updated = existing
    if (Object.keys(updates).length > 0) {
      const [result] = await db
        .update(knowledgePackages)
        .set(updates)
        .where(
          and(
            eq(knowledgePackages.id, packageId),
            eq(knowledgePackages.project_id, projectId)
          )
        )
        .returning()

      if (!result) {
        console.error('[knowledge-packages.patch] failed to update package')
        return NextResponse.json({ error: 'Failed to update knowledge package.' }, { status: 500 })
      }
      updated = result
    }

    // Sync source associations if sourceIds provided
    if (sourceIdsChanged) {
      // Validate provided sourceIds belong to this project
      const validSourceIds = sourceIds && sourceIds.length > 0
        ? (await db
            .select({ id: knowledgeSources.id })
            .from(knowledgeSources)
            .where(
              and(
                eq(knowledgeSources.project_id, projectId),
                inArray(knowledgeSources.id, sourceIds)
              )
            )
          ).map((s) => s.id)
        : []

      // Remove sources no longer in the list
      if (validSourceIds.length > 0) {
        await db
          .delete(knowledgePackageSources)
          .where(
            and(
              eq(knowledgePackageSources.package_id, packageId),
              notInArray(knowledgePackageSources.source_id, validSourceIds)
            )
          )
      } else {
        // Remove all source associations
        await db
          .delete(knowledgePackageSources)
          .where(eq(knowledgePackageSources.package_id, packageId))
      }

      // Insert new associations
      if (validSourceIds.length > 0) {
        // Get existing associations to avoid duplicates
        const existingLinks = await db
          .select({ source_id: knowledgePackageSources.source_id })
          .from(knowledgePackageSources)
          .where(eq(knowledgePackageSources.package_id, packageId))

        const existingSourceIds = new Set(existingLinks.map((l) => l.source_id))
        const newSourceIds = validSourceIds.filter((id) => !existingSourceIds.has(id))

        if (newSourceIds.length > 0) {
          await db
            .insert(knowledgePackageSources)
            .values(newSourceIds.map((sourceId) => ({
              package_id: packageId,
              source_id: sourceId,
            })))
        }
      }
    }

    return NextResponse.json({ package: updated })
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

    console.error('[knowledge-packages.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update knowledge package.' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/agents/support-agent/packages/[packageId]
 * Delete a named knowledge package
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[knowledge-packages.delete] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify package exists and belongs to project
    const [existing] = await db
      .select({ id: knowledgePackages.id, name: knowledgePackages.name })
      .from(knowledgePackages)
      .where(
        and(
          eq(knowledgePackages.id, packageId),
          eq(knowledgePackages.project_id, projectId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Check if this is the active support agent package
    const [settings] = await db
      .select({ support_agent_package_id: projectSettings.support_agent_package_id })
      .from(projectSettings)
      .where(eq(projectSettings.project_id, projectId))
      .limit(1)

    if (settings?.support_agent_package_id === packageId) {
      // Clear the reference before deleting
      await db
        .update(projectSettings)
        .set({ support_agent_package_id: null })
        .where(eq(projectSettings.project_id, projectId))
    }

    // Delete the package (cascade will handle related records)
    await db
      .delete(knowledgePackages)
      .where(
        and(
          eq(knowledgePackages.id, packageId),
          eq(knowledgePackages.project_id, projectId)
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

    console.error('[knowledge-packages.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete knowledge package.' }, { status: 500 })
  }
}
