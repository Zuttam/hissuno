import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server'
import { validateBatchIds, BatchValidationError } from '@/lib/batch/validation'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * POST /api/projects/[id]/issues/batch/archive
 * Batch archive/unarchive issues.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { issueIds, is_archived } = body

    if (typeof is_archived !== 'boolean') {
      return NextResponse.json({ error: 'is_archived (boolean) is required.' }, { status: 400 })
    }

    const validatedIds = await validateBatchIds({
      projectId,
      table: 'issues',
      ids: issueIds,
      maxSize: 100,
    })

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('issues')
      .update({ is_archived })
      .in('id', validatedIds)
      .eq('project_id', projectId)

    if (error) {
      console.error('[issues.batch.archive] update error', error)
      return NextResponse.json({ error: 'Failed to update issues.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: validatedIds.length })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    if (error instanceof BatchValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[issues.batch.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update issues.' }, { status: 500 })
  }
}
