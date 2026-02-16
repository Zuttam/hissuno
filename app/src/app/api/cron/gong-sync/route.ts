/**
 * Gong sync cron job.
 * Runs on a schedule to sync calls for all enabled connections.
 */

import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getConnectionsDueForSync, hasGongConnection } from '@/lib/integrations/gong'
import { syncGongCalls } from '@/lib/integrations/gong/sync'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/gong-sync
 * Process all Gong connections due for sync
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    // Use service role for cron operations
    const supabase = await createAdminClient()

    // Get connections due for sync
    const connectionsDue = await getConnectionsDueForSync(supabase)

    if (connectionsDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connections due for sync.',
        processed: 0,
      })
    }

    console.log(`[cron/gong-sync] Processing ${connectionsDue.length} connections`)

    const results: Array<{
      projectId: string
      success: boolean
      callsSynced: number
      error?: string
    }> = []

    // Process each connection
    for (const connection of connectionsDue) {
      try {
        // Get filter config
        const status = await hasGongConnection(supabase, connection.projectId)
        const filterConfig = status.filterConfig || undefined

        const result = await syncGongCalls(supabase, connection.projectId, {
          triggeredBy: 'cron',
          filterConfig,
          syncMode: 'incremental',
        })

        results.push({
          projectId: connection.projectId,
          success: result.success,
          callsSynced: result.callsSynced,
          error: result.error,
        })

        console.log(
          `[cron/gong-sync] Project ${connection.projectId}: ` +
            `${result.success ? 'success' : 'failed'}, ` +
            `synced ${result.callsSynced} calls`
        )
      } catch (error) {
        console.error(`[cron/gong-sync] Error processing ${connection.projectId}:`, error)
        results.push({
          projectId: connection.projectId,
          success: false,
          callsSynced: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const totalSynced = results.reduce((sum, r) => sum + r.callsSynced, 0)

    return NextResponse.json({
      success: true,
      message: `Processed ${connectionsDue.length} connections. ${successCount} successful, ${totalSynced} calls synced.`,
      processed: connectionsDue.length,
      successful: successCount,
      totalSynced,
      results,
    })
  } catch (error) {
    console.error('[cron/gong-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process Gong sync.' },
      { status: 500 }
    )
  }
}
