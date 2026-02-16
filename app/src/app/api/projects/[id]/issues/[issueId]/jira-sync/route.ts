import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { manualRetrySync } from '@/lib/integrations/jira/sync'

export const runtime = 'nodejs'

/**
 * POST /api/projects/[id]/issues/[issueId]/jira-sync
 * Manually retry Jira sync for an issue
 */
export async function POST(
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

    const result = await manualRetrySync(issueId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[issues.jira-sync] unexpected error', error)
    return NextResponse.json({ error: 'Failed to retry Jira sync.' }, { status: 500 })
  }
}
