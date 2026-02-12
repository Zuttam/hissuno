import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { getContactLinkedSessions } from '@/lib/supabase/contacts'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

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
    const { id: projectId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      throw new UnauthorizedError('User not authenticated')
    }

    await assertUserOwnsProject(supabase, projectId, user.id)

    const sessions = await getContactLinkedSessions(await context.params.then((p) => p.contactId))

    return NextResponse.json({ sessions })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[api.contacts.sessions.GET] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch contact sessions.' }, { status: 500 })
  }
}
