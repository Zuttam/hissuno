import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getContactById, updateContactArchiveStatus } from '@/lib/supabase/contacts'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; contactId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * PATCH /api/projects/[id]/customers/contacts/[contactId]/archive
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, contactId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    const existing = await getContactById(contactId)
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    }

    const body = await request.json()
    const isArchived = Boolean(body.is_archived)

    const contact = await updateContactArchiveStatus(supabase, contactId, isArchived)
    return NextResponse.json({ contact })
  } catch (error) {
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
