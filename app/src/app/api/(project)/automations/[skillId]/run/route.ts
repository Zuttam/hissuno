/**
 * POST /api/automations/[skillId]/run?projectId=...
 *
 * Manually triggers a skill run. The agent kicks off in the background;
 * the response returns immediately with the run id so the client can open
 * the SSE stream and watch progress.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { dispatchAutomationRun } from '@/lib/automations/dispatch'
import { getProjectById } from '@/lib/db/queries/projects'
import type { TriggerContext, EntityType } from '@/lib/automations/types'

export const runtime = 'nodejs'

type Body = {
  entity?: { type: EntityType; id: string; name?: string; snapshot?: Record<string, unknown> }
  input?: Record<string, unknown>
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { skillId } = await context.params

    const project = await getProjectById(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    let body: Body = {}
    try {
      body = (await request.json()) as Body
    } catch {
      // empty body is allowed for skills without inputs
    }

    const trigger: TriggerContext = {
      type: 'manual',
      entity: body.entity,
      input: body.input,
    }

    const { run } = await dispatchAutomationRun({
      projectId,
      projectName: project.name,
      skillId,
      trigger,
    })

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      streamUrl: `/api/automations/runs/${run.id}/stream?projectId=${projectId}`,
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[automations.run] error', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
