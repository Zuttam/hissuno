import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getGitHubInstallationToken, fetchRepoBranches } from '@/lib/integrations/github'

export const runtime = 'nodejs'

type RouteParams = { owner: string; repo: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/integrations/github/repos/[owner]/[repo]/branches?projectId=xxx
 * List branches for a specific repository
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { owner, repo } = await context.params

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo are required.' }, { status: 400 })
  }

  if (!isDatabaseConfigured()) {
    console.error('[integrations.github.branches.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireUserIdentity()

    await assertProjectAccess(identity, projectId)

    const result = await getGitHubInstallationToken(projectId)

    if (!result) {
      return NextResponse.json(
        { error: 'GitHub integration not connected. Please connect GitHub first.' },
        { status: 400 }
      )
    }

    const branches = await fetchRepoBranches(result.token, owner, repo)

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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.github.branches.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch branches.' }, { status: 500 })
  }
}
