/**
 * Linear sync cron job.
 * Retries failed Linear syncs on a schedule.
 */

import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { retryFailedLinearSyncs } from '@/lib/integrations/linear/sync'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/linear-sync
 * Retry all failed Linear syncs
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    console.log('[cron/linear-sync] Starting retry of failed syncs')

    const result = await retryFailedLinearSyncs()

    console.log(
      `[cron/linear-sync] Processed ${result.processed} failed syncs: ` +
        `${result.successful} successful, ${result.failed} failed`
    )

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} failed syncs. ${result.successful} successful, ${result.failed} failed.`,
      ...result,
    })
  } catch (error) {
    console.error('[cron/linear-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process Linear sync retries.' },
      { status: 500 }
    )
  }
}
