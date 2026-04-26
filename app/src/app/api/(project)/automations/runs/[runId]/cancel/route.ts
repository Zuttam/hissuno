/**
 * POST /api/automations/runs/[runId]/cancel?projectId=...
 *
 * Cancels a running automation. The dispatcher subscribed to run-bus cancel
 * signals at run start; this fires that signal so the agent's AbortController
 * trips and the run transitions to `cancelled`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getAutomationRun, markAutomationRunCancelled } from '@/lib/db/queries/automation-runs'
import { requestRunCancel } from '@/lib/automations/run-bus'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { runId } = await context.params

    const run = await getAutomationRun(runId, projectId)
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'cancelled') {
      return NextResponse.json({ ok: true, alreadyTerminal: true, status: run.status })
    }

    // Notify the in-process dispatcher (same node). If the dispatcher is on
    // another replica we can't reach it via in-memory bus - mark the row
    // cancelled anyway so the UI can move on; the runner will eventually
    // observe the row state on its next status read.
    const notified = requestRunCancel(runId)
    if (!notified) {
      await markAutomationRunCancelled(runId)
    }

    return NextResponse.json({ ok: true, notifiedRunner: notified })
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
    console.error('[automations.cancel] error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
