/**
 * Notion sync cron job.
 * Runs on a schedule to sync issues and knowledge for all enabled Notion connections.
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { getConnectionsDueForSync } from '@/lib/integrations/shared/sync-utils'
import { notionSyncConfigs } from '@/lib/db/schema/app'
import { syncNotionIssues } from '@/lib/integrations/notion/sync-issues'
import { syncNotionKnowledge } from '@/lib/integrations/notion/sync-knowledge'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/notion-sync
 * Process all Notion sync configs due for sync
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
    const connectionsDue = await getConnectionsDueForSync(notionSyncConfigs, {
      id: notionSyncConfigs.id,
      project_id: notionSyncConfigs.project_id,
      sync_enabled: notionSyncConfigs.sync_enabled,
      sync_frequency: notionSyncConfigs.sync_frequency,
      next_sync_at: notionSyncConfigs.next_sync_at,
      last_sync_status: notionSyncConfigs.last_sync_status,
    })

    if (connectionsDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Notion sync configs due for sync.',
        processed: 0,
      })
    }

    console.log(`[cron/notion-sync] Processing ${connectionsDue.length} sync configs`)

    const results: Array<{
      projectId: string
      success: boolean
      error?: string
    }> = []

    for (const config of connectionsDue) {
      try {
        const [row] = await db
          .select({ sync_type: notionSyncConfigs.sync_type })
          .from(notionSyncConfigs)
          .where(eq(notionSyncConfigs.id, config.id))

        if (!row) continue

        if (row.sync_type === 'issues') {
          await syncNotionIssues(config.projectId)
        } else if (row.sync_type === 'knowledge') {
          await syncNotionKnowledge(config.projectId)
        }

        results.push({ projectId: config.projectId, success: true })
        console.log(`[cron/notion-sync] Project ${config.projectId} (${row.sync_type}): success`)
      } catch (error) {
        console.error(`[cron/notion-sync] Error processing ${config.projectId}:`, error)
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
    console.error('[cron/notion-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process Notion sync.' },
      { status: 500 }
    )
  }
}
