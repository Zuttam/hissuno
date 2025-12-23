import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getGitHubToken, fetchUserRepos } from '@/lib/integrations/github'

export const runtime = 'nodejs'

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
 * GET /api/integrations/github/repos
 * List user's GitHub repositories
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.repos.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    const token = await getGitHubToken(supabase, user.id)

    if (!token) {
      return NextResponse.json(
        { error: 'GitHub integration not connected. Please connect GitHub first.' },
        { status: 400 }
      )
    }

    const repos = await fetchUserRepos(token)

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
