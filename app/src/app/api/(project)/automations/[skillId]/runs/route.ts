/**
 * GET /api/automations/[skillId]/runs?projectId=...&limit=N
 * Lists recent runs for a given skill, newest first.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listAutomationRuns } from '@/lib/db/queries/automation-runs'

export const runtime = 'nodejs'

type RouteParams = { skillId: string }
type RouteContext = { params: Promise<RouteParams> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { skillId } = await context.params
    const limit = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10) || 20, 1),
      100,
    )

    const rows = await listAutomationRuns({ projectId, skillId, limit })
    return NextResponse.json({
      runs: rows.map((r) => ({
        runId: r.id,
        status: r.status,
        triggerType: r.trigger_type,
        ranAt: (r.created_at ?? new Date()).toISOString(),
        startedAt: r.started_at ? r.started_at.toISOString() : null,
        completedAt: r.completed_at ? r.completed_at.toISOString() : null,
        durationMs: r.duration_ms ?? null,
        error: r.error,
      })),
    })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[automations.runs.list] error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
