import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getContactById, updateContactArchiveStatus } from '@/lib/db/queries/contacts'
import { isDatabaseConfigured } from '@/lib/db/config'

export const runtime = 'nodejs'

type RouteParams = { contactId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * PATCH /api/contacts/[contactId]/archive?projectId=...
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { contactId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const existing = await getContactById(contactId)
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    }

    const body = await request.json()
    const isArchived = Boolean(body.is_archived)

    const contact = await updateContactArchiveStatus(contactId, isArchived)
    return NextResponse.json({ contact })
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
    console.error('[contacts.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update contact.' }, { status: 500 })
  }
}
