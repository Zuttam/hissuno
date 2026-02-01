import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { downloadKnowledgePackage, uploadKnowledgePackage } from '@/lib/knowledge/storage'
import type { KnowledgeCategory } from '@/lib/knowledge/types'

export const runtime = 'nodejs'

type RouteParams = { id: string; packageId: string; category: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const VALID_CATEGORIES: KnowledgeCategory[] = ['business', 'product', 'technical', 'faq', 'how_to']

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
 * GET /api/projects/[id]/knowledge/packages/[packageId]/content/[category]
 * Get content for a specific category in a named package
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId, packageId, category } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category as KnowledgeCategory)) {
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Verify package exists and belongs to project
    const { data: pkg, error: pkgError } = await supabase
      .from('named_knowledge_packages')
      .select('id')
      .eq('id', packageId)
      .eq('project_id', projectId)
      .single()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    // Find the category record
    const { data: categoryRecord, error: catError } = await supabase
      .from('knowledge_packages')
      .select('*')
      .eq('named_package_id', packageId)
      .eq('category', category)
      .single()

    if (catError || !categoryRecord) {
      return NextResponse.json({
        content: null,
        category,
        message: 'No content for this category.',
      })
    }

    // Download content from storage
    const { content, error: downloadError } = await downloadKnowledgePackage(
      categoryRecord.storage_path,
      supabase
    )

    if (downloadError || !content) {
      console.error('[knowledge-content.get] Failed to download content:', downloadError)
      return NextResponse.json({ error: 'Failed to load content.' }, { status: 500 })
    }

    return NextResponse.json({
      content,
      category,
      version: categoryRecord.version,
      generatedAt: categoryRecord.generated_at,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge-content.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load content.' }, { status: 500 })
  }
}

/**
 * PUT /api/projects/[id]/knowledge/packages/[packageId]/content/[category]
 * Update content for a specific category in a named package
 *
 * Body:
 * - content: string (markdown content)
 */
export async function PUT(request: Request, context: RouteContext) {
  const { id: projectId, packageId, category } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category as KnowledgeCategory)) {
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Verify package exists and belongs to project
    const { data: pkg, error: pkgError } = await supabase
      .from('named_knowledge_packages')
      .select('id')
      .eq('id', packageId)
      .eq('project_id', projectId)
      .single()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    const body = await request.json()
    const { content } = body as { content: string }

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
    }

    // Find existing category record
    const { data: existingCategory } = await supabase
      .from('knowledge_packages')
      .select('*')
      .eq('named_package_id', packageId)
      .eq('category', category)
      .single()

    const newVersion = existingCategory ? existingCategory.version + 1 : 1

    // Upload new content to storage
    const { path: storagePath, error: uploadError } = await uploadKnowledgePackage(
      projectId,
      category as KnowledgeCategory,
      content,
      newVersion
    )

    if (uploadError) {
      console.error('[knowledge-content.put] Failed to upload content:', uploadError)
      return NextResponse.json({ error: 'Failed to save content.' }, { status: 500 })
    }

    // Upsert the knowledge package record
    if (existingCategory) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('knowledge_packages')
        .update({
          storage_path: storagePath,
          version: newVersion,
          generated_at: new Date().toISOString(),
        })
        .eq('id', existingCategory.id)

      if (updateError) {
        console.error('[knowledge-content.put] Failed to update record:', updateError)
        return NextResponse.json({ error: 'Failed to save content.' }, { status: 500 })
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase.from('knowledge_packages').insert({
        project_id: projectId,
        named_package_id: packageId,
        category: category as KnowledgeCategory,
        storage_path: storagePath,
        version: newVersion,
        generated_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error('[knowledge-content.put] Failed to insert record:', insertError)
        return NextResponse.json({ error: 'Failed to save content.' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      category,
      version: newVersion,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge-content.put] unexpected error', error)
    return NextResponse.json({ error: 'Failed to save content.' }, { status: 500 })
  }
}
