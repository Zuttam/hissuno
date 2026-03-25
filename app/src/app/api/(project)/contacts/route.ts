import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listContacts } from '@/lib/db/queries/contacts'
import { createContact } from '@/lib/customers/customers-service'
import { isDatabaseConfigured } from '@/lib/db/config'

export const runtime = 'nodejs'

/**
 * GET /api/contacts?projectId=...
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { searchParams } = new URL(request.url)

    const filters = {
      projectId,
      companyId: searchParams.get('companyId') ?? undefined,
      isChampion: searchParams.get('isChampion') === 'true' ? true : undefined,
      search: searchParams.get('search') ?? undefined,
      role: searchParams.get('role') ?? undefined,
      title: searchParams.get('title') ?? undefined,
      showArchived: searchParams.get('showArchived') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const { contacts, total } = await listContacts(projectId, filters)
    return NextResponse.json({ contacts, total })
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
    console.error('[contacts.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load contacts.' }, { status: 500 })
  }
}

/**
 * POST /api/contacts?projectId=...
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

    if (!body.name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    }
    if (!body.email) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 })
    }

    const contact = await createContact({
      projectId,
      name: body.name,
      email: body.email,
      companyId: body.company_id ?? null,
      role: body.role ?? null,
      title: body.title ?? null,
      phone: body.phone ?? null,
      companyUrl: body.company_url ?? null,
      isChampion: body.is_champion ?? false,
      lastContactedAt: body.last_contacted_at ?? null,
      notes: body.notes ?? null,
      customFields: body.custom_fields ?? {},
    })

    return NextResponse.json({ contact }, { status: 201 })
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
    console.error('[contacts.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create contact.' }, { status: 500 })
  }
}
