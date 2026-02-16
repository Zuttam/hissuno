/**
 * Jira sync cron job.
 * Retries failed Jira syncs on a schedule.
 */

import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { retryFailedSyncs } from '@/lib/integrations/jira/sync'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/jira-sync
 * Retry all failed Jira syncs
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    console.log('[cron/jira-sync] Starting retry of failed syncs')

    const result = await retryFailedSyncs()

    console.log(
      `[cron/jira-sync] Processed ${result.processed} failed syncs: ` +
        `${result.successful} successful, ${result.failed} failed`
    )

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} failed syncs. ${result.successful} successful, ${result.failed} failed.`,
      ...result,
    })
  } catch (error) {
    console.error('[cron/jira-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process Jira sync retries.' },
      { status: 500 }
    )
  }
}
