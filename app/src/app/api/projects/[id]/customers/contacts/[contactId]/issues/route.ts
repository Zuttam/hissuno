import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getContactLinkedIssues } from '@/lib/supabase/contacts'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; contactId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/customers/contacts/[contactId]/issues
 * Returns issues linked to a contact (through sessions).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId, contactId } = await context.params
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const issues = await getContactLinkedIssues(contactId)

    return NextResponse.json({ issues })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[api.contacts.issues.GET] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch contact issues.' }, { status: 500 })
  }
}
