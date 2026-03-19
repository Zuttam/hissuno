import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getIssueById } from '@/lib/db/queries/issues'
import { updateIssueArchiveStatus } from '@/lib/issues/issues-service'
import { isDatabaseConfigured } from '@/lib/db/config'

export const runtime = 'nodejs'

type RouteParams = { issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * PATCH /api/issues/[issueId]/archive?projectId=...
 * Toggles the archive status of an issue.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { issueId } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[issues.archive] Database must be configured')
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

    const body = await request.json()
    const isArchived = body.is_archived

    if (typeof isArchived !== 'boolean') {
      return NextResponse.json({ error: 'is_archived (boolean) is required.' }, { status: 400 })
    }

    const issue = await updateIssueArchiveStatus(issueId, isArchived)

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

    console.error('[issues.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update issue.' }, { status: 500 })
  }
}
