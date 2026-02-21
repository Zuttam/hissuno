import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getAllTrackerSyncStatuses } from '@/lib/integrations/issue-tracker'

export const runtime = 'nodejs'

/**
 * GET /api/projects/[id]/issues/[issueId]/tracker-status
 * Get sync status from all connected trackers for an issue
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId, issueId } = await params
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const statuses = await getAllTrackerSyncStatuses(issueId)
    return NextResponse.json({ statuses })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[issues.tracker-status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to get tracker status.' }, { status: 500 })
  }
}
