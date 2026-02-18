import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { downloadKnowledgePackage, uploadKnowledgePackage } from '@/lib/knowledge/storage'
import type { KnowledgeCategory, KnowledgePackageContent } from '@/lib/knowledge/types'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/knowledge
 * Get all compiled knowledge packages for a project
 *
 * Query params:
 * - category?: 'business' | 'product' | 'technical' - filter by category
 * - includeContent?: 'true' - include the markdown content in response
 */
export async function GET(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params
  const { searchParams } = new URL(request.url)
  const categoryFilter = searchParams.get('category') as KnowledgeCategory | null
  const includeContent = searchParams.get('includeContent') === 'true'

  if (!isSupabaseConfigured()) {
    console.error('[knowledge.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    let query = supabase
      .from('knowledge_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('category', { ascending: true })

    if (categoryFilter) {
      query = query.eq('category', categoryFilter)
    }

    const { data: packages, error } = await query

    if (error) {
      console.error('[knowledge.get] failed to load packages', projectId, error)
      return NextResponse.json({ error: 'Failed to load knowledge packages.' }, { status: 500 })
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json({ packages: [], hasKnowledge: false })
    }

    // Optionally include content
    if (includeContent) {
      const packagesWithContent: KnowledgePackageContent[] = await Promise.all(
        packages.map(async (pkg) => {
          const { content } = await downloadKnowledgePackage(pkg.storage_path, supabase)
          return {
            category: pkg.category as KnowledgeCategory,
            content: content ?? '',
            version: pkg.version,
            generatedAt: pkg.generated_at,
          }
        })
      )

      return NextResponse.json({ packages: packagesWithContent, hasKnowledge: true })
    }

    return NextResponse.json({ packages, hasKnowledge: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[knowledge.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load knowledge packages.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/knowledge
 * Update a knowledge package content (creates a new version)
 *
 * Body:
 * - category: 'business' | 'product' | 'technical' - the category to update
 * - content: string - the new markdown content
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge.patch] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    const body = await request.json()
    const { category, content } = body as { category: KnowledgeCategory; content: string }

    if (!category || !['business', 'product', 'technical', 'faq', 'how_to'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
    }

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
    }

    // Get current version
    const { data: existing, error: fetchError } = await supabase
      .from('knowledge_packages')
      .select('version')
      .eq('project_id', projectId)
      .eq('category', category)
      .single()

    if (fetchError || !existing) {
      console.error('[knowledge.patch] failed to get existing package', projectId, category, fetchError)
      return NextResponse.json({ error: 'Knowledge package not found.' }, { status: 404 })
    }

    const newVersion = existing.version + 1

    // Upload new content to storage (uses admin client for storage operations)
    const { path: storagePath, error: uploadError } = await uploadKnowledgePackage(
      projectId,
      category,
      content,
      newVersion
    )

    if (uploadError) {
      console.error('[knowledge.patch] failed to upload content', projectId, category, uploadError)
      return NextResponse.json({ error: 'Failed to save content.' }, { status: 500 })
    }

    // Update database record with new version
    const { error: updateError } = await supabase
      .from('knowledge_packages')
      .update({
        storage_path: storagePath,
        version: newVersion,
        generated_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('category', category)

    if (updateError) {
      console.error('[knowledge.patch] failed to update record', projectId, category, updateError)
      return NextResponse.json({ error: 'Failed to update knowledge package.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, version: newVersion })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[knowledge.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update knowledge package.' }, { status: 500 })
  }
}
