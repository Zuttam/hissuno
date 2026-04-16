/**
 * GitHub sync cron job.
 * Runs on a schedule to sync feedback for all enabled GitHub sync configs.
 */

import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getConnectionsDueForSync } from '@/lib/integrations/shared/sync-utils'
import { githubSyncConfigs } from '@/lib/db/schema/app'
import { syncGitHubFeedback } from '@/lib/integrations/github/sync-feedback'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/github-sync
 * Process all GitHub sync configs due for sync
 */
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

  try {
    const connectionsDue = await getConnectionsDueForSync(githubSyncConfigs, {
      id: githubSyncConfigs.id,
      project_id: githubSyncConfigs.project_id,
      sync_enabled: githubSyncConfigs.sync_enabled,
      sync_frequency: githubSyncConfigs.sync_frequency,
      next_sync_at: githubSyncConfigs.next_sync_at,
      last_sync_status: githubSyncConfigs.last_sync_status,
    })

    if (connectionsDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No GitHub sync configs due for sync.',
        processed: 0,
      })
    }

    console.log(`[cron/github-sync] Processing ${connectionsDue.length} sync configs`)

    const results: Array<{
      projectId: string
      success: boolean
      error?: string
    }> = []

    for (const config of connectionsDue) {
      try {
        await syncGitHubFeedback(config.projectId)
        results.push({ projectId: config.projectId, success: true })
        console.log(`[cron/github-sync] Project ${config.projectId}: success`)
      } catch (error) {
        console.error(`[cron/github-sync] Error processing ${config.projectId}:`, error)
        results.push({
          projectId: config.projectId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      message: `Processed ${connectionsDue.length} configs. ${successCount} successful.`,
      processed: connectionsDue.length,
      successful: successCount,
      results,
    })
  } catch (error) {
    console.error('[cron/github-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process GitHub sync.' },
      { status: 500 }
    )
  }
}
