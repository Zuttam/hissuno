import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { uploadDocument } from '@/lib/knowledge/storage'
import type { KnowledgeSourceType, KnowledgeSourceInsert } from '@/lib/knowledge/types'

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

const VALID_SOURCE_TYPES: KnowledgeSourceType[] = [
  'codebase',
  'website',
  'docs_portal',
  'uploaded_doc',
  'raw_text',
]

/** Source types that users can manually add */
const USER_ADDABLE_TYPES: KnowledgeSourceType[] = [
  'website',
  'docs_portal',
  'uploaded_doc',
  'raw_text',
]

function isValidSourceType(type: string): type is KnowledgeSourceType {
  return VALID_SOURCE_TYPES.includes(type as KnowledgeSourceType)
}

function isUserAddableType(type: string): type is KnowledgeSourceType {
  return USER_ADDABLE_TYPES.includes(type as KnowledgeSourceType)
}

/**
 * GET /api/projects/[id]/knowledge-sources
 * List all knowledge sources for a project
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-sources.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    const { data, error } = await supabase
      .from('knowledge_sources')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[knowledge-sources.get] failed to load sources', projectId, error)
      return NextResponse.json({ error: 'Failed to load knowledge sources.' }, { status: 500 })
    }

    return NextResponse.json({ sources: data ?? [] })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge-sources.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load knowledge sources.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/knowledge-sources
 * Add a new knowledge source to a project
 * 
 * Supports both JSON and FormData:
 * - JSON: { type, url?, content? }
 * - FormData: type, url?, content?, file? (for uploaded_doc)
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-sources.post] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    const contentType = request.headers.get('content-type') ?? ''
    let sourceData: KnowledgeSourceInsert

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (for file uploads)
      const formData = await request.formData()
      const type = formData.get('type')?.toString()
      const url = formData.get('url')?.toString()
      const content = formData.get('content')?.toString()
      const file = formData.get('file') as File | null

      if (!type || !isUserAddableType(type)) {
        return NextResponse.json({ error: 'Invalid or missing source type.' }, { status: 400 })
      }

      sourceData = {
        project_id: projectId,
        type,
        url: url || null,
        content: content || null,
        storage_path: null,
        status: 'pending',
        enabled: true,
      }

      // Handle file upload for uploaded_doc type
      if (type === 'uploaded_doc') {
        if (!file) {
          return NextResponse.json({ error: 'File is required for uploaded_doc type.' }, { status: 400 })
        }

        const { path, error: uploadError } = await uploadDocument(projectId, file, supabase)
        if (uploadError) {
          console.error('[knowledge-sources.post] failed to upload document', uploadError)
          return NextResponse.json({ error: 'Failed to upload document.' }, { status: 500 })
        }

        sourceData.storage_path = path
      }
    } else {
      // Handle JSON
      const payload = await request.json().catch(() => null)

      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
      }

      const { type, url, content } = payload

      if (!type || !isUserAddableType(type)) {
        return NextResponse.json({ error: 'Invalid or missing source type.' }, { status: 400 })
      }

      // Validate required fields based on type
      if ((type === 'website' || type === 'docs_portal') && !url) {
        return NextResponse.json({ error: 'URL is required for website/docs_portal sources.' }, { status: 400 })
      }

      if (type === 'raw_text' && !content) {
        return NextResponse.json({ error: 'Content is required for raw_text sources.' }, { status: 400 })
      }

      sourceData = {
        project_id: projectId,
        type,
        url: url || null,
        content: content || null,
        storage_path: null,
        status: 'pending',
        enabled: true,
      }
    }

    const { data, error } = await supabase
      .from('knowledge_sources')
      .insert(sourceData)
      .select()
      .single()

    if (error) {
      console.error('[knowledge-sources.post] failed to create source', error)
      return NextResponse.json({ error: 'Failed to create knowledge source.' }, { status: 500 })
    }

    return NextResponse.json({ source: data }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge-sources.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create knowledge source.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/knowledge-sources
 * Delete a knowledge source (requires sourceId in query params)
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params
  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get('sourceId')

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId query parameter is required.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-sources.delete] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // First fetch the source to get storage_path for cleanup
    const { data: source, error: fetchError } = await supabase
      .from('knowledge_sources')
      .select('*')
      .eq('id', sourceId)
      .eq('project_id', projectId)
      .single()

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    }

    // Prevent deletion of codebase sources
    if (source.type === 'codebase') {
      return NextResponse.json(
        { error: 'Codebase sources cannot be deleted. Use the toggle to disable instead.' },
        { status: 403 }
      )
    }

    // Delete from storage if it's an uploaded doc
    if (source.storage_path && source.type === 'uploaded_doc') {
      const { deleteDocument } = await import('@/lib/knowledge/storage')
      await deleteDocument(source.storage_path, supabase)
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from('knowledge_sources')
      .delete()
      .eq('id', sourceId)
      .eq('project_id', projectId)

    if (deleteError) {
      console.error('[knowledge-sources.delete] failed to delete source', deleteError)
      return NextResponse.json({ error: 'Failed to delete knowledge source.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge-sources.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete knowledge source.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/knowledge-sources
 * Update a knowledge source (enable/disable, update analysis_scope)
 * Requires sourceId in query params
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params
  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get('sourceId')

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId query parameter is required.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    console.error('[knowledge-sources.patch] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    const payload = await request.json().catch(() => null)

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    // First fetch the source to verify it exists and belongs to this project
    const { data: source, error: fetchError } = await supabase
      .from('knowledge_sources')
      .select('*')
      .eq('id', sourceId)
      .eq('project_id', projectId)
      .single()

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Knowledge source not found.' }, { status: 404 })
    }

    // Build update object with only allowed fields
    const updates: Record<string, unknown> = {}

    if (typeof payload.enabled === 'boolean') {
      updates.enabled = payload.enabled
    }

    // Only allow analysis_scope updates for codebase sources
    if (source.type === 'codebase' && typeof payload.analysis_scope === 'string') {
      updates.analysis_scope = payload.analysis_scope.trim() || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    const { data: updatedSource, error: updateError } = await supabase
      .from('knowledge_sources')
      .update(updates)
      .eq('id', sourceId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (updateError) {
      console.error('[knowledge-sources.patch] failed to update source', updateError)
      return NextResponse.json({ error: 'Failed to update knowledge source.' }, { status: 500 })
    }

    return NextResponse.json({ source: updatedSource })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[knowledge-sources.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update knowledge source.' }, { status: 500 })
  }
}
