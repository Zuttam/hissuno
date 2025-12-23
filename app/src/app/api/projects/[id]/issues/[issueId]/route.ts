import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getIssueById, updateIssue, deleteIssue } from '@/lib/supabase/issues'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { UpdateIssueInput } from '@/types/issue'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string; issueId: string }>
}

/**
 * GET /api/projects/[id]/issues/[issueId]
 * Gets a specific issue with linked sessions.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[projects.issues.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { issueId } = await params

    const issue = await getIssueById(issueId)

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    return NextResponse.json({ issue })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.issues.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load issue.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/issues/[issueId]
 * Updates an issue.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[projects.issues.update] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { issueId } = await params
    const body = await request.json() as UpdateIssueInput

    const issue = await updateIssue(issueId, body)

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    return NextResponse.json({ issue })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.issues.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update issue.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/issues/[issueId]
 * Deletes an issue.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[projects.issues.delete] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { issueId } = await params

    const deleted = await deleteIssue(issueId)

    if (!deleted) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.issues.delete] unexpected error', error)
    return NextResponse.json({ error: 'Unable to delete issue.' }, { status: 500 })
  }
}
