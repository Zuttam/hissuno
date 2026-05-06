import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { codebases } from '@/lib/db/schema/app'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { deleteCodebase, updateGitHubCodebase } from '@/lib/codebase'

export const runtime = 'nodejs'

type RouteParams = { codebaseId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/codebases/[codebaseId]?projectId=...
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { codebaseId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const [codebase] = await db
      .select()
      .from(codebases)
      .where(and(eq(codebases.id, codebaseId), eq(codebases.project_id, projectId)))
      .limit(1)

    if (!codebase) {
      return NextResponse.json({ error: 'Codebase not found.' }, { status: 404 })
    }

    return NextResponse.json({ codebase })
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

    console.error('[codebase.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load codebase.' }, { status: 500 })
  }
}

/**
 * PATCH /api/codebases/[codebaseId]?projectId=...
 * Body: { repository_url?, repository_branch?, name?, description?, enabled?, analysis_scope? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { codebaseId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const payload = await request.json().catch(() => null)
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (payload.name !== undefined) updates.name = payload.name || null
    if (payload.description !== undefined) updates.description = payload.description || null
    if (typeof payload.enabled === 'boolean') updates.enabled = payload.enabled
    if (typeof payload.analysis_scope === 'string') {
      updates.analysis_scope = payload.analysis_scope.trim() || null
    }
    const wantsRepoChange = Boolean(payload.repository_url || payload.repository_branch)

    if (Object.keys(updates).length === 0 && !wantsRepoChange) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    const [codebase] = await db
      .select()
      .from(codebases)
      .where(and(eq(codebases.id, codebaseId), eq(codebases.project_id, projectId)))
      .limit(1)

    if (!codebase) {
      return NextResponse.json({ error: 'Codebase not found.' }, { status: 404 })
    }

    if (codebase.kind === 'github' && wantsRepoChange) {
      await updateGitHubCodebase(
        codebase.id,
        {
          repositoryUrl: payload.repository_url,
          repositoryBranch: payload.repository_branch,
        },
        projectId,
      )
    }

    if (Object.keys(updates).length > 0) {
      await db.update(codebases).set(updates).where(eq(codebases.id, codebaseId))
    }

    const [updated] = await db
      .select()
      .from(codebases)
      .where(eq(codebases.id, codebaseId))
      .limit(1)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update codebase.' }, { status: 500 })
    }

    return NextResponse.json({ codebase: updated })
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

    console.error('[codebase.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update codebase.' }, { status: 500 })
  }
}

/**
 * DELETE /api/codebases/[codebaseId]?projectId=...
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { codebaseId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const [codebase] = await db
      .select()
      .from(codebases)
      .where(and(eq(codebases.id, codebaseId), eq(codebases.project_id, projectId)))
      .limit(1)

    if (!codebase) {
      return NextResponse.json({ error: 'Codebase not found.' }, { status: 404 })
    }

    await deleteCodebase(codebaseId, projectId)
    return NextResponse.json({ success: true })
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

    console.error('[codebase.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete codebase.' }, { status: 500 })
  }
}
