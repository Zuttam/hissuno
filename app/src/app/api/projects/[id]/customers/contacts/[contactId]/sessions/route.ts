import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getContactLinkedSessions } from '@/lib/supabase/contacts'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; contactId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/customers/contacts/[contactId]/sessions
 * Returns sessions linked to a contact.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId, contactId } = await context.params
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const sessions = await getContactLinkedSessions(contactId)

    return NextResponse.json({ sessions })
  } catch (error) {
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
