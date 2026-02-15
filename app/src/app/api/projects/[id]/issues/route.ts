import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { listIssues } from '@/lib/supabase/issues'
import { createIssue } from '@/lib/issues/issues-service'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { IssueType, IssuePriority, IssueStatus, MetricLevel, CreateIssueInput } from '@/types/issue'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/issues
 * Lists issues for a specific project.
 * Supports filtering by type, priority, status, and search.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[issues.list] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { searchParams } = new URL(request.url)

    const filters = {
      projectId,
      type: (searchParams.get('type') as IssueType) ?? undefined,
      priority: (searchParams.get('priority') as IssuePriority) ?? undefined,
      status: (searchParams.get('status') as IssueStatus) ?? undefined,
      search: searchParams.get('search') ?? undefined,
      showArchived: searchParams.get('showArchived') === 'true',
      velocityLevel: (searchParams.get('velocityLevel') as MetricLevel) ?? undefined,
      impactLevel: (searchParams.get('impactLevel') as MetricLevel) ?? undefined,
      effortLevel: (searchParams.get('effortLevel') as MetricLevel) ?? undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const { issues, total } = await listIssues(filters)

    return NextResponse.json({ issues, total })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[issues.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load issues.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/issues
 * Creates a new manual issue for the project.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[issues.post] Supabase must be configured to create issues')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()

    // Parse and validate session_ids
    let sessionIds: string[] | undefined
    if (body.session_ids && Array.isArray(body.session_ids)) {
      sessionIds = body.session_ids.filter((id: unknown) => typeof id === 'string' && id.trim())
    }

    const input: CreateIssueInput = {
      project_id: projectId,
      session_ids: sessionIds,
      type: body.type,
      title: body.title,
      description: body.description,
      priority: body.priority || undefined,
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

    const issue = await createIssue(input)

    return NextResponse.json({ issue }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[issues.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create issue.' }, { status: 500 })
  }
}
