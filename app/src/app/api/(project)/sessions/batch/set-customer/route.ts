import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { validateBatchIds, BatchValidationError } from '@/lib/batch/validation'
import { setSessionContact } from '@/lib/db/queries/entity-relationships'

export const runtime = 'nodejs'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/sessions/batch/set-customer?projectId=...
 * Batch assign or remove a contact from sessions.
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
    const { sessionIds, contactId } = body

    console.log('[sessions.batch.set-customer] request', {
      projectId,
      contactId,
      sessionIds,
      sessionIdsType: typeof sessionIds,
      sessionIdsIsArray: Array.isArray(sessionIds),
      sessionIdsLength: Array.isArray(sessionIds) ? sessionIds.length : 'N/A',
    })

    // contactId can be null (remove contact) or a valid UUID
    if (contactId !== null) {
      if (typeof contactId !== 'string' || !UUID_REGEX.test(contactId)) {
        return NextResponse.json({ error: 'Invalid contact ID.' }, { status: 400 })
      }

      // Verify contact belongs to the same project
      const [contact] = await db
        .select({ id: contacts.id, project_id: contacts.project_id })
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .limit(1)

      if (!contact || contact.project_id !== projectId) {
        return NextResponse.json({ error: 'Contact not found.' }, { status: 400 })
      }
    }

    const validatedIds = await validateBatchIds({
      projectId,
      table: 'sessions',
      ids: sessionIds,
      maxSize: 100,
    })

    try {
      await Promise.all(
        validatedIds.map((sid) => setSessionContact(projectId, sid, contactId))
      )
    } catch (updateError) {
      console.error('[sessions.batch.set-customer] update error', updateError)
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
      console.error('[sessions.batch.set-customer] validation failed', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[sessions.batch.set-customer] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update sessions.' }, { status: 500 })
  }
}
