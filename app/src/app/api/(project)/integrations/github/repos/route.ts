import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getGitHubInstallationToken } from '@/lib/integrations/github'
import { listInstallationRepos, listUserRepos } from '@/lib/integrations/github/app-client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/repos?projectId=xxx
 * List repositories accessible by project's GitHub token
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.github.repos.get] Database must be configured')
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

    const repos = result.authMethod === 'pat'
      ? await listUserRepos(result.token)
      : await listInstallationRepos(result.token)

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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.github.repos.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch repositories.' }, { status: 500 })
  }
}
