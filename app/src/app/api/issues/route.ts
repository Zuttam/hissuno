import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { listIssues, createManualIssue } from '@/lib/supabase/issues'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { IssueType, IssuePriority, IssueStatus, CreateIssueInput } from '@/types/issue'

export const runtime = 'nodejs'

/**
 * GET /api/issues
 * Lists issues across all projects owned by the current user.
 * Supports filtering by project, type, priority, status, and search.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[issues.list] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      projectId: searchParams.get('projectId') ?? undefined,
      type: (searchParams.get('type') as IssueType) ?? undefined,
      priority: (searchParams.get('priority') as IssuePriority) ?? undefined,
      status: (searchParams.get('status') as IssueStatus) ?? undefined,
      search: searchParams.get('search') ?? undefined,
      showArchived: searchParams.get('showArchived') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const issues = await listIssues(filters)

    return NextResponse.json({ issues })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[issues.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load issues.' }, { status: 500 })
  }
}

/**
 * POST /api/issues
 * Creates a new manual issue.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[issues.post] Supabase must be configured to create issues')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()

    // Parse and validate session_ids
    let sessionIds: string[] | undefined
    if (body.session_ids && Array.isArray(body.session_ids)) {
      sessionIds = body.session_ids.filter((id: unknown) => typeof id === 'string' && id.trim())
    }

    const input: CreateIssueInput = {
      project_id: body.project_id,
      session_ids: sessionIds,
      type: body.type,
      title: body.title,
      description: body.description,
      priority: body.priority || undefined,
    }

    if (!input.project_id) {
      return NextResponse.json({ error: 'project_id is required.' }, { status: 400 })
    }
    if (!input.type) {
      return NextResponse.json({ error: 'type is required.' }, { status: 400 })
    }
    if (!input.title) {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 })
    }
    if (!input.description) {
      return NextResponse.json({ error: 'description is required.' }, { status: 400 })
    }

    const issue = await createManualIssue(input)

    return NextResponse.json({ issue }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[issues.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create issue.' }, { status: 500 })
  }
}
