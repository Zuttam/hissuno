/**
 * GitHub feedback sync API route.
 * GET - Trigger manual feedback sync with SSE progress streaming
 */

import { NextRequest } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/utils/sse'
import { hasGitHubInstallation } from '@/lib/integrations/github'
import { syncGitHubFeedback } from '@/lib/integrations/github/sync-feedback'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/github/sync/feedback?projectId=xxx
 * Trigger manual feedback sync with SSE progress streaming
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

  // Check if GitHub is connected
  const status = await hasGitHubInstallation(projectId)
  if (!status.connected) {
    return new Response(JSON.stringify({ error: 'GitHub is not connected.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return createSSEStreamWithExecutor<BaseSSEEvent>({
    logPrefix: '[github-sync-feedback.stream]',
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Starting feedback sync...' }))

      try {
        await syncGitHubFeedback(projectId, (event) => {
          if (isClosed()) return

          emit(createSSEEvent(event.type, {
            message: event.message,
            data: {
              processed: event.processed,
              total: event.total,
              created: event.created,
              skipped: event.skipped,
            },
          }))
        })

        if (!isClosed()) {
          emit(createSSEEvent('complete', { message: 'Feedback sync complete.' }))
        }
      } catch (error) {
        console.error('[github-sync-feedback.stream] Error:', error)
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
