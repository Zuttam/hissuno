import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getContactById, updateContactById, deleteContactById } from '@/lib/db/queries/contacts'
import { fireGraphEval } from '@/lib/utils/graph-eval'
import { isDatabaseConfigured } from '@/lib/db/config'
import type { UpdateContactInput } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { contactId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/contacts/[contactId]?projectId=...
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { contactId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const contact = await getContactById(contactId)

    if (!contact || contact.project_id !== projectId) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    }

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
    console.error('[contacts.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load contact.' }, { status: 500 })
  }
}

/**
 * PATCH /api/contacts/[contactId]?projectId=...
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

    const body = (await request.json()) as UpdateContactInput

    if (body.is_champion !== undefined && typeof body.is_champion !== 'boolean') {
      return NextResponse.json({ error: 'is_champion must be a boolean.' }, { status: 400 })
    }

    const contact = await updateContactById(contactId, body)
    fireGraphEval(projectId, 'contact', contact.id)

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
    console.error('[contacts.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update contact.' }, { status: 500 })
  }
}

/**
 * DELETE /api/contacts/[contactId]?projectId=...
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    await deleteContactById(contactId)
    return NextResponse.json({ success: true })
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
    console.error('[contacts.delete] unexpected error', error)
    return NextResponse.json({ error: 'Unable to delete contact.' }, { status: 500 })
  }
}
