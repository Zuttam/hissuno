/**
 * Zendesk sync cron job.
 * Runs on a schedule to sync tickets for all enabled connections.
 */

import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getConnectionsDueForSync, hasZendeskConnection } from '@/lib/integrations/zendesk'
import { syncZendeskTickets } from '@/lib/integrations/zendesk/sync'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/zendesk-sync
 * Process all Zendesk connections due for sync
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const supabase = await createAdminClient()

    const connectionsDue = await getConnectionsDueForSync(supabase)

    if (connectionsDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connections due for sync.',
        processed: 0,
      })
    }

    console.log(`[cron/zendesk-sync] Processing ${connectionsDue.length} connections`)

    const results: Array<{
      projectId: string
      success: boolean
      ticketsSynced: number
      error?: string
    }> = []

    for (const connection of connectionsDue) {
      try {
        const status = await hasZendeskConnection(supabase, connection.projectId)
        const filterConfig = status.filterConfig || undefined

        const result = await syncZendeskTickets(supabase, connection.projectId, {
          triggeredBy: 'cron',
          filterConfig,
          syncMode: 'incremental',
        })

        results.push({
          projectId: connection.projectId,
          success: result.success,
          ticketsSynced: result.ticketsSynced,
          error: result.error,
        })

        console.log(
          `[cron/zendesk-sync] Project ${connection.projectId}: ` +
            `${result.success ? 'success' : 'failed'}, ` +
            `synced ${result.ticketsSynced} tickets`
        )
      } catch (error) {
        console.error(`[cron/zendesk-sync] Error processing ${connection.projectId}:`, error)
        results.push({
          projectId: connection.projectId,
          success: false,
          ticketsSynced: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const totalSynced = results.reduce((sum, r) => sum + r.ticketsSynced, 0)

    return NextResponse.json({
      success: true,
      message: `Processed ${connectionsDue.length} connections. ${successCount} successful, ${totalSynced} tickets synced.`,
      processed: connectionsDue.length,
      successful: successCount,
      totalSynced,
      results,
    })
  } catch (error) {
    console.error('[cron/zendesk-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process Zendesk sync.' },
      { status: 500 }
    )
  }
}
