/**
 * GET /api/cron/sync
 *
 * Unified cron entry point for all scheduled integration syncs. Replaces the
 * per-integration /api/cron/{name}-sync endpoints.
 *
 * Iterates every integration_streams row that is due (enabled, scheduled
 * frequency, next_sync_at <= now, not in_progress), looks up the plugin, and
 * runs the stream's sync handler via sync-runner.
 *
 * Protected by CRON_SECRET (same scheme as legacy cron routes).
 */

import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { listStreamsDue } from '@/lib/integrations/shared/connections'
import { runStreamSync } from '@/lib/integrations/shared/sync-runner'
import { getPlugin } from '@/lib/integrations/registry'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const due = await listStreamsDue()

  if (due.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: 'Nothing due.' })
  }

  console.log(`[cron/sync] processing ${due.length} streams`)

  const results: Array<{
    pluginId: string
    connectionId: string
    streamId: string
    success: boolean
    counts: Record<string, number>
    error?: string
  }> = []

  for (const d of due) {
    const plugin = getPlugin(d.pluginId)
    if (!plugin) {
      console.warn(`[cron/sync] unknown plugin ${d.pluginId} — skipping`)
      results.push({
        pluginId: d.pluginId,
        connectionId: d.connectionId,
        streamId: d.streamId,
        success: false,
        counts: {},
        error: 'unknown_plugin',
      })
      continue
    }

    try {
      const result = await runStreamSync({
        plugin,
        connectionId: d.connectionId,
        streamRowId: d.streamRowId,
        triggeredBy: 'cron',
        syncMode: 'incremental',
      })
      results.push({
        pluginId: d.pluginId,
        connectionId: d.connectionId,
        streamId: d.streamId,
        success: result.success,
        counts: result.counts,
        error: result.error,
      })
    } catch (error) {
      console.error(`[cron/sync] ${d.pluginId}:${d.streamId} failed:`, error)
      results.push({
        pluginId: d.pluginId,
        connectionId: d.connectionId,
        streamId: d.streamId,
        success: false,
        counts: {},
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  const successful = results.filter((r) => r.success).length
  return NextResponse.json({
    success: true,
    processed: due.length,
    successful,
    failed: due.length - successful,
    results,
  })
}
