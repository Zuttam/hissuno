import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { getGitHubInstallationToken } from '@/lib/integrations/github'
import { listInstallationRepos } from '@/lib/integrations/github/app-client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/repos?projectId=xxx
 * List repositories accessible by project's GitHub token
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.repos.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

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
      throw new UnauthorizedError('Not authorized to access this project')
    }

    const hasAccess = await hasProjectAccess(projectId, user.id)
    if (!hasAccess) {
      throw new UnauthorizedError('Not authorized to access this project')
    }

    const token = await getGitHubInstallationToken(supabase, projectId)

    if (!token) {
      return NextResponse.json(
        { error: 'GitHub integration not connected. Please connect GitHub first.' },
        { status: 400 }
      )
    }

    const repos = await listInstallationRepos(token)

    // Transform to a simpler format for the frontend
    const simplifiedRepos = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      description: repo.description,
      updatedAt: repo.updated_at,
    }))

    return NextResponse.json({ repos: simplifiedRepos })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[integrations.github.repos.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch repositories.' }, { status: 500 })
  }
}
