import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { pushIssueToTracker, retryTrackerSync } from '@/lib/integrations/issue-tracker'
import type { IssueTrackerProvider } from '@/types/issue-tracker'

export const runtime = 'nodejs'

/**
 * POST /api/projects/[id]/issues/[issueId]/tracker-sync
 * Manual push or retry sync for a specific tracker
 * Body: { provider: 'jira' | 'linear', action: 'create' | 'retry' }
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

    const body = await request.json()
    const provider = body.provider as IssueTrackerProvider
    const action = body.action as string

    if (!provider || !['jira', 'linear'].includes(provider)) {
      return NextResponse.json({ error: 'Valid provider is required (jira or linear).' }, { status: 400 })
    }

    if (action === 'retry') {
      const result = await retryTrackerSync(issueId, provider)
      return NextResponse.json(result)
    } else {
      // Default to 'create' push
      await pushIssueToTracker(issueId, projectId, provider)
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[issues.tracker-sync] unexpected error', error)
    return NextResponse.json({ error: 'Failed to sync to tracker.' }, { status: 500 })
  }
}
