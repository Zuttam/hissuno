/**
 * Intercom sync cron job.
 * Runs on a schedule to sync conversations for all enabled connections.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getConnectionsDueForSync, hasIntercomConnection } from '@/lib/integrations/intercom'
import { syncIntercomConversations } from '@/lib/integrations/intercom/sync'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/intercom-sync
 * Process all Intercom connections due for sync
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
  }

  try {
    // Use service role for cron operations
    const supabase = await createClient()

    // Get connections due for sync
    const connectionsDue = await getConnectionsDueForSync(supabase)

    if (connectionsDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connections due for sync.',
        processed: 0,
      })
    }

    console.log(`[cron/intercom-sync] Processing ${connectionsDue.length} connections`)

    const results: Array<{
      projectId: string
      success: boolean
      conversationsSynced: number
      error?: string
    }> = []

    // Process each connection
    for (const connection of connectionsDue) {
      try {
        // Get filter config
        const status = await hasIntercomConnection(supabase, connection.projectId)
        const filterConfig = status.filterConfig || undefined

        const result = await syncIntercomConversations(supabase, connection.projectId, {
          triggeredBy: 'cron',
          filterConfig,
        })

        results.push({
          projectId: connection.projectId,
          success: result.success,
          conversationsSynced: result.conversationsSynced,
          error: result.error,
        })

        console.log(
          `[cron/intercom-sync] Project ${connection.projectId}: ` +
            `${result.success ? 'success' : 'failed'}, ` +
            `synced ${result.conversationsSynced} conversations`
        )
      } catch (error) {
        console.error(`[cron/intercom-sync] Error processing ${connection.projectId}:`, error)
        results.push({
          projectId: connection.projectId,
          success: false,
          conversationsSynced: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const totalSynced = results.reduce((sum, r) => sum + r.conversationsSynced, 0)

    return NextResponse.json({
      success: true,
      message: `Processed ${connectionsDue.length} connections. ${successCount} successful, ${totalSynced} conversations synced.`,
      processed: connectionsDue.length,
      successful: successCount,
      totalSynced,
      results,
    })
  } catch (error) {
    console.error('[cron/intercom-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process Intercom sync.' },
      { status: 500 }
    )
  }
}
