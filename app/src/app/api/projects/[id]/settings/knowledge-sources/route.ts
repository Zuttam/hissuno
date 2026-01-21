import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { uploadDocument } from '@/lib/knowledge/storage'
import { createGitHubCodebase, syncGitHubCodebase, deleteCodebase, updateGitHubCodebase } from '@/lib/codebase'
import { hasGitHubInstallation } from '@/lib/integrations/github'
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
 * Helper to create or replace a codebase knowledge source
 */
async function handleCodebaseCreate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  params: {
    repositoryUrl?: string
    repositoryBranch?: string
    analysisScope?: string
  }
) {
  const { repositoryUrl, repositoryBranch, analysisScope } = params

  // 1. Validate required fields
  if (!repositoryUrl || !repositoryBranch) {
    return NextResponse.json(
      { error: 'repositoryUrl and repositoryBranch are required for codebase type.' },
      { status: 400 }
    )
  }

  // 2. Check GitHub integration is connected
  const githubStatus = await hasGitHubInstallation(supabase, projectId)
  if (!githubStatus.connected) {
    return NextResponse.json(
      { error: 'GitHub integration not connected for this project.' },
      { status: 400 }
    )
  }

  // 3. Check for existing codebase (only one allowed per project)
  const { data: existing } = await supabase
    .from('knowledge_sources')
    .select('*, source_code:source_codes(*)')
    .eq('project_id', projectId)
    .eq('type', 'codebase')
    .single()

  // 4. If exists, delete old source_codes record
  if (existing?.source_code_id) {
    console.log('[knowledge-sources.post] Replacing existing codebase:', existing.source_code_id)
    try {
      await deleteCodebase(supabase, existing.source_code_id, userId)
    } catch (deleteError) {
      console.error('[knowledge-sources.post] Failed to delete old codebase:', deleteError)
      // Continue anyway - we'll create a new one
    }
  }

  // 5. Create new source_codes record
  console.log('[knowledge-sources.post] Creating new GitHub codebase:', repositoryUrl, repositoryBranch)
  const { codebase } = await createGitHubCodebase({
    repositoryUrl,
    repositoryBranch,
    userId,
  })

  let source

  // 6. Create or update knowledge_source
  if (existing) {
    // Update existing knowledge_source with new source_code_id
    const { data: updated, error: updateError } = await supabase
      .from('knowledge_sources')
      .update({
        source_code_id: codebase.id,
        analysis_scope: analysisScope?.trim() || null,
        status: 'pending',
        error_message: null,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      console.error('[knowledge-sources.post] Failed to update knowledge source:', updateError)
      return NextResponse.json({ error: 'Failed to update codebase source.' }, { status: 500 })
    }
    source = updated
  } else {
    // Insert new knowledge_source
    const { data: inserted, error: insertError } = await supabase
      .from('knowledge_sources')
      .insert({
        project_id: projectId,
        type: 'codebase',
        source_code_id: codebase.id,
        analysis_scope: analysisScope?.trim() || null,
        status: 'pending',
        enabled: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[knowledge-sources.post] Failed to create knowledge source:', insertError)
      return NextResponse.json({ error: 'Failed to create codebase source.' }, { status: 500 })
    }
    source = inserted
  }

  // 7. Sync codebase (best-effort, don't fail if sync fails)
  console.log('[knowledge-sources.post] Syncing codebase:', codebase.id)
  const syncResult = await syncGitHubCodebase({
    codebaseId: codebase.id,
    userId,
    projectId,
  })

  if (syncResult.status === 'error') {
    console.warn('[knowledge-sources.post] Sync failed but codebase is linked:', syncResult.error)
  } else {
    console.log('[knowledge-sources.post] Sync completed:', syncResult.status, syncResult.commitSha)
  }

  return NextResponse.json({
    source,
    syncResult: {
      status: syncResult.status,
      commitSha: syncResult.commitSha,
      localPath: syncResult.localPath,
    },
  }, { status: existing ? 200 : 201 })
}

/**
 * GET /api/projects/[id]/settings/knowledge-sources
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
      .select('*, source_code:source_codes(*)')
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
 * POST /api/projects/[id]/settings/knowledge-sources
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

      const { type, url, content, repositoryUrl, repositoryBranch, analysis_scope } = payload

      // Special handling for codebase type
      if (type === 'codebase') {
        return handleCodebaseCreate(supabase, user.id, projectId, {
          repositoryUrl,
          repositoryBranch,
          analysisScope: analysis_scope,
        })
      }

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
 * DELETE /api/projects/[id]/settings/knowledge-sources
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
        { error: 'Codebase sources cannot be deleted directly.' },
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
 * PATCH /api/projects/[id]/settings/knowledge-sources
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

    // Only allow enabled updates for non-codebase sources
    if (typeof payload.enabled === 'boolean' && source.type !== 'codebase') {
      updates.enabled = payload.enabled
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
            supabase,
            source.source_code_id,
            user.id,
            {
              repositoryUrl: payload.repositoryUrl,
              repositoryBranch: payload.repositoryBranch,
            }
          )
          console.log('[knowledge-sources.patch] Updated codebase:', source.source_code_id)
        } catch (updateError) {
          console.error('[knowledge-sources.patch] Failed to update codebase:', updateError)
          return NextResponse.json({ error: 'Failed to update codebase.' }, { status: 500 })
        }
      }
    }

    // Check if anything is being updated
    if (Object.keys(updates).length === 0 && !updatedSourceCode) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    // Update knowledge_source if there are field updates
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('knowledge_sources')
        .update(updates)
        .eq('id', sourceId)
        .eq('project_id', projectId)

      if (updateError) {
        console.error('[knowledge-sources.patch] failed to update source', updateError)
        return NextResponse.json({ error: 'Failed to update knowledge source.' }, { status: 500 })
      }
    }

    // Fetch and return updated source with source_code if codebase
    const selectQuery = source.type === 'codebase'
      ? '*, source_code:source_codes(*)'
      : '*'

    const { data: updatedSource, error: refetchError } = await supabase
      .from('knowledge_sources')
      .select(selectQuery)
      .eq('id', sourceId)
      .eq('project_id', projectId)
      .single()

    if (refetchError) {
      console.error('[knowledge-sources.patch] failed to fetch updated source', refetchError)
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
