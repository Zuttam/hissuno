import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { getIssueById } from '@/lib/supabase/issues'
import { updateIssueArchiveStatus } from '@/lib/issues/issues-service'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

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
 * PATCH /api/projects/[id]/issues/[issueId]/archive
 * Toggles the archive status of an issue.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[issues.archive] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

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
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[issues.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update issue.' }, { status: 500 })
  }
}
