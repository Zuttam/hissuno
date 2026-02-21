import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { pushIssueToTracker } from '@/lib/integrations/issue-tracker'
import type { IssueTrackerProvider } from '@/types/issue-tracker'

export const runtime = 'nodejs'

/**
 * POST /api/projects/[id]/issues/bulk-tracker-sync
 * Bulk sync multiple issues to a tracker
 * Body: { issueIds: string[], provider: 'jira' | 'linear' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId } = await params
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const issueIds = body.issueIds as string[]
    const provider = body.provider as IssueTrackerProvider

    if (!Array.isArray(issueIds) || issueIds.length === 0) {
      return NextResponse.json({ error: 'issueIds array is required.' }, { status: 400 })
    }

    if (!provider || !['jira', 'linear'].includes(provider)) {
      return NextResponse.json({ error: 'Valid provider is required (jira or linear).' }, { status: 400 })
    }

    // Fire all syncs (non-blocking per issue)
    const results: Array<{ issueId: string; status: 'queued' | 'error'; error?: string }> = []

    for (const issueId of issueIds) {
      try {
        await pushIssueToTracker(issueId, projectId, provider)
        results.push({ issueId, status: 'queued' })
      } catch (error) {
        results.push({
          issueId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      total: issueIds.length,
      queued: results.filter((r) => r.status === 'queued').length,
      errors: results.filter((r) => r.status === 'error').length,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[issues.bulk-tracker-sync] unexpected error', error)
    return NextResponse.json({ error: 'Failed to bulk sync.' }, { status: 500 })
  }
}
