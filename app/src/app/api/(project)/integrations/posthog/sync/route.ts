/**
 * PostHog sync API route.
 * GET - Trigger manual sync with SSE progress streaming
 */

import { NextRequest } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { hasPosthogConnection } from '@/lib/integrations/posthog'
import { syncPosthogProfiles, type SyncProgressEvent } from '@/lib/integrations/posthog/sync'

export const runtime = 'nodejs'

/**
 * SSE event types for PostHog sync
 */
type PosthogSyncSSEEvent = BaseSSEEvent & {
  type:
    | 'connected'
    | 'progress'
    | 'matched'
    | 'discovery'
    | 'created'
    | 'error'
    | 'complete'
  contactId?: string
  contactName?: string
  current?: number
  total?: number
  result?: {
    contactsProcessed: number
    contactsMatched: number
    sessionsCreated: number
    contactsCreated: number
  }
}

/**
 * GET /api/integrations/posthog/sync?projectId=xxx
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

  // Check if PostHog is connected
  const status = await hasPosthogConnection(projectId)
  if (!status.connected) {
    return new Response(JSON.stringify({ error: 'PostHog is not connected.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return createSSEStreamWithExecutor<PosthogSyncSSEEvent>({
    logPrefix: '[posthog-sync.stream]',
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Starting sync...' }) as PosthogSyncSSEEvent)

      const controller = new AbortController()

      try {
        const result = await syncPosthogProfiles(projectId, {
          signal: controller.signal,
          onProgress: (event: SyncProgressEvent) => {
            if (isClosed()) {
              controller.abort()
              return
            }

            emit({
              type: event.type as PosthogSyncSSEEvent['type'],
              contactId: event.contactId,
              contactName: event.contactName,
              message: event.message,
              current: event.current,
              total: event.total,
              timestamp: new Date().toISOString(),
            })
          },
        })

        if (!isClosed()) {
          if (result.success) {
            const createdMsg = result.contactsCreated > 0
              ? `, created ${result.contactsCreated} new contacts`
              : ''
            emit(createSSEEvent('complete', {
              message: `Sync complete. Matched ${result.contactsMatched} contacts, created ${result.sessionsCreated} sessions${createdMsg}.`,
              data: {
                result: {
                  contactsProcessed: result.contactsProcessed,
                  contactsMatched: result.contactsMatched,
                  sessionsCreated: result.sessionsCreated,
                  contactsCreated: result.contactsCreated,
                },
              },
            }) as PosthogSyncSSEEvent)
          } else {
            emit(createSSEEvent('error', {
              message: result.error || 'Sync failed.',
              data: {
                result: {
                  contactsProcessed: result.contactsProcessed,
                  contactsMatched: result.contactsMatched,
                  sessionsCreated: result.sessionsCreated,
                  contactsCreated: result.contactsCreated,
                },
              },
            }) as PosthogSyncSSEEvent)
          }
        }
      } catch (error) {
        console.error('[posthog-sync.stream] Error:', error)
        if (!isClosed()) {
          emit(createSSEEvent('error', {
            message: error instanceof Error ? error.message : 'An unexpected error occurred.',
          }) as PosthogSyncSSEEvent)
        }
      }

      close()
    },
  })
}
