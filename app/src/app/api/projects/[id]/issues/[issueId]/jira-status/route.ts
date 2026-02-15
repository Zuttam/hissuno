import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getJiraIssueSyncStatus } from '@/lib/integrations/jira'

export const runtime = 'nodejs'

/**
 * GET /api/projects/[id]/issues/[issueId]/jira-status
 * Get Jira sync status for an issue
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

    const supabase = await createClient()
    const syncStatus = await getJiraIssueSyncStatus(supabase, issueId)
    return NextResponse.json(syncStatus)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[issues.jira-status] unexpected error', error)
    return NextResponse.json({ error: 'Failed to get Jira status.' }, { status: 500 })
  }
}
