import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { sessions } from '@/lib/db/schema/app'
import { eq, inArray, and } from 'drizzle-orm'
import { validateBatchIds, BatchValidationError } from '@/lib/utils/batch/validation'

export const runtime = 'nodejs'

/**
 * POST /api/sessions/batch/archive?projectId=...
 * Batch archive/unarchive sessions.
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { sessionIds, is_archived } = body

    if (typeof is_archived !== 'boolean') {
      return NextResponse.json({ error: 'is_archived (boolean) is required.' }, { status: 400 })
    }

    const validatedIds = await validateBatchIds({
      projectId,
      table: 'sessions',
      ids: sessionIds,
      maxSize: 100,
    })

    try {
      await db
        .update(sessions)
        .set({ is_archived })
        .where(
          and(
            inArray(sessions.id, validatedIds),
            eq(sessions.project_id, projectId),
          )
        )
    } catch (updateError) {
      console.error('[sessions.batch.archive] update error', updateError)
      return NextResponse.json({ error: 'Failed to update sessions.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: validatedIds.length })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    if (error instanceof BatchValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[sessions.batch.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update sessions.' }, { status: 500 })
  }
}
