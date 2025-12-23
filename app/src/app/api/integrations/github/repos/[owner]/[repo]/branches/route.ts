import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getGitHubToken, fetchRepoBranches } from '@/lib/integrations/github'

export const runtime = 'nodejs'

type RouteParams = { owner: string; repo: string }
type RouteContext = { params: Promise<RouteParams> }

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
 * GET /api/integrations/github/repos/[owner]/[repo]/branches
 * List branches for a specific repository
 */
export async function GET(_request: Request, context: RouteContext) {
  const { owner, repo } = await context.params

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo are required.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    console.error('[integrations.github.branches.get] Supabase must be configured')
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

    const branches = await fetchRepoBranches(token, owner, repo)

    // Transform to a simpler format for the frontend
    const simplifiedBranches = branches.map((branch) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
    }))

    return NextResponse.json({ branches: simplifiedBranches })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[integrations.github.branches.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch branches.' }, { status: 500 })
  }
}
