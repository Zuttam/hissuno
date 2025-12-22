import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { syncGitHubCodebase } from '@/lib/codebase'
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

/**
 * POST /api/projects/[id]/source-code/sync
 * Manually sync a GitHub codebase by downloading the latest version from the repository.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[source-code.sync] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Get the project with source code
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(*)')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !project) {
      console.error('[source-code.sync] failed to fetch project', projectId, fetchError)
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    if (!project.source_code) {
      return NextResponse.json({ error: 'Project has no source code.' }, { status: 400 })
    }

    if (project.source_code.kind !== 'github') {
      return NextResponse.json({ 
        error: 'Only GitHub source codes can be synced.' 
      }, { status: 400 })
    }

    // Perform the sync
    const result = await syncGitHubCodebase({
      codebaseId: project.source_code.id,
      userId: user.id,
      projectId,
    })

    if (result.status === 'error') {
      console.error('[source-code.sync] sync failed', projectId, result.error)
      return NextResponse.json({ 
        error: result.error || 'Failed to sync codebase.' 
      }, { status: 500 })
    }

    // Fetch updated project to return fresh data
    const { data: updatedProject, error: refetchError } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(*)')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (refetchError) {
      console.error('[source-code.sync] failed to refetch project', projectId, refetchError)
    }

    return NextResponse.json({
      status: result.status,
      commitSha: result.commitSha,
      fileCount: result.fileCount,
      project: updatedProject || project,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[source-code.sync] unexpected error', error)
    return NextResponse.json({ error: 'Failed to sync codebase.' }, { status: 500 })
  }
}
