/**
 * GET /api/plugins/[pluginId]/[connectionId]/sync?streamId=xxx&mode=incremental
 *
 * Trigger a manual sync. Streams progress events as SSE so the UI can render
 * live status. Dispatches into the plugin's stream.sync handler via sync-runner.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/utils/sse'
import { resolvePluginConnectionRoute } from '@/lib/integrations/shared/route-helpers'
import { getStream } from '@/lib/integrations/shared/connections'
import { runStreamSync } from '@/lib/integrations/shared/sync-runner'
import type { SyncMode } from '@/lib/integrations/plugin-kit'

export const runtime = 'nodejs'
export const maxDuration = 300

type SyncSSEEvent = BaseSSEEvent & {
  streamId?: string
  current?: number
  total?: number
  externalId?: string
  hissunoId?: string
  counts?: Record<string, number>
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pluginId: string; connectionId: string }> }
) {
  const params = await context.params

  const resolved = await resolvePluginConnectionRoute(request, params)
  if (resolved instanceof NextResponse) return resolved
  const { plugin, connection } = resolved

  const streamId = request.nextUrl.searchParams.get('streamId')
  if (!streamId) {
    return NextResponse.json({ error: 'streamId is required.' }, { status: 400 })
  }

  const stream = await getStream(connection.id, streamId)
  if (!stream) {
    return NextResponse.json({ error: 'Stream not found on this connection.' }, { status: 404 })
  }

  const modeParam = request.nextUrl.searchParams.get('mode')
  const syncMode: SyncMode = modeParam === 'full' ? 'full' : 'incremental'

  return createSSEStreamWithExecutor<SyncSSEEvent>({
    logPrefix: `[integrations.${plugin.id}.sync]`,
    executor: async ({ emit, close, isClosed }) => {
      emit(createSSEEvent('connected', { message: 'Starting sync…' }) as SyncSSEEvent)

      const controller = new AbortController()

      try {
        const result = await runStreamSync({
          plugin,
          connectionId: connection.id,
          streamRowId: stream.id,
          triggeredBy: 'manual',
          syncMode,
          signal: controller.signal,
          onProgress: (event) => {
            if (isClosed()) {
              controller.abort()
              return
            }
            emit({
              type: event.type,
              message: event.message,
              current: event.current,
              total: event.total,
              externalId: event.externalId,
              hissunoId: event.hissunoId,
              streamId: stream.streamId,
              timestamp: new Date().toISOString(),
            })
          },
        })

        if (!isClosed()) {
          if (result.success) {
            emit(
              createSSEEvent('complete', {
                message: summarizeCounts(result.counts),
                data: { counts: result.counts },
              }) as SyncSSEEvent
            )
          } else {
            emit(
              createSSEEvent('error', {
                message: result.error ?? 'Sync failed.',
                data: { counts: result.counts },
              }) as SyncSSEEvent
            )
          }
        }
      } catch (error) {
        if (!isClosed()) {
          emit(
            createSSEEvent('error', {
              message: error instanceof Error ? error.message : 'Unexpected sync failure.',
            }) as SyncSSEEvent
          )
        }
      }

      close()
    },
  })
}

function summarizeCounts(counts: Record<string, number>): string {
  const parts: string[] = []
  if (counts.synced != null) parts.push(`${counts.synced} synced`)
  if (counts.skipped) parts.push(`${counts.skipped} skipped`)
  if (counts.failed) parts.push(`${counts.failed} failed`)
  if (counts.found != null && !parts.length) parts.push(`${counts.found} found`)
  return parts.join(', ') || 'Sync complete.'
}
