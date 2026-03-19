/**
 * HubSpot sync API route.
 * GET - Trigger manual sync with SSE progress streaming
 */

import { NextRequest } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { hasHubSpotConnection } from '@/lib/integrations/hubspot'
import { syncHubSpotData, type SyncProgressEvent, type SyncMode } from '@/lib/integrations/hubspot/sync'

export const runtime = 'nodejs'

/**
 * SSE event types for HubSpot sync
 */
type HubSpotSyncSSEEvent = BaseSSEEvent & {
  type:
    | 'connected'
    | 'progress'
    | 'error'
    | 'complete'
  current?: number
  total?: number
  result?: {
    companiesFound: number
    companiesSynced: number
    companiesSkipped: number
    contactsFound: number
    contactsSynced: number
    contactsSkipped: number
  }
}

/**
 * GET /api/integrations/hubspot/sync?projectId=xxx
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

  // Check if HubSpot is connected
  const status = await hasHubSpotConnection(projectId)
  if (!status.connected) {
    return new Response(JSON.stringify({ error: 'HubSpot is not connected.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const filterConfig = status.filterConfig || undefined

  const modeParam = request.nextUrl.searchParams.get('mode')
  const syncMode: SyncMode | undefined =
    modeParam === 'incremental' || modeParam === 'full' ? modeParam : undefined

  return createSSEStreamWithExecutor<HubSpotSyncSSEEvent>({
    logPrefix: '[hubspot-sync.stream]',
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Starting sync...' }) as HubSpotSyncSSEEvent)

      const controller = new AbortController()

      try {
        const result = await syncHubSpotData(projectId, {
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
              type: event.type as HubSpotSyncSSEEvent['type'],
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
              message: `Sync complete. ${result.companiesSynced} companies, ${result.contactsSynced} contacts synced.`,
              data: {
                result: {
                  companiesFound: result.companiesFound,
                  companiesSynced: result.companiesSynced,
                  companiesSkipped: result.companiesSkipped,
                  contactsFound: result.contactsFound,
                  contactsSynced: result.contactsSynced,
                  contactsSkipped: result.contactsSkipped,
                },
              },
            }) as HubSpotSyncSSEEvent)
          } else {
            emit(createSSEEvent('error', {
              message: result.error || 'Sync failed.',
              data: {
                result: {
                  companiesFound: result.companiesFound,
                  companiesSynced: result.companiesSynced,
                  companiesSkipped: result.companiesSkipped,
                  contactsFound: result.contactsFound,
                  contactsSynced: result.contactsSynced,
                  contactsSkipped: result.contactsSkipped,
                },
              },
            }) as HubSpotSyncSSEEvent)
          }
        }
      } catch (error) {
        console.error('[hubspot-sync.stream] Error:', error)
        if (!isClosed()) {
          emit(createSSEEvent('error', {
            message: error instanceof Error ? error.message : 'An unexpected error occurred.',
          }) as HubSpotSyncSSEEvent)
        }
      }

      close()
    },
  })
}
