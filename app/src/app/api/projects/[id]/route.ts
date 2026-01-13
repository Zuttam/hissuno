import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { updateGitHubCodebase, cleanupRepository } from '@/lib/codebase'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

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

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[projects.id.get] Supabase must be configured to load project', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
      }

      console.error('[projects.id.get] failed to load project', id, error)
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    return NextResponse.json({ project: data })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.id.get] unexpected error', error)
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const projectUpdates: Record<string, unknown> = {}
  const sourceCodeUpdates: { 
    repositoryUrl?: string
    repositoryBranch?: string
  } = {}

  if (typeof payload.name === 'string') {
    const trimmed = payload.name.trim()
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
    }
    projectUpdates.name = trimmed
  }
  if (typeof payload.description === 'string') {
    const trimmed = payload.description.trim()
    projectUpdates.description = trimmed.length > 0 ? trimmed : null
  }

  // Note: allowed_origins and widget_token_required are now in project_settings
  // Use PATCH /api/projects/[id]/settings to update them

  // Handle source code updates (for GitHub repos)
  if (typeof payload.repositoryUrl === 'string') {
    sourceCodeUpdates.repositoryUrl = payload.repositoryUrl.trim()
  }
  if (typeof payload.repositoryBranch === 'string') {
    sourceCodeUpdates.repositoryBranch = payload.repositoryBranch.trim()
  }
  // Note: analysis_scope is now managed via knowledge_sources table, not source_codes

  const hasProjectUpdates = Object.keys(projectUpdates).length > 0
  const hasSourceCodeUpdates = Object.keys(sourceCodeUpdates).length > 0

  if (!hasProjectUpdates && !hasSourceCodeUpdates) {
    return NextResponse.json({ error: 'No supported fields provided.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    console.error('[projects.id.patch] Supabase must be configured to update project', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, id)

    // Get the current project
    const { data: currentProject, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentProject) {
      console.error('[projects.id.patch] failed to fetch project', id, fetchError)
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    // Update source code if needed - get source_code through codebase knowledge_source
    if (hasSourceCodeUpdates) {
      const { data: codebaseSource } = await supabase
        .from('knowledge_sources')
        .select('*, source_code:source_codes(*)')
        .eq('project_id', id)
        .eq('type', 'codebase')
        .single()

      const sourceCode = codebaseSource?.source_code
      if (sourceCode) {
        const { repositoryUrl, repositoryBranch } = sourceCodeUpdates

        // GitHub-specific updates (url and branch)
        if ((repositoryUrl || repositoryBranch) && sourceCode.kind === 'github') {
          await updateGitHubCodebase(
            supabase,
            sourceCode.id,
            user.id,
            { repositoryUrl, repositoryBranch }
          )
        }
      }
    }

    // Update project if needed
    if (hasProjectUpdates) {
      const { error: updateError } = await supabase
        .from('projects')
        .update(projectUpdates)
        .eq('id', id)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('[projects.id.patch] failed to update project', id, updateError)
        return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 })
      }
    }

    // Fetch the updated project
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('[projects.id.patch] failed to fetch updated project', id, error)
      return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 })
    }

    return NextResponse.json({ project: data })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.id.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[projects.id.delete] Supabase must be configured to delete project', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, id)

    // Get the codebase knowledge_source with source_code to clean up storage
    const { data: codebaseSource } = await supabase
      .from('knowledge_sources')
      .select('*, source_code:source_codes(*)')
      .eq('project_id', id)
      .eq('type', 'codebase')
      .single()

    const sourceCode = codebaseSource?.source_code

    // Delete the project (cascades to knowledge_sources, source_codes due to FK constraints)
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[projects.id.delete] failed to delete project', id, deleteError)
      return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 })
    }

    // Clean up local clone if exists (best-effort)
    if (sourceCode?.repository_branch) {
      await cleanupRepository(id, sourceCode.repository_branch).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.id.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 })
  }
}
