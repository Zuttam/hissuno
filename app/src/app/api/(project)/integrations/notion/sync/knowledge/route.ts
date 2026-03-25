/**
 * Notion knowledge sync API route.
 * GET - Trigger manual knowledge sync with SSE progress streaming
 */

import { NextRequest } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/utils/sse'
import { hasNotionConnection } from '@/lib/integrations/notion'
import { syncNotionKnowledge } from '@/lib/integrations/notion/sync-knowledge'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/notion/sync/knowledge?projectId=xxx
 * Trigger manual knowledge sync with SSE progress streaming
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

  // Check if Notion is connected
  const status = await hasNotionConnection(projectId)
  if (!status.connected) {
    return new Response(JSON.stringify({ error: 'Notion is not connected.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return createSSEStreamWithExecutor<BaseSSEEvent>({
    logPrefix: '[notion-sync-knowledge.stream]',
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Starting knowledge sync...' }))

      try {
        await syncNotionKnowledge(projectId, (event) => {
          if (isClosed()) return

          emit(createSSEEvent(event.type, {
            message: event.message,
            data: {
              processed: event.processed,
              total: event.total,
              created: event.created,
              updated: event.updated,
              skipped: event.skipped,
            },
          }))
        })

        if (!isClosed()) {
          emit(createSSEEvent('complete', { message: 'Knowledge sync complete.' }))
        }
      } catch (error) {
        console.error('[notion-sync-knowledge.stream] Error:', error)
        if (!isClosed()) {
          emit(createSSEEvent('error', {
            message: error instanceof Error ? error.message : 'An unexpected error occurred.',
          }))
        }
      }

      close()
    },
  })
}
