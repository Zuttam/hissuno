/**
 * Gong sync API route.
 * GET - Trigger manual sync with SSE progress streaming
 */

import { NextRequest } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { hasGongConnection } from '@/lib/integrations/gong'
import { syncGongCalls, type SyncProgressEvent, type SyncMode } from '@/lib/integrations/gong/sync'

export const runtime = 'nodejs'

/**
 * SSE event types for Gong sync
 */
type GongSyncSSEEvent = BaseSSEEvent & {
  type:
    | 'connected'
    | 'progress'
    | 'synced'
    | 'skipped'
    | 'error'
    | 'complete'
  callId?: string
  sessionId?: string
  current?: number
  total?: number
  result?: {
    callsFound: number
    callsSynced: number
    callsSkipped: number
  }
}

/**
 * GET /api/integrations/gong/sync?projectId=xxx
 * Trigger manual sync with SSE progress streaming
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return new Response(JSON.stringify({ error: 'Supabase must be configured.' }), {
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
  let supabase

  try {
    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)
    supabase = await getClientForIdentity(identity)
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

  // Check if Gong is connected
  const status = await hasGongConnection(supabase, projectId)
  if (!status.connected) {
    return new Response(JSON.stringify({ error: 'Gong is not connected.' }), {
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

  return createSSEStreamWithExecutor<GongSyncSSEEvent>({
    logPrefix: '[gong-sync.stream]',
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Starting sync...' }) as GongSyncSSEEvent)

      const controller = new AbortController()

      try {
        const result = await syncGongCalls(supabase, projectId, {
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
              type: event.type as GongSyncSSEEvent['type'],
              callId: event.callId,
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
              message: `Sync complete. Synced ${result.callsSynced} calls.`,
              data: {
                result: {
                  callsFound: result.callsFound,
                  callsSynced: result.callsSynced,
                  callsSkipped: result.callsSkipped,
                },
              },
            }) as GongSyncSSEEvent)
          } else {
            emit(createSSEEvent('error', {
              message: result.error || 'Sync failed.',
              data: {
                result: {
                  callsFound: result.callsFound,
                  callsSynced: result.callsSynced,
                  callsSkipped: result.callsSkipped,
                },
              },
            }) as GongSyncSSEEvent)
          }
        }
      } catch (error) {
        console.error('[gong-sync.stream] Error:', error)
        if (!isClosed()) {
          emit(createSSEEvent('error', {
            message: error instanceof Error ? error.message : 'An unexpected error occurred.',
          }) as GongSyncSSEEvent)
        }
      }

      close()
    },
  })
}
