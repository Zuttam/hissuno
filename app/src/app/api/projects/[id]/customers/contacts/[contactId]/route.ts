import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { getContactById, updateContactById, deleteContactById } from '@/lib/supabase/contacts'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { UpdateContactInput } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { id: string; contactId: string }
type RouteContext = { params: Promise<RouteParams> }

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * GET /api/projects/[id]/customers/contacts/[contactId]
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: projectId, contactId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    const contact = await getContactById(contactId)

    if (!contact || contact.project_id !== projectId) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    }

    return NextResponse.json({ contact })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[contacts.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load contact.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/customers/contacts/[contactId]
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, contactId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    const existing = await getContactById(contactId)
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    }

    const body = (await request.json()) as UpdateContactInput

    if (body.is_champion !== undefined && typeof body.is_champion !== 'boolean') {
      return NextResponse.json({ error: 'is_champion must be a boolean.' }, { status: 400 })
    }

    const contact = await updateContactById(supabase, contactId, body)

    return NextResponse.json({ contact })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[contacts.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update contact.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/customers/contacts/[contactId]
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: projectId, contactId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    const existing = await getContactById(contactId)
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    }

    await deleteContactById(supabase, contactId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[contacts.delete] unexpected error', error)
    return NextResponse.json({ error: 'Unable to delete contact.' }, { status: 500 })
  }
}
