import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getIssueById } from '@/lib/db/queries/issues'
import { updateIssue, deleteIssue } from '@/lib/issues/issues-service'
import { isDatabaseConfigured } from '@/lib/db/config'
import type { UpdateIssueInput } from '@/types/issue'

export const runtime = 'nodejs'

type RouteParams = { issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/issues/[issueId]?projectId=...
 * Gets a specific issue with linked feedback.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[issues.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const issue = await getIssueById(issueId)

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    // Verify the issue belongs to this project
    if (issue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    return NextResponse.json({ issue })
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

    console.error('[issues.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load issue.' }, { status: 500 })
  }
}

/**
 * PATCH /api/issues/[issueId]?projectId=...
 * Updates an issue.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[issues.update] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // First verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    const body = (await request.json()) as UpdateIssueInput

    const issue = await updateIssue(issueId, body)

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    return NextResponse.json({ issue })
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

    console.error('[issues.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update issue.' }, { status: 500 })
  }
}

/**
 * DELETE /api/issues/[issueId]?projectId=...
 * Deletes an issue.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[issues.delete] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // First verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    const deleted = await deleteIssue(issueId)

    if (!deleted) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

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

    console.error('[issues.delete] unexpected error', error)
    return NextResponse.json({ error: 'Unable to delete issue.' }, { status: 500 })
  }
}
