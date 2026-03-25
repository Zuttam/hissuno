/**
 * Fathom sync API route.
 * GET - Trigger manual sync with SSE progress streaming
 */

import { NextRequest } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/utils/sse'
import { hasFathomConnection } from '@/lib/integrations/fathom'
import { syncFathomMeetings, type SyncProgressEvent, type SyncMode } from '@/lib/integrations/fathom/sync'

export const runtime = 'nodejs'

/**
 * SSE event types for Fathom sync
 */
type FathomSyncSSEEvent = BaseSSEEvent & {
  type:
    | 'connected'
    | 'progress'
    | 'synced'
    | 'skipped'
    | 'error'
    | 'complete'
  meetingId?: string
  sessionId?: string
  current?: number
  total?: number
  result?: {
    meetingsFound: number
    meetingsSynced: number
    meetingsSkipped: number
  }
}

/**
 * GET /api/integrations/fathom/sync?projectId=xxx
 * Trigger manual sync with SSE progress streaming
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return new Response(JSON.stringify({ error: 'Database must be configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'projectId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Authenticate before starting stream
  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (error instanceof ForbiddenError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    throw error
  }

  // Check if Fathom is connected
  const status = await hasFathomConnection(projectId)
  if (!status.connected) {
    return new Response(JSON.stringify({ error: 'Fathom is not connected.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get filter config from status
  const filterConfig = status.filterConfig || undefined

  // Parse sync mode from query params
  const modeParam = request.nextUrl.searchParams.get('mode')
  const syncMode: SyncMode | undefined =
    modeParam === 'incremental' || modeParam === 'full' ? modeParam : undefined

  return createSSEStreamWithExecutor<FathomSyncSSEEvent>({
    logPrefix: '[fathom-sync.stream]',
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Starting sync...' }) as FathomSyncSSEEvent)

      const controller = new AbortController()

      try {
        const result = await syncFathomMeetings(projectId, {
          triggeredBy: 'manual',
          filterConfig,
          syncMode,
          signal: controller.signal,
          onProgress: (event: SyncProgressEvent) => {
            if (isClosed()) {
              controller.abort()
              return
            }

            emit({
              type: event.type as FathomSyncSSEEvent['type'],
              meetingId: event.meetingId,
              sessionId: event.sessionId,
              message: event.message,
              current: event.current,
              total: event.total,
              timestamp: new Date().toISOString(),
            })
          },
        })

        if (!isClosed()) {
          if (result.success) {
            emit(createSSEEvent('complete', {
              message: `Sync complete. Synced ${result.meetingsSynced} meetings.`,
              data: {
                result: {
                  meetingsFound: result.meetingsFound,
                  meetingsSynced: result.meetingsSynced,
                  meetingsSkipped: result.meetingsSkipped,
                },
              },
            }) as FathomSyncSSEEvent)
          } else {
            emit(createSSEEvent('error', {
              message: result.error || 'Sync failed.',
              data: {
                result: {
                  meetingsFound: result.meetingsFound,
                  meetingsSynced: result.meetingsSynced,
                  meetingsSkipped: result.meetingsSkipped,
                },
              },
            }) as FathomSyncSSEEvent)
          }
        }
      } catch (error) {
        console.error('[fathom-sync.stream] Error:', error)
        if (!isClosed()) {
          emit(createSSEEvent('error', {
            message: error instanceof Error ? error.message : 'An unexpected error occurred.',
          }) as FathomSyncSSEEvent)
        }
      }

      close()
    },
  })
}
