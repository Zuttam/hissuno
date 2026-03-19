import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getContactLinkedSessions } from '@/lib/db/queries/contacts'
import { isDatabaseConfigured } from '@/lib/db/config'

export const runtime = 'nodejs'

type RouteParams = { contactId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/contacts/[contactId]/sessions?projectId=...
 * Returns sessions linked to a contact.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const { contactId } = await context.params
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const sessions = await getContactLinkedSessions(contactId)

    return NextResponse.json({ sessions })
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
    console.error('[api.contacts.sessions.GET] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch contact sessions.' }, { status: 500 })
  }
}
