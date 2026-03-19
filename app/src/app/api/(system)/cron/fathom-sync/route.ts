/**
 * Fathom sync cron job.
 * Runs on a schedule to sync meetings for all enabled connections.
 */

import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getConnectionsDueForSync } from '@/lib/integrations/fathom'
import { syncFathomMeetings } from '@/lib/integrations/fathom/sync'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/fathom-sync
 * Process all Fathom connections due for sync
 */
export async function GET(request: Request) {
  // Validate cron secret to prevent unauthorized access
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

  try {
    // Get connections due for sync
    const connectionsDue = await getConnectionsDueForSync()

    if (connectionsDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connections due for sync.',
        processed: 0,
      })
    }

    console.log(`[cron/fathom-sync] Processing ${connectionsDue.length} connections`)

    const results: Array<{
      projectId: string
      success: boolean
      meetingsSynced: number
      error?: string
    }> = []

    // Process each connection
    for (const connection of connectionsDue) {
      try {
        // filterConfig is loaded internally by syncFathomMeetings via getFathomCredentials
        const result = await syncFathomMeetings(connection.projectId, {
          triggeredBy: 'cron',
          syncMode: 'incremental',
        })

        results.push({
          projectId: connection.projectId,
          success: result.success,
          meetingsSynced: result.meetingsSynced,
          error: result.error,
        })

        console.log(
          `[cron/fathom-sync] Project ${connection.projectId}: ` +
            `${result.success ? 'success' : 'failed'}, ` +
            `synced ${result.meetingsSynced} meetings`
        )
      } catch (error) {
        console.error(`[cron/fathom-sync] Error processing ${connection.projectId}:`, error)
        results.push({
          projectId: connection.projectId,
          success: false,
          meetingsSynced: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const totalSynced = results.reduce((sum, r) => sum + r.meetingsSynced, 0)

    return NextResponse.json({
      success: true,
      message: `Processed ${connectionsDue.length} connections. ${successCount} successful, ${totalSynced} meetings synced.`,
      processed: connectionsDue.length,
      successful: successCount,
      totalSynced,
      results,
    })
  } catch (error) {
    console.error('[cron/fathom-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process Fathom sync.' },
      { status: 500 }
    )
  }
}
