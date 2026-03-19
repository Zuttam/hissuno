/**
 * HubSpot sync cron job.
 * Runs on a schedule to sync companies and contacts for all enabled connections.
 */

import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getConnectionsDueForSync } from '@/lib/integrations/hubspot'
import { syncHubSpotData } from '@/lib/integrations/hubspot/sync'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/hubspot-sync
 * Process all HubSpot connections due for sync
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
    const connectionsDue = await getConnectionsDueForSync()

    if (connectionsDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connections due for sync.',
        processed: 0,
      })
    }

    console.log(`[cron/hubspot-sync] Processing ${connectionsDue.length} connections`)

    const results: Array<{
      projectId: string
      success: boolean
      companiesSynced: number
      contactsSynced: number
      error?: string
    }> = []

    for (const connection of connectionsDue) {
      try {
        // filterConfig is loaded internally by syncHubSpotData via getHubSpotCredentials
        const result = await syncHubSpotData(connection.projectId, {
          triggeredBy: 'cron',
          syncMode: 'incremental',
        })

        results.push({
          projectId: connection.projectId,
          success: result.success,
          companiesSynced: result.companiesSynced,
          contactsSynced: result.contactsSynced,
          error: result.error,
        })

        console.log(
          `[cron/hubspot-sync] Project ${connection.projectId}: ` +
            `${result.success ? 'success' : 'failed'}, ` +
            `synced ${result.companiesSynced} companies, ${result.contactsSynced} contacts`
        )
      } catch (error) {
        console.error(`[cron/hubspot-sync] Error processing ${connection.projectId}:`, error)
        results.push({
          projectId: connection.projectId,
          success: false,
          companiesSynced: 0,
          contactsSynced: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const totalCompanies = results.reduce((sum, r) => sum + r.companiesSynced, 0)
    const totalContacts = results.reduce((sum, r) => sum + r.contactsSynced, 0)

    return NextResponse.json({
      success: true,
      message: `Processed ${connectionsDue.length} connections. ${successCount} successful, ${totalCompanies} companies, ${totalContacts} contacts synced.`,
      processed: connectionsDue.length,
      successful: successCount,
      totalCompanies,
      totalContacts,
      results,
    })
  } catch (error) {
    console.error('[cron/hubspot-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process HubSpot sync.' },
      { status: 500 }
    )
  }
}
