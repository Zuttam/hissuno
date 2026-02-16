import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { NamedPackageWithSources } from '@/lib/knowledge/types'

export const runtime = 'nodejs'

type RouteParams = { id: string; packageId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/knowledge/packages/[packageId]
 * Get a single named knowledge package with all relations
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-packages.getOne] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    // Fetch the package
    const { data: pkg, error: pkgError } = await supabase
      .from('named_knowledge_packages')
      .select('*')
      .eq('id', packageId)
      .eq('project_id', projectId)
      .single()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Get linked sources
    const { data: sourcesData } = await supabase
      .from('named_package_sources')
      .select('source_id')
      .eq('package_id', pkg.id)

    const sourceIds = sourcesData?.map((s) => s.source_id) ?? []

    let sources: NamedPackageWithSources['sources'] = []
    if (sourceIds.length > 0) {
      const { data: sourcesRecords } = await supabase
        .from('knowledge_sources')
        .select('*')
        .in('id', sourceIds)

      sources = sourcesRecords ?? []
    }

    // Get generated categories
    const { data: categories } = await supabase
      .from('knowledge_packages')
      .select('*')
      .eq('named_package_id', pkg.id)

    // Find most recent analysis timestamp
    const lastAnalyzedAt = categories?.length
      ? categories.reduce((latest, cat) => {
          if (!latest) return cat.generated_at
          return new Date(cat.generated_at) > new Date(latest) ? cat.generated_at : latest
        }, null as string | null)
      : null

    const result: NamedPackageWithSources = {
      ...pkg,
      sources,
      categories: categories ?? [],
      sourceCount: sources.length,
      lastAnalyzedAt,
    }

    return NextResponse.json({ package: result })
  } catch (error) {
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
 * PATCH /api/projects/[id]/knowledge/packages/[packageId]
 * Update a named knowledge package
 *
 * Body:
 * - name?: string
 * - description?: string
 * - guidelines?: string
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-packages.patch] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    // Verify package exists and belongs to project
    const { data: existing, error: fetchError } = await supabase
      .from('named_knowledge_packages')
      .select('*')
      .eq('id', packageId)
      .eq('project_id', projectId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, guidelines } = body as {
      name?: string
      description?: string
      guidelines?: string
    }

    const updates: Record<string, unknown> = {}

    if (name !== undefined) {
      const trimmedName = name.trim()
      if (trimmedName.length === 0) {
        return NextResponse.json({ error: 'Package name cannot be empty.' }, { status: 400 })
      }

      // Check for duplicate name (if changing)
      if (trimmedName !== existing.name) {
        const { data: duplicate } = await supabase
          .from('named_knowledge_packages')
          .select('id')
          .eq('project_id', projectId)
          .eq('name', trimmedName)
          .neq('id', packageId)
          .single()

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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('named_knowledge_packages')
      .update(updates)
      .eq('id', packageId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (updateError) {
      console.error('[knowledge-packages.patch] failed to update package', updateError)
      return NextResponse.json({ error: 'Failed to update knowledge package.' }, { status: 500 })
    }

    return NextResponse.json({ package: updated })
  } catch (error) {
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
 * DELETE /api/projects/[id]/knowledge/packages/[packageId]
 * Delete a named knowledge package
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-packages.delete] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    // Verify package exists and belongs to project
    const { data: existing, error: fetchError } = await supabase
      .from('named_knowledge_packages')
      .select('id, name')
      .eq('id', packageId)
      .eq('project_id', projectId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Check if this is the active support agent package
    const { data: settings } = await supabase
      .from('project_settings')
      .select('support_agent_package_id')
      .eq('project_id', projectId)
      .single()

    if (settings?.support_agent_package_id === packageId) {
      // Clear the reference before deleting
      await supabase
        .from('project_settings')
        .update({ support_agent_package_id: null })
        .eq('project_id', projectId)
    }

    // Delete the package (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('named_knowledge_packages')
      .delete()
      .eq('id', packageId)
      .eq('project_id', projectId)

    if (deleteError) {
      console.error('[knowledge-packages.delete] failed to delete package', deleteError)
      return NextResponse.json({ error: 'Failed to delete knowledge package.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
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
