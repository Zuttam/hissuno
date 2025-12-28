import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createGitHubCodebase, syncGitHubCodebase, deleteCodebase } from '@/lib/codebase'
import { hasGitHubIntegration } from '@/lib/integrations/github'
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'

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
 * PATCH /api/projects/[id]/source-code
 * Connect or replace a GitHub codebase for a project.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[source-code] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Parse request body
    const body = await request.json()
    const { repositoryUrl, repositoryBranch } = body

    if (!repositoryUrl || !repositoryBranch) {
      return NextResponse.json(
        { error: 'repositoryUrl and repositoryBranch are required.' },
        { status: 400 }
      )
    }

    // Check GitHub integration
    const hasIntegration = await hasGitHubIntegration(supabase, user.id)
    if (!hasIntegration) {
      return NextResponse.json(
        { error: 'GitHub integration not connected.' },
        { status: 400 }
      )
    }

    // Get the project with existing source code
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(*)')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !project) {
      console.error('[source-code] Failed to fetch project', projectId, fetchError)
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    const adminSupabase = createAdminClient()

    // If project has existing source code, clean up old data
    if (project.source_code_id && project.source_code) {
      console.log('[source-code] Cleaning up old codebase:', project.source_code_id)

      // Delete knowledge sources of type 'codebase' for this project
      const { error: ksDeleteError } = await adminSupabase
        .from('knowledge_sources')
        .delete()
        .eq('project_id', projectId)
        .eq('type', 'codebase')

      if (ksDeleteError) {
        console.error('[source-code] Failed to delete knowledge sources:', ksDeleteError)
        // Continue anyway - non-blocking
      }

      // Delete old source_code record (this also cleans up storage via the service)
      try {
        await deleteCodebase(supabase, project.source_code_id, user.id)
      } catch (deleteError) {
        console.error('[source-code] Failed to delete old codebase:', deleteError)
        // Continue anyway - we'll create a new one
      }

      // Unlink from project
      const { error: unlinkError } = await supabase
        .from('projects')
        .update({ source_code_id: null })
        .eq('id', projectId)

      if (unlinkError) {
        console.error('[source-code] Failed to unlink source code:', unlinkError)
      }
    }

    // Create new source_code record
    console.log('[source-code] Creating new GitHub codebase:', repositoryUrl, repositoryBranch)
    const { codebase } = await createGitHubCodebase({
      repositoryUrl,
      repositoryBranch,
      userId: user.id,
    })

    // Link to project
    const { error: linkError } = await supabase
      .from('projects')
      .update({ source_code_id: codebase.id })
      .eq('id', projectId)

    if (linkError) {
      console.error('[source-code] Failed to link source code:', linkError)
      return NextResponse.json({ error: 'Failed to link source code to project.' }, { status: 500 })
    }

    // Create knowledge source for the new codebase (before sync, so it shows up immediately)
    // Status is 'pending' - analysis is NOT triggered automatically
    const { error: ksCreateError } = await supabase
      .from('knowledge_sources')
      .insert({
        project_id: projectId,
        type: 'codebase',
        status: 'pending',
        enabled: true,
      })

    if (ksCreateError) {
      console.error('[source-code] Failed to create knowledge source:', ksCreateError)
      // Non-blocking - continue anyway
    } else {
      console.log('[source-code] Created codebase knowledge source for project:', projectId)
    }

    // Sync the codebase (download files from GitHub)
    console.log('[source-code] Syncing codebase:', codebase.id)
    const syncResult = await syncGitHubCodebase({
      codebaseId: codebase.id,
      userId: user.id,
      projectId,
    })

    if (syncResult.status === 'error') {
      console.error('[source-code] Sync failed:', syncResult.error)
      // Return partial success - codebase is linked but not synced
      return NextResponse.json({
        status: 'partial',
        error: syncResult.error,
        message: 'Codebase linked but sync failed. You can retry sync later.',
      }, { status: 200 })
    }

    // Fetch updated project
    const { data: updatedProject } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(*)')
      .eq('id', projectId)
      .single()

    return NextResponse.json({
      status: 'success',
      project: updatedProject || project,
      syncResult: {
        status: syncResult.status,
        commitSha: syncResult.commitSha,
        fileCount: syncResult.fileCount,
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[source-code] Unexpected error:', error)
    return NextResponse.json({ error: 'Failed to connect source code.' }, { status: 500 })
  }
}
