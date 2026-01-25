import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; packageId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * Helper to verify package belongs to project
 */
async function verifyPackageOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packageId: string,
  projectId: string
) {
  const { data, error } = await supabase
    .from('named_knowledge_packages')
    .select('id')
    .eq('id', packageId)
    .eq('project_id', projectId)
    .single()

  return !error && data !== null
}

/**
 * POST /api/projects/[id]/knowledge/packages/[packageId]/sources
 * Link sources to a package
 *
 * Body:
 * - sourceIds: string[] - IDs of sources to link
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[package-sources.post] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Verify package belongs to project
    const isOwned = await verifyPackageOwnership(supabase, packageId, projectId)
    if (!isOwned) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    const body = await request.json()
    const { sourceIds } = body as { sourceIds: string[] }

    if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return NextResponse.json({ error: 'sourceIds array is required.' }, { status: 400 })
    }

    // Verify sources belong to this project
    const { data: validSources } = await supabase
      .from('knowledge_sources')
      .select('id')
      .eq('project_id', projectId)
      .in('id', sourceIds)

    const validSourceIds = validSources?.map((s) => s.id) ?? []

    if (validSourceIds.length === 0) {
      return NextResponse.json({ error: 'No valid sources found.' }, { status: 400 })
    }

    // Get existing links to avoid duplicates
    const { data: existingLinks } = await supabase
      .from('named_package_sources')
      .select('source_id')
      .eq('package_id', packageId)
      .in('source_id', validSourceIds)

    const existingSourceIds = new Set(existingLinks?.map((l) => l.source_id) ?? [])
    const newSourceIds = validSourceIds.filter((id) => !existingSourceIds.has(id))

    if (newSourceIds.length === 0) {
      return NextResponse.json({
        linked: 0,
        message: 'All sources are already linked.',
      })
    }

    // Create new links
    const { error: linkError } = await supabase
      .from('named_package_sources')
      .insert(newSourceIds.map((sourceId) => ({
        package_id: packageId,
        source_id: sourceId,
      })))

    if (linkError) {
      console.error('[package-sources.post] failed to link sources', linkError)
      return NextResponse.json({ error: 'Failed to link sources.' }, { status: 500 })
    }

    return NextResponse.json({
      linked: newSourceIds.length,
      sourceIds: newSourceIds,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[package-sources.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to link sources.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/knowledge/packages/[packageId]/sources
 * Unlink sources from a package
 *
 * Body:
 * - sourceIds: string[] - IDs of sources to unlink
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { id: projectId, packageId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[package-sources.delete] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Verify package belongs to project
    const isOwned = await verifyPackageOwnership(supabase, packageId, projectId)
    if (!isOwned) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    const body = await request.json()
    const { sourceIds } = body as { sourceIds: string[] }

    if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return NextResponse.json({ error: 'sourceIds array is required.' }, { status: 400 })
    }

    // Delete the links
    const { error: deleteError } = await supabase
      .from('named_package_sources')
      .delete()
      .eq('package_id', packageId)
      .in('source_id', sourceIds)

    if (deleteError) {
      console.error('[package-sources.delete] failed to unlink sources', deleteError)
      return NextResponse.json({ error: 'Failed to unlink sources.' }, { status: 500 })
    }

    return NextResponse.json({
      unlinked: sourceIds.length,
      sourceIds,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[package-sources.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to unlink sources.' }, { status: 500 })
  }
}
