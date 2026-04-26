/**
 * GET /api/automations/runs/[runId]/stream?projectId=...
 *
 * Server-Sent Events stream of run progress. Replays any events already
 * captured in the DB (so reconnects work), then attaches to the in-memory
 * pubsub for live updates. Closes when the run reaches a terminal status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { createSSEStreamWithExecutor, type BaseSSEEvent } from '@/lib/utils/sse'
import {
  getAutomationRun,
  type ProgressEvent,
} from '@/lib/db/queries/automation-runs'
import { subscribeRunEvents } from '@/lib/automations/run-bus'

export const runtime = 'nodejs'

const POLL_TERMINAL_INTERVAL_MS = 1500

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { runId } = await context.params

    const initial = await getAutomationRun(runId, projectId)
    if (!initial) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    return createSSEStreamWithExecutor<BaseSSEEvent>({
      logPrefix: `[automation:${runId}]`,
      executor: async ({ emit, close, isClosed }) => {
        // Replay everything we already have in the row.
        const replayedEvents = (initial.progress_events ?? []) as ProgressEvent[]
        for (const event of replayedEvents) {
          emit(toSSE(event))
        }

        emit({
          type: 'snapshot',
          message: `status=${initial.status}`,
          data: { status: initial.status },
          timestamp: new Date().toISOString(),
        })

        // If the run is already terminal, no need to subscribe.
        if (isTerminal(initial.status)) {
          if (initial.status === 'succeeded' && initial.output) {
            emit({
              type: 'output',
              data: initial.output as Record<string, unknown>,
              timestamp: new Date().toISOString(),
            })
          }
          if (initial.status === 'failed' && initial.error) {
            emit({
              type: 'error',
              message: (initial.error as { message?: string })?.message ?? 'Run failed',
              timestamp: new Date().toISOString(),
            })
          }
          close()
          return
        }

        // Live subscription on the in-memory bus, with a fallback poll for the
        // terminal state (so we always eventually close even if no event was
        // published - e.g., another node ran the dispatch).
        const unsubscribe = subscribeRunEvents(runId, (event) => {
          emit(toSSE(event))
        })

        const poll = setInterval(async () => {
          if (isClosed()) {
            clearInterval(poll)
            unsubscribe()
            return
          }
          const fresh = await getAutomationRun(runId, projectId)
          if (!fresh) return
          if (isTerminal(fresh.status)) {
            if (fresh.status === 'succeeded' && fresh.output) {
              emit({
                type: 'output',
                data: fresh.output as Record<string, unknown>,
                timestamp: new Date().toISOString(),
              })
            }
            if (fresh.status === 'failed' && fresh.error) {
              emit({
                type: 'error',
                message: (fresh.error as { message?: string })?.message ?? 'Run failed',
                timestamp: new Date().toISOString(),
              })
            }
            emit({
              type: 'final',
              message: `status=${fresh.status}`,
              data: { status: fresh.status },
              timestamp: new Date().toISOString(),
            })
            clearInterval(poll)
            unsubscribe()
            close()
          }
        }, POLL_TERMINAL_INTERVAL_MS)
      },
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
    console.error('[automations.stream] error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function toSSE(event: ProgressEvent): BaseSSEEvent {
  return {
    type: event.type,
    message: event.message,
    data: event.data,
    timestamp: event.ts,
  }
}

function isTerminal(status: string): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}
