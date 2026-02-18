import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { hasGitHubInstallation, disconnectGitHub } from '@/lib/integrations/github'

export const runtime = 'nodejs'

async function resolveUserAndProject(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  // Verify user has access to this project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    throw new Error('Project not found')
  }

  const hasAccess = await hasProjectAccess(projectId, user.id)
  if (!hasAccess) {
    throw new UnauthorizedError('Not authorized to access this project')
  }

  return { supabase, user, project }
}

/**
 * GET /api/integrations/github?projectId=xxx
 * Check if project has GitHub integration connected
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const { supabase } = await resolveUserAndProject(projectId)
    const status = await hasGitHubInstallation(supabase, projectId)

    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.error('[integrations.github.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to check integration status.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/github?projectId=xxx
 * Disconnect GitHub integration from project
 */
export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.delete] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const { supabase } = await resolveUserAndProject(projectId)
    const result = await disconnectGitHub(supabase, projectId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.error('[integrations.github.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect GitHub.' }, { status: 500 })
  }
}
