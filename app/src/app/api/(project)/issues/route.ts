import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listIssues } from '@/lib/db/queries/issues'
import { createIssue } from '@/lib/issues/issues-service'
import { isDatabaseConfigured } from '@/lib/db/config'
import type { IssueType, IssuePriority, IssueStatus, MetricLevel, CreateIssueInput } from '@/types/issue'
import { upsertExternalRecord } from '@/lib/db/queries/external-records'

export const runtime = 'nodejs'

/**
 * GET /api/issues?projectId=...
 * Lists issues for a specific project.
 * Supports filtering by type, priority, status, and search.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[issues.list] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { searchParams } = new URL(request.url)

    const productScopeIdsParam = searchParams.get('productScopeIds')
    const productScopeIds = productScopeIdsParam ? productScopeIdsParam.split(',').filter(Boolean) : undefined
    const goalId = searchParams.get('goalId') ?? undefined

    const filters = {
      projectId,
      type: (searchParams.get('type') as IssueType) ?? undefined,
      priority: (searchParams.get('priority') as IssuePriority) ?? undefined,
      status: (searchParams.get('status') as IssueStatus) ?? undefined,
      search: searchParams.get('search') ?? undefined,
      showArchived: searchParams.get('showArchived') === 'true',
      reachLevel: (searchParams.get('reachLevel') as MetricLevel) ?? undefined,
      impactLevel: (searchParams.get('impactLevel') as MetricLevel) ?? undefined,
      confidenceLevel: (searchParams.get('confidenceLevel') as MetricLevel) ?? undefined,
      effortLevel: (searchParams.get('effortLevel') as MetricLevel) ?? undefined,
      productScopeIds,
      goalId,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const { issues, total } = await listIssues(projectId, filters)

    return NextResponse.json({ issues, total })
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

    console.error('[issues.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load issues.' }, { status: 500 })
  }
}

/**
 * POST /api/issues?projectId=...
 * Creates a new manual issue for the project.
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[issues.post] Database must be configured to create issues')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
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
      name: body.name,
      description: body.description,
      priority: body.priority || undefined,
      product_scope_id: body.product_scope_id || undefined,
      custom_fields: body.custom_fields || undefined,
    }

    if (!input.type) {
      return NextResponse.json({ error: 'type is required.' }, { status: 400 })
    }
    if (!input.name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    }
    if (!input.description) {
      return NextResponse.json({ error: 'description is required.' }, { status: 400 })
    }

    const issue = await createIssue(input)

    if (body.external_id && body.external_source && issue?.id) {
      await upsertExternalRecord({
        projectId,
        source: body.external_source,
        externalId: body.external_id,
        resourceType: 'issue',
        resourceId: issue.id,
      })
    }

    return NextResponse.json({ issue }, { status: 201 })
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

    console.error('[issues.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create issue.' }, { status: 500 })
  }
}
