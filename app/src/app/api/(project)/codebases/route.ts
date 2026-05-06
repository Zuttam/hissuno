import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { codebases } from '@/lib/db/schema/app'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { createGitHubCodebase, syncGitHubCodebase } from '@/lib/codebase'
import { hasGitHubInstallation } from '@/lib/integrations/github'

export const runtime = 'nodejs'

async function loadCodebases(projectId: string) {
  return db
    .select()
    .from(codebases)
    .where(eq(codebases.project_id, projectId))
    .orderBy(desc(codebases.created_at))
}

/**
 * GET /api/codebases?projectId=...
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const codebaseList = await loadCodebases(projectId)
    return NextResponse.json({ codebases: codebaseList })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[codebases.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load codebases.' }, { status: 500 })
  }
}

/**
 * POST /api/codebases?projectId=...
 * Body: { repository_url, repository_branch, name?, description?, analysis_scope? }
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    const payload = await request.json().catch(() => null)
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    const { repository_url, repository_branch, name, description, analysis_scope } = payload as {
      repository_url?: string
      repository_branch?: string
      name?: string | null
      description?: string | null
      analysis_scope?: string | null
    }

    if (!repository_url || !repository_branch) {
      return NextResponse.json(
        { error: 'repository_url and repository_branch are required.' },
        { status: 400 },
      )
    }

    const githubStatus = await hasGitHubInstallation(projectId)
    if (!githubStatus.connected) {
      return NextResponse.json(
        { error: 'GitHub integration not connected for this project.' },
        { status: 400 },
      )
    }

    const { codebase } = await createGitHubCodebase({
      projectId,
      repositoryUrl: repository_url,
      repositoryBranch: repository_branch,
      userId: actingUserId,
      name: name ?? null,
      description: description ?? null,
      analysisScope: analysis_scope ?? null,
    })

    void syncGitHubCodebase({ codebaseId: codebase.id, projectId }).catch((err) =>
      console.warn('[codebases.post] background sync failed:', err),
    )

    return NextResponse.json({ codebase }, { status: 201 })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[codebases.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create codebase.' }, { status: 500 })
  }
}
