/**
 * Intercom sync API route.
 * GET - Trigger manual sync with SSE progress streaming
 */

import { NextRequest } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { hasIntercomConnection } from '@/lib/integrations/intercom'
import { syncIntercomConversations, type SyncProgressEvent, type SyncMode } from '@/lib/integrations/intercom/sync'

export const runtime = 'nodejs'

async function resolveUserAndProject(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  // Verify user has access to this project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    throw new Error('Project not found')
  }

  const hasAccess = await hasProjectAccess(projectId, user.id)
  if (!hasAccess) {
    throw new UnauthorizedError('Not authorized to access this project')
  }

  return { supabase, user, project }
}

/**
 * SSE event types for Intercom sync
 */
type IntercomSyncSSEEvent = BaseSSEEvent & {
  type:
    | 'connected'
    | 'progress'
    | 'synced'
    | 'error'
    | 'complete'
  conversationId?: string
  sessionId?: string
  current?: number
  total?: number
  result?: {
    conversationsFound: number
    conversationsSynced: number
    conversationsSkipped: number
  }
}

/**
 * GET /api/integrations/intercom/sync?projectId=xxx
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
    const resolved = await resolveUserAndProject(projectId)
    supabase = resolved.supabase
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    throw error
  }

  // Check if Intercom is connected
  const status = await hasIntercomConnection(supabase, projectId)
  if (!status.connected) {
    return new Response(JSON.stringify({ error: 'Intercom is not connected.' }), {
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

  return createSSEStreamWithExecutor<IntercomSyncSSEEvent>({
    logPrefix: '[intercom-sync.stream]',
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Starting sync...' }) as IntercomSyncSSEEvent)

      const controller = new AbortController()

      try {
        const result = await syncIntercomConversations(supabase, projectId, {
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
              type: event.type as IntercomSyncSSEEvent['type'],
              conversationId: event.conversationId,
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
              message: `Sync complete. Synced ${result.conversationsSynced} conversations.`,
              data: {
                result: {
                  conversationsFound: result.conversationsFound,
                  conversationsSynced: result.conversationsSynced,
                  conversationsSkipped: result.conversationsSkipped,
                },
              },
            }) as IntercomSyncSSEEvent)
          } else {
            emit(createSSEEvent('error', {
              message: result.error || 'Sync failed.',
              data: {
                result: {
                  conversationsFound: result.conversationsFound,
                  conversationsSynced: result.conversationsSynced,
                  conversationsSkipped: result.conversationsSkipped,
                },
              },
            }) as IntercomSyncSSEEvent)
          }
        }
      } catch (error) {
        console.error('[intercom-sync.stream] Error:', error)
        if (!isClosed()) {
          emit(createSSEEvent('error', {
            message: error instanceof Error ? error.message : 'An unexpected error occurred.',
          }) as IntercomSyncSSEEvent)
        }
      }

      close()
    },
  })
}
