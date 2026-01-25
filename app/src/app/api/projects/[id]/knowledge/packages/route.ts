import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { NamedPackageWithSources } from '@/lib/knowledge/types'

export const runtime = 'nodejs'

type RouteParams = { id: string }

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
 * GET /api/projects/[id]/knowledge/packages
 * List all named knowledge packages for a project
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-packages.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Fetch all named packages for the project
    const { data: packages, error: packagesError } = await supabase
      .from('named_knowledge_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (packagesError) {
      console.error('[knowledge-packages.get] failed to load packages', projectId, packagesError)
      return NextResponse.json({ error: 'Failed to load knowledge packages.' }, { status: 500 })
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json({ packages: [] })
    }

    // Fetch related data for each package
    const packagesWithRelations: NamedPackageWithSources[] = await Promise.all(
      packages.map(async (pkg) => {
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

        return {
          ...pkg,
          sources,
          categories: categories ?? [],
          sourceCount: sources.length,
          lastAnalyzedAt,
        }
      })
    )

    return NextResponse.json({ packages: packagesWithRelations })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge-packages.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load knowledge packages.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/knowledge/packages
 * Create a new named knowledge package
 *
 * Body:
 * - name: string (required)
 * - description?: string
 * - guidelines?: string
 * - sourceIds?: string[] - IDs of sources to link
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-packages.post] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    const body = await request.json()
    const { name, description, guidelines, sourceIds } = body as {
      name: string
      description?: string
      guidelines?: string
      sourceIds?: string[]
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Package name is required.' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('named_knowledge_packages')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', trimmedName)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A package with this name already exists.' }, { status: 409 })
    }

    // Create the package
    const { data: pkg, error: createError } = await supabase
      .from('named_knowledge_packages')
      .insert({
        project_id: projectId,
        name: trimmedName,
        description: description?.trim() || null,
        guidelines: guidelines?.trim() || null,
      })
      .select()
      .single()

    if (createError) {
      console.error('[knowledge-packages.post] failed to create package', createError)
      return NextResponse.json({ error: 'Failed to create knowledge package.' }, { status: 500 })
    }

    // Link sources if provided
    if (sourceIds && sourceIds.length > 0) {
      // Verify sources belong to this project
      const { data: validSources } = await supabase
        .from('knowledge_sources')
        .select('id')
        .eq('project_id', projectId)
        .in('id', sourceIds)

      const validSourceIds = validSources?.map((s) => s.id) ?? []

      if (validSourceIds.length > 0) {
        const { error: linkError } = await supabase
          .from('named_package_sources')
          .insert(validSourceIds.map((sourceId) => ({
            package_id: pkg.id,
            source_id: sourceId,
          })))

        if (linkError) {
          console.error('[knowledge-packages.post] failed to link sources', linkError)
          // Package created, just warn about sources
        }
      }
    }

    // Return the created package with relations
    const { data: sources } = await supabase
      .from('knowledge_sources')
      .select('*')
      .eq('project_id', projectId)
      .in('id', sourceIds ?? [])

    const result: NamedPackageWithSources = {
      ...pkg,
      sources: sources ?? [],
      categories: [],
      sourceCount: sources?.length ?? 0,
      lastAnalyzedAt: null,
    }

    return NextResponse.json({ package: result }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge-packages.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create knowledge package.' }, { status: 500 })
  }
}
