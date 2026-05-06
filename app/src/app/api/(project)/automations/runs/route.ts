/**
 * GET /api/automations/runs?projectId=...&skillId=...&status=...&limit=...
 *
 * Lists historical automation runs for the project. Optional filters:
 *   - skillId: only runs of this skill
 *   - status: only runs in this terminal/non-terminal state
 *   - limit:  default 50, max 200
 *
 * Used by the per-skill run-history view in the catalog page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import {
  listAutomationRuns,
  type AutomationRunStatus,
} from '@/lib/db/queries/automation-runs'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { searchParams } = new URL(request.url)
    const skillId = searchParams.get('skillId') ?? undefined
    const status = searchParams.get('status') as AutomationRunStatus | null
    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50

    const rows = await listAutomationRuns({
      projectId,
      skillId,
      status: status ?? undefined,
      limit,
    })

    return NextResponse.json({
      runs: rows.map((r) => ({
        runId: r.id,
        skillId: r.skill_id,
        skillVersion: r.skill_version,
        skillSource: r.skill_source,
        triggerType: r.trigger_type,
        triggerEntityType: r.trigger_entity_type,
        triggerEntityId: r.trigger_entity_id,
        status: r.status,
        startedAt: r.started_at?.toISOString() ?? null,
        completedAt: r.completed_at?.toISOString() ?? null,
        durationMs: r.duration_ms,
        createdAt: r.created_at.toISOString(),
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
