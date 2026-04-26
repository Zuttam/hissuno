import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { codebases } from '@/lib/db/schema/app'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { syncGitHubCodebase } from '@/lib/codebase'

export const runtime = 'nodejs'

type RouteParams = { codebaseId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * POST /api/codebases/[codebaseId]/sync?projectId=...
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { codebaseId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const [codebase] = await db
      .select({ id: codebases.id })
      .from(codebases)
      .where(and(eq(codebases.id, codebaseId), eq(codebases.project_id, projectId)))
      .limit(1)

    if (!codebase) {
      return NextResponse.json({ error: 'Codebase not found.' }, { status: 404 })
    }

    const result = await syncGitHubCodebase({ codebaseId, projectId })
    return NextResponse.json({ result })
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

    console.error('[codebase.sync] unexpected error', error)
    return NextResponse.json({ error: 'Failed to sync codebase.' }, { status: 500 })
  }
}
