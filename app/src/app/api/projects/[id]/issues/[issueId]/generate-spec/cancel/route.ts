import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getIssueById } from '@/lib/supabase/issues'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { cancelSpecGeneration } from '@/lib/issues/spec-generation-service'

export const runtime = 'nodejs'

type RouteParams = { id: string; issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/projects/[id]/issues/[issueId]/generate-spec/cancel
 * Cancel a running spec generation
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[generate-spec.cancel] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    const supabase = await getClientForIdentity(identity)
    const result = await cancelSpecGeneration({ issueId, supabase })

    if (!result.success) {
      return NextResponse.json({
        message: result.error,
        cancelled: false,
      })
    }

    console.log('[generate-spec.cancel] Cancelled spec generation for issue:', issueId)

    return NextResponse.json({
      message: 'Spec generation cancelled successfully.',
      cancelled: true,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[generate-spec.cancel] unexpected error', error)
    return NextResponse.json({ error: 'Failed to cancel spec generation.' }, { status: 500 })
  }
}
